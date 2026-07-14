import nodemailer from "nodemailer";
import * as Sentry from "@sentry/nextjs";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { escapeHtml } from "../../../../lib/emailUtils";

// Triggered daily by Vercel Cron (see vercel.json). No signed-in user is
// involved — Vercel automatically sends the CRON_SECRET env var as a Bearer
// token on requests it generates for a scheduled job, so that's what proves
// this call is legitimate rather than a public hit on the URL.
//
// "Due soon" is deliberately a fixed one-day-ahead window (dueDate equals
// tomorrow's date, not "within N days") rather than a rolling range. That
// means a given task matches on exactly one day — the day before it's due —
// so no extra state needs to be tracked to avoid re-notifying the same task
// every day it stays open. This also matches Sprintora's own "sane
// defaults, not notification overload" positioning.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("Rejected /api/cron/due-soon: missing or invalid CRON_SECRET header");
    return new Response("Unauthorized", { status: 401 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD is not configured");
    return Response.json({ error: "Email service not configured" }, { status: 500 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error("Failed to init Firebase Admin for due-soon cron", err);
    return Response.json({ error: "Admin SDK not configured" }, { status: 500 });
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  let tasksSnap;
  try {
    // Requires a collection-group index on "dueDate" for the tasks
    // subcollection — Firestore will reject this with a failed-precondition
    // error (and a console-log link to auto-create it) the first time it
    // runs without one.
    tasksSnap = await db.collectionGroup("tasks").where("dueDate", "==", tomorrowStr).get();
  } catch (err) {
    console.error("Failed to query due-soon tasks (may need a Firestore index — see error for a create-index link)", err);
    Sentry.captureException(err, { tags: { route: "cron/due-soon" } });
    return Response.json({ error: "Query failed" }, { status: 500 });
  }

  const dueTasks = tasksSnap.docs
    .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((t) => t.assigneeId && t.status !== "done");

  if (dueTasks.length === 0) {
    return Response.json({ ok: true, notified: 0, tasksMatched: 0 });
  }

  // Group by assignee so someone with several tasks due tomorrow gets one
  // email, not several — same "no overload" reasoning as above.
  const byAssignee = new Map();
  for (const task of dueTasks) {
    const projectRef = task.ref.parent.parent;
    if (!projectRef) continue;
    if (!byAssignee.has(task.assigneeId)) byAssignee.set(task.assigneeId, []);
    byAssignee.get(task.assigneeId).push({ ...task, projectRef });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  let notified = 0;
  for (const [assigneeId, tasksForAssignee] of byAssignee) {
    try {
      const userSnap = await db.collection("users").doc(assigneeId).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      if (!userData?.email) continue;
      if (userData.emailNotifications === false) continue; // opted out

      const rows = await Promise.all(
        tasksForAssignee.map(async (t) => {
          const projSnap = await t.projectRef.get();
          const projectName = projSnap.exists ? projSnap.data().name : "a project";
          const projectId = t.projectRef.id;
          const link = `https://sprintora-nine.vercel.app/dashboard/${projectId}?task=${t.id}`;
          return `<li><a href="${link}">${escapeHtml(t.title || "Untitled task")}</a> — ${escapeHtml(projectName)}</li>`;
        })
      );

      const count = tasksForAssignee.length;
      await transporter.sendMail({
        from: `Sprintora <${gmailUser}>`,
        to: userData.email,
        subject:
          count === 1
            ? `Due tomorrow: "${tasksForAssignee[0].title || "Untitled task"}"`
            : `${count} tasks due tomorrow on Sprintora`,
        html: `<p>You have ${count} task${count === 1 ? "" : "s"} due tomorrow on Sprintora:</p><ul>${rows.join("")}</ul>`,
      });
      notified++;
    } catch (err) {
      console.error(`Failed to send due-soon email for user ${assigneeId}`, err);
      // Keep going for other assignees rather than failing the whole batch
      // over one bad lookup or send.
    }
  }

  return Response.json({ ok: true, notified, tasksMatched: dueTasks.length });
}
