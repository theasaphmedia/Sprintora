import * as Sentry from "@sentry/nextjs";
import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { paystackFetch } from "../../../lib/paystack";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { PAID_TIERS, TRIAL_TIER } from "../../../lib/planLimits";

// Maps each paid tier to the env var holding its Paystack plan code. Kept
// here (server-only file) rather than in lib/planLimits.js, which is also
// imported by client components — plan codes aren't secret the way the API
// key is, but there's no reason for them to be in the client bundle either.
const TIER_ENV_VARS = {
  starter: "PAYSTACK_PLAN_CODE_STARTER",
  team: "PAYSTACK_PLAN_CODE_TEAM",
  business: "PAYSTACK_PLAN_CODE_BUSINESS",
};

// The real, immediate-charge subscribe flow — adds a card and starts real
// billing right away via Paystack's standard "initialize transaction with a
// plan code" pattern. By design this is only ever called once someone has
// actually decided to pay: either they're adding a card partway through
// their no-card trial (see /api/start-trial), or their trial already ended
// and they're subscribing for real. There's no trial logic in this route at
// all — trials are handled entirely before this is ever called.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return Response.json({ error: "Missing auth token" }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    console.error("Invalid ID token on /api/create-checkout-session", err);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }
  const uid = payload.sub;
  const email = payload.email;

  // Which tier to subscribe to. Defaults to the trial tier so "Add payment
  // method" mid-trial (which doesn't send a tier at all) keeps the same
  // tier the user is already trialing, rather than silently downgrading
  // them to Starter.
  let requestedTier = TRIAL_TIER;
  try {
    const body = await request.json();
    if (body?.tier) requestedTier = body.tier;
  } catch {
    // No/invalid JSON body — fine, fall back to the trial tier default.
  }
  if (!PAID_TIERS.includes(requestedTier)) {
    return Response.json({ error: `Unknown plan tier: ${requestedTier}` }, { status: 400 });
  }

  const envVar = TIER_ENV_VARS[requestedTier];
  const planCode = process.env[envVar];
  if (!planCode) {
    console.error(`${envVar} is not configured`);
    return Response.json({ error: "Billing not configured for this plan" }, { status: 500 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Admin SDK for checkout session", err);
    return Response.json({ error: "Billing not configured" }, { status: 500 });
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : null;

    // Reuse an existing Paystack customer if this user already has one,
    // rather than creating a duplicate every time they click through this.
    let customerCode = userData?.paystackCustomerCode;
    if (!customerCode) {
      const customerRes = await paystackFetch("/customer", {
        method: "POST",
        body: JSON.stringify({ email, metadata: { firebaseUid: uid } }),
      });
      customerCode = customerRes.data.customer_code;
      await userRef.set({ paystackCustomerCode: customerCode }, { merge: true });
    }

    const origin = "https://sprintora-nine.vercel.app";
    // amount is a required field on this endpoint, but its value is
    // irrelevant here: passing `plan` overrides it with the plan's own
    // price. Using a trivial positive placeholder rather than "0" in case
    // Paystack's validation rejects a zero amount before it gets to the
    // plan-override logic.
    const initRes = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: "100",
        plan: planCode,
        callback_url: `${origin}/account?checkout=success`,
        // tier is included for debugging/support only — the webhook never
        // trusts this metadata for what to actually grant. It resolves the
        // tier itself from the plan_code Paystack echoes back on the
        // subscription.create event, which can't be spoofed by the client.
        metadata: JSON.stringify({ firebaseUid: uid, tier: requestedTier }),
      }),
    });

    return Response.json({ url: initRes.data.authorization_url });
  } catch (err) {
    console.error("Failed to create Paystack checkout transaction", err);
    Sentry.captureException(err, { tags: { route: "create-checkout-session", tier: requestedTier } });
    return Response.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
