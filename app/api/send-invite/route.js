import nodemailer from "nodemailer";
import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { escapeHtml } from "../../../lib/emailUtils";

// Token verification note (kept from before the shared helper existed): this
// confirms the request comes from a genuinely signed-in Sprintora user — it
// does NOT confirm that user actually owns the project being invited to.
// Adding that check would mean either the Admin SDK + service account, or
// re-deriving the same read via the Firestore REST API with this token (so
// the existing security rules do the check). Left as a follow-up: the
// practical abuse surface today is "a signed-in Sprintora user can trigger
// an invite email to an arbitrary address," not "anyone on the internet."

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

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD is not configured");
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
    // Sends via the user's own Gmail account over SMTP using an App
    // Password — no domain verification needed (unlike Resend/most
    // transactional-email APIs), because delivery rides on Gmail's own,
    // already-trusted sending reputation. Free tier: 500 emails/day.
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    });

    await transporter.sendMail({
      from: `Sprintora <${gmailUser}>`,
      to,
      subject,
      html,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Failed to send via Gmail SMTP", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
