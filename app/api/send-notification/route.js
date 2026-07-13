import nodemailer from "nodemailer";
import { verifyFirebaseIdToken } from "../../../lib/serverAuth";
import { escapeHtml } from "../../../lib/emailUtils";

// Fires when a task gets assigned to someone. Same trust model as
// /api/send-invite: confirms the caller is a genuinely signed-in Sprintora
// user, but not that they're actually a member of the project the task
// belongs to. The client (app/dashboard/[projectId]/page.js) is what decides
// whether to call this at all — it already checks the assignee's own
// emailNotifications preference before calling, so an opted-out user never
// even generates a request here.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return Response.json({ error: "Missing auth token" }, { status: 401 });
  }

  try {
    await verifyFirebaseIdToken(idToken);
  } catch (err) {
    console.error("Invalid ID token on /api/send-notification", err);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { to, taskTitle, projectName, projectId, taskId, assignedByName } = body || {};
  if (!to || !taskTitle || !projectName || !projectId || !taskId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD is not configured");
    return Response.json({ error: "Email service not configured" }, { status: 500 });
  }

  const link = `https://sprintora-nine.vercel.app/dashboard/${projectId}?task=${taskId}`;
  const subject = `You were assigned "${taskTitle}" in ${projectName}`;
  const html = `
    <p>${escapeHtml(assignedByName || "Someone")} assigned you a task in <strong>${escapeHtml(projectName)}</strong>:</p>
    <p style="font-size:16px"><strong>${escapeHtml(taskTitle)}</strong></p>
    <p><a href="${link}">Open it in Sprintora</a></p>
  `;

  try {
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
    console.error("Failed to send assignment email via Gmail SMTP", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
