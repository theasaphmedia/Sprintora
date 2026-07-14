import * as Sentry from "@sentry/nextjs";
import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { TRIAL_TIER } from "../../../lib/planLimits";
import { checkAndRecordRateLimit, getClientIp } from "../../../lib/rateLimit";

// Trials are the most abuse-prone route in the app: no card is ever
// collected (by design — see the module comment below), so `trialUsed`
// alone only stops repeat trials on the SAME account. Nothing stops one
// person creating several accounts (different emails, since signup itself
// happens client-side against Firebase Auth directly and isn't a route
// this code can rate-limit) and calling this endpoint once per account.
// IP-based limiting here doesn't close that gap entirely — VPNs/proxies
// get around it — but it blunts the common case of someone doing this
// casually from one machine. 3 trial starts per IP per 24 hours.
const TRIAL_RATE_LIMIT = { maxCount: 3, windowMs: 24 * 60 * 60 * 1000 };

// Starts the 14-day trial with zero payment info collected — no Paystack
// interaction at all here, purely a Firestore write. This is the whole
// point of the design: a user gets full Pro access immediately on request,
// and is only ever asked for card details once the trial actually ends
// (see /api/create-checkout-session, which is the real, immediate-charge
// subscribe flow used at that point). `trialUsed` is a separate, permanent
// flag from `subscriptionStatus`/`plan` specifically so a user can't get a
// second free trial by canceling and re-requesting — those two fields are
// expected to change over a subscription's lifecycle, this one never resets.
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
    console.error("Invalid ID token on /api/start-trial", err);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }
  const uid = payload.sub;

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Admin SDK for start-trial", err);
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : null;

    if (userData?.trialUsed) {
      return Response.json({ error: "You've already used your free trial." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateLimitResult = await checkAndRecordRateLimit(db, `trial-start:${ip}`, TRIAL_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      console.error(`Rate limit hit on /api/start-trial for IP ${ip}`);
      return Response.json(
        { error: "Too many trial requests from this network. Please try again later." },
        { status: 429 }
      );
    }

    const trialEndsAt = new Date();
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + 14);

    await userRef.set(
      {
        plan: TRIAL_TIER,
        subscriptionStatus: "trialing",
        trialEndsAt: trialEndsAt.toISOString(),
        trialUsed: true,
      },
      { merge: true }
    );

    return Response.json({ ok: true, trialEndsAt: trialEndsAt.toISOString() });
  } catch (err) {
    console.error("Failed to start trial", err);
    Sentry.captureException(err, { tags: { route: "start-trial" } });
    return Response.json({ error: "Failed to start trial" }, { status: 500 });
  }
}
