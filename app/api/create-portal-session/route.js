import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { paystackFetch } from "../../../lib/paystack";
import { getAdminDb } from "../../../lib/firebaseAdmin";

// Paystack's closest equivalent to Stripe's Customer Portal: a hosted page,
// scoped to one subscription, where the customer can update their card,
// switch to direct debit, or cancel. Narrower than Stripe's portal (no
// invoice history, no plan switching), but it's what Paystack provides —
// not something to build a custom replacement for.
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
    console.error("Invalid ID token on /api/create-portal-session", err);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }
  const uid = payload.sub;

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Admin SDK for portal session", err);
    return Response.json({ error: "Billing not configured" }, { status: 500 });
  }

  try {
    const userSnap = await db.collection("users").doc(uid).get();
    const subscriptionCode = userSnap.exists ? userSnap.data()?.paystackSubscriptionCode : null;
    if (!subscriptionCode) {
      return Response.json({ error: "No subscription found for this user yet" }, { status: 400 });
    }

    const linkRes = await paystackFetch(`/subscription/${subscriptionCode}/manage/link`, {
      method: "GET",
    });

    return Response.json({ url: linkRes.data.link });
  } catch (err) {
    console.error("Failed to create Paystack manage-subscription link", err);
    return Response.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
