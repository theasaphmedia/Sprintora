import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Only used by server-only routes that need Firestore access across every
// user's data with no signed-in caller to check against (currently just the
// due-soon reminder cron job in app/api/cron/due-soon). Every other API
// route deliberately avoids this and uses lib/serverAuth.js's ID-token
// verification instead, precisely because this credential can read/write
// anything in the database — the blast radius of it leaking is much larger,
// so it's kept out of every route that doesn't strictly need it.
//
// Requires the FIREBASE_SERVICE_ACCOUNT_JSON env var: the full JSON key
// downloaded from Firebase Console → Project Settings → Service Accounts →
// Generate new private key, pasted in as-is (it's already valid JSON text,
// including an escaped \n inside the private_key field — no reformatting
// needed).
let cachedApp;

export function getAdminDb() {
  if (!cachedApp) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
    }
    const serviceAccount = JSON.parse(raw);
    cachedApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore(cachedApp);
}
