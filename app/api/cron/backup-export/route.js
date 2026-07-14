import nodemailer from "nodemailer";
import * as Sentry from "@sentry/nextjs";
import { getAdminDb } from "../../../../lib/firebaseAdmin";

// Deliberately NOT Firebase's native scheduled-backup feature — that
// requires the paid Blaze plan (and, as of a February 2026 policy change,
// Blaze is required for any Cloud Storage bucket at all, which the native
// feature writes into). This is the DIY alternative: walk every collection
// via the Admin SDK (Firestore reads stay well within the free Spark daily
// quota at pilot scale) and email the full dump as a JSON attachment via
// the same Gmail SMTP account already used for other notifications. No new
// service, no new env var, no Blaze plan required.
//
// This is data-loss insurance, not a restore tool — there is no matching
// "import this JSON back into Firestore" script. If a real restore is ever
// needed, the most recent emailed JSON is the source of truth to restore
// from; write a one-off import script against it at that time rather than
// building one speculatively now.
function serializeValue(value) {
  if (value && typeof value.toDate === "function") {
    // Firestore Timestamp
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

async function dumpCollection(db, path) {
  const snap = await db.collection(path).get();
  return snap.docs.map((d) => ({ id: d.id, ...serializeValue(d.data()) }));
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("Rejected /api/cron/backup-export: missing or invalid CRON_SECRET header");
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
    console.error("Failed to init Firebase Admin for backup-export cron", err);
    return Response.json({ error: "Admin SDK not configured" }, { status: 500 });
  }

  try {
    const backup = { exportedAt: new Date().toISOString() };

    backup.users = await dumpCollection(db, "users");
    backup.invites = await dumpCollection(db, "invites");

    const projectsSnap = await db.collection("projects").get();
    backup.projects = [];
    for (const projectDoc of projectsSnap.docs) {
      const project = { id: projectDoc.id, ...serializeValue(projectDoc.data()) };
      const tasksSnap = await projectDoc.ref.collection("tasks").get();
      project.tasks = [];
      for (const taskDoc of tasksSnap.docs) {
        const task = { id: taskDoc.id, ...serializeValue(taskDoc.data()) };
        const [commentsSnap, activitySnap] = await Promise.all([
          taskDoc.ref.collection("comments").get(),
          taskDoc.ref.collection("activity").get(),
        ]);
        task.comments = commentsSnap.docs.map((d) => ({ id: d.id, ...serializeValue(d.data()) }));
        task.activity = activitySnap.docs.map((d) => ({ id: d.id, ...serializeValue(d.data()) }));
        project.tasks.push(task);
      }
      backup.projects.push(project);
    }

    const json = JSON.stringify(backup, null, 2);
    const sizeMb = Buffer.byteLength(json, "utf8") / (1024 * 1024);

    // Gmail's attachment limit is ~25MB. Nowhere close at pilot scale, but
    // fail loudly instead of silently truncating if that ever changes — a
    // corrupted/truncated backup that looks successful is worse than no
    // backup at all, since it creates false confidence.
    if (sizeMb > 20) {
      const msg = `Backup export is ${sizeMb.toFixed(1)}MB — approaching Gmail's attachment limit. This backup method needs to move to external storage soon.`;
      console.error(msg);
      Sentry.captureMessage(msg, "warning");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const taskCount = backup.projects.reduce((n, p) => n + p.tasks.length, 0);
    await transporter.sendMail({
      from: `Sprintora Backups <${gmailUser}>`,
      to: gmailUser,
      subject: `Sprintora Firestore backup — ${dateStr}`,
      text: `Automated daily backup.\n\nUsers: ${backup.users.length}\nProjects: ${backup.projects.length}\nTasks: ${taskCount}\nInvites: ${backup.invites.length}\nSize: ${sizeMb.toFixed(2)}MB\n\nThis is a raw data dump, not a one-click restore. Keep it somewhere safe.`,
      attachments: [
        {
          filename: `sprintora-backup-${dateStr}.json`,
          content: json,
          contentType: "application/json",
        },
      ],
    });

    return Response.json({
      ok: true,
      users: backup.users.length,
      projects: backup.projects.length,
      tasks: taskCount,
      invites: backup.invites.length,
      sizeMb: Number(sizeMb.toFixed(2)),
    });
  } catch (err) {
    console.error("Failed to run backup export", err);
    Sentry.captureException(err, { tags: { route: "cron/backup-export" } });
    return Response.json({ error: "Backup export failed" }, { status: 500 });
  }
}
