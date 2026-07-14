import crypto from "crypto";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { TRIAL_TIER } from "../../../../lib/planLimits";

// Reverse of TIER_ENV_VARS in create-checkout-session/route.js: given the
// plan_code Paystack echoes back on a subscription event, figure out which
// internal tier it corresponds to. Deliberately does NOT trust the `tier`
// value in the checkout metadata — that's client-supplied and only meant
// for debugging. The plan_code on the subscription object is set by
// Paystack itself from what was actually charged, so it can't be spoofed.
function tierForPlanCode(planCode) {
  const pairs = [
    ["starter", process.env.PAYSTACK_PLAN_CODE_STARTER],
    ["team", process.env.PAYSTACK_PLAN_CODE_TEAM],
    ["business", process.env.PAYSTACK_PLAN_CODE_BUSINESS],
  ];
  const match = pairs.find(([, code]) => code && code === planCode);
  return match ? match[0] : null;
}

// Called by Paystack's servers, not by any signed-in user. Authenticity
// comes from the x-paystack-signature header: an HMAC SHA512 of the exact
// raw request body, signed with the secret key. Only Paystack and this app
// know that key, so a matching signature proves the request is genuine.
// This is why the raw body is read as text and hashed as-is, rather than
// parsed to JSON and re-serialized (which wouldn't reproduce the same
// bytes Paystack actually signed).
export async function POST(request) {
  const signature = request.headers.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!signature || !secret) {
    console.error("Rejected /api/webhooks/paystack: missing signature header or PAYSTACK_SECRET_KEY");
    return Response.json({ error: "Not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  const expectedHash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (expectedHash !== signature) {
    console.error("Paystack webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("Failed to parse Paystack webhook body", err);
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Admin SDK for Paystack webhook", err);
    return Response.json({ error: "Admin SDK not configured" }, { status: 500 });
  }

  // Every Paystack event payload used here carries a customer object with a
  // customer_code — resolving the Firebase user by looking that code up in
  // Firestore (rather than trusting metadata to propagate through every
  // event type) keeps this uniform across all the event types below.
  async function findUserRefByCustomerCode(customerCode) {
    if (!customerCode) return null;
    const snap = await db.collection("users").where("paystackCustomerCode", "==", customerCode).limit(1).get();
    return snap.empty ? null : snap.docs[0].ref;
  }

  try {
    switch (event.event) {
      // A real charge succeeded (from /api/create-checkout-session's
      // plan-code checkout — the only place that ever initiates a real
      // charge in this app; the trial itself never touches Paystack at
      // all, see /api/start-trial). Nothing to do here directly —
      // subscription.create below is what actually flips plan to the paid
      // tier, since that's the event that confirms the subscription object
      // itself was created, not just that a payment went through.
      case "charge.success":
        break;

      case "subscription.create": {
        const userRef = await findUserRefByCustomerCode(event.data.customer?.customer_code);
        if (!userRef) break;
        const planCode = event.data.plan?.plan_code || event.data.plan_code;
        const tier = tierForPlanCode(planCode);
        if (!tier) {
          // A real payment came in for a plan_code that doesn't match any
          // of our three configured tiers — could be a stale/renamed Plan
          // in the Paystack dashboard, or an env var typo. Don't silently
          // drop a paying customer's upgrade: grant the trial tier as a
          // safe default so they get real access today, but log loudly so
          // this gets manually reconciled to the tier they actually paid
          // for, rather than assuming the default is correct long-term.
          console.error(
            `Paystack subscription.create: plan_code "${planCode}" didn't match any configured tier env var — defaulting to "${TRIAL_TIER}", needs manual reconciliation`
          );
        }
        await userRef.set(
          {
            plan: tier || TRIAL_TIER,
            paystackSubscriptionCode: event.data.subscription_code,
            subscriptionStatus: "active",
          },
          { merge: true }
        );
        break;
      }

      // Still active until the current period ends, but won't renew —
      // matches Stripe's "cancel at period end" concept.
      case "subscription.not_renew": {
        const userRef = await findUserRefByCustomerCode(event.data.customer?.customer_code);
        if (!userRef) break;
        await userRef.set({ subscriptionStatus: "non-renewing" }, { merge: true });
        break;
      }

      // Fully disabled — either cancelled and the period ended, or all
      // billing cycles completed. Revert to the free plan.
      case "subscription.disable": {
        const userRef = await findUserRefByCustomerCode(event.data.customer?.customer_code);
        if (!userRef) break;
        await userRef.set({ plan: "beta", subscriptionStatus: "cancelled" }, { merge: true });
        break;
      }

      // A recurring charge failed. Paystack keeps the subscription active
      // and retries on the next billing cycle (see their own "attention"
      // status semantics) — so this only surfaces the issue, it doesn't
      // revoke access.
      case "invoice.payment_failed": {
        const userRef = await findUserRefByCustomerCode(event.data.customer?.customer_code);
        if (!userRef) break;
        await userRef.set({ subscriptionStatus: "attention" }, { merge: true });
        break;
      }

      default:
        // Unhandled event types are expected — Paystack sends many more
        // than this app currently acts on. Not an error.
        break;
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error(`Failed to process Paystack webhook event ${event.event}`, err);
    return Response.json({ error: "Failed to process event" }, { status: 500 });
  }
}
