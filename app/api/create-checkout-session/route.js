import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { paystackFetch } from "../../../lib/paystack";
import { getAdminDb } from "../../../lib/firebaseAdmin";

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

  const planCode = process.env.PAYSTACK_PLAN_CODE;
  if (!planCode) {
    console.error("PAYSTACK_PLAN_CODE is not configured");
    return Response.json({ error: "Billing not configured" }, { status: 500 });
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
        metadata: JSON.stringify({ firebaseUid: uid }),
      }),
    });

    return Response.json({ url: initRes.data.authorization_url });
  } catch (err) {
    console.error("Failed to create Paystack checkout transaction", err);
    return Response.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
