import { auth } from "./firebase";

// Best-effort — mirrors notifyInvite() in lib/invites.js. A failed
// notification email should never undo the assignment write itself, which
// has already succeeded by the time this runs. Returns a result object so
// the caller can log/surface a real failure instead of it vanishing.
export async function notifyAssignment({
  to,
  taskTitle,
  projectName,
  projectId,
  taskId,
  assignedByName,
}) {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      console.error("notifyAssignment: no signed-in user / ID token available");
      return { ok: false, error: "Not signed in" };
    }
    const res = await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ to, taskTitle, projectName, projectId, taskId, assignedByName }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        // ignore
      }
      console.error("notifyAssignment: /api/send-notification responded", res.status, detail);
      return { ok: false, error: `Email service error (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to send assignment email", err);
    return { ok: false, error: err?.message || "Network error" };
  }
}
