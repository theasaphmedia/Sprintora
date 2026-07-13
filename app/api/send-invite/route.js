import { jwtVerify, createRemoteJWKSet } from "jose";

const FIREBASE_PROJECT_ID = "sprintora-cda3a";

// Verifies the Firebase ID token's signature against Google's public keys
// for the securetoken service, without needing the Firebase Admin SDK (which
// would require a service-account credential as another secret to manage).
// This confirms the request comes from a genuinely signed-in Sprintora user
// — it does NOT confirm that user actually owns the project being invited
// to. Adding that check would mean either the Admin SDK + service account,
// or re-deriving the same read via the Firestore REST API with this token
// (so the existing security rules do the check). Left as a follow-up: the
// practical abuse surface today is "a signed-in Sprintora user can trigger
// an invite email to an arbitrary address," not "anyone on the internet."
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

async function verifyFirebaseIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  return payload;
}

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return Response.json({ error: "Missing auth token" }, { status: 401 });
  }

  try {
    await verifyFirebaseIdToken(idToken);
  } catch (err) {
    console.error("Invalid ID token on /api/send-invite", err);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { to, projectName, alreadyMember } = body || {};
  if (!to || !projectName) {
    return Response.json({ error: "Missing to/projectName" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured");
    return Response.json({ error: "Email service not configured" }, { status: 500 });
  }

  const subject = alreadyMember
    ? `You've been added to "${projectName}" on Sprintora`
    : `You've been invited to join "${projectName}" on Sprintora`;

  const html = alreadyMember
    ? `<p>You've been added to the project <strong>${escapeHtml(projectName)}</strong> on Sprintora.</p>
       <p>Log in to see it: <a href="https://sprintora-nine.vercel.app/login">sprintora-nine.vercel.app</a></p>`
    : `<p>You've been invited to join the project <strong>${escapeHtml(projectName)}</strong> on Sprintora.</p>
       <p>Sign up with this email address and you'll be added automatically:
       <a href="https://sprintora-nine.vercel.app/signup">sprintora-nine.vercel.app</a></p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Sprintora <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend API error", res.status, errBody);
      return Response.json({ error: "Failed to send email" }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Failed to call Resend", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
