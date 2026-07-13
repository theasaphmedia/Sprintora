import { jwtVerify, createRemoteJWKSet } from "jose";

const FIREBASE_PROJECT_ID = "sprintora-cda3a";

// Verifies a Firebase ID token's signature against Google's public keys for
// the securetoken service, without needing the Firebase Admin SDK (which
// would require a service-account credential as another secret to manage).
// This confirms the request comes from a genuinely signed-in Sprintora user
// — it does NOT confirm that user owns any particular project or task.
// Shared by every API route that just needs "is this a real signed-in
// user," e.g. /api/send-invite and /api/send-notification. Routes that need
// cross-user admin access with no signed-in caller at all (the due-soon
// cron job) use lib/firebaseAdmin.js instead — a deliberately separate,
// more powerful credential kept out of the normal request path.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export async function verifyFirebaseIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  return payload;
}
