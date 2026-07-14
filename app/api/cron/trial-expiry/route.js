import * as Sentry from "@sentry/nextjs";
import { getAdminDb } from "../../../../lib/firebaseAdmin";

// Triggered daily by Vercel Cron (see vercel.json). Since the trial never
// collects a card (see /api/start-trial), there's no payment to fail and no
// Paystack event to react to when a trial simply runs out — this cron is
// the only thing that actually ends a card-less trial. Anyone still
// "trialing" whose trialEndsAt has passed never added a card in time, so
// they're reverted to the free plan. Anyone who added a card before their
// trial ended has already been moved to subscriptionStatus "active" by the
// Paystack webhook (see app/api/webhooks/paystack), so this query never
// touches them.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("Rejected /api/cron/trial-expiry: missing or invalid CRON_SECRET header");
    return new Response("Unauthorized", { status: 401 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Firebase Admin for trial-expiry cron", err);
    return Response.json({ error: "Admin SDK not configured" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  let snap;
  try {
    snap = await db
      .collection("users")
      .where("subscriptionStatus", "==", "trialing")
      .where("trialEndsAt", "<=", nowIso)
      .get();
  } catch (err) {
    console.error("Failed to query expired trials (may need a Firestore index — see error for a create-index link)", err);
    // A cron nobody's watching in real time failing silently is exactly the
    // case Sentry exists for — Vercel's own log would otherwise be the only
    // place this ever shows up, and nobody checks that daily.
    Sentry.captureException(err, { tags: { route: "cron/trial-expiry" } });
    return Response.json({ error: "Query failed" }, { status: 500 });
  }

  let expired = 0;
  for (const doc of snap.docs) {
    try {
      await doc.ref.set({ plan: "beta", subscriptionStatus: "expired" }, { merge: true });
      expired++;
    } catch (err) {
      console.error(`Failed to expire trial for user ${doc.id}`, err);
    }
  }

  return Response.json({ ok: true, expired });
}
