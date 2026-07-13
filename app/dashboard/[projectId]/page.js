"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { inviteTeammate, resendInvite, markInviteStatus } from "../../../lib/invites";
import { notifyAssignment } from "../../../lib/notifications";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const INVITE_STATUS_STYLES = {
  pending: { background: "#fef3c7", color: "var(--amber)" },
  accepted: { background: "#dcfce7", color: "var(--green)" },
  left: { background: "#e2e8f0", color: "var(--slate-500)" },
  removed: { background: "#fee2e2", color: "var(--red)" },
};

const COLUMN_LABELS = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label]));

function formatActivityText(item) {
  if (item.type === "created") return "created this task";
  if (item.type === "moved") {
    const from = COLUMN_LABELS[item.fromStatus] || item.fromStatus;
    const to = COLUMN_LABELS[item.toStatus] || item.toStatus;
    return `moved this from ${from} to ${to}`;
  }
  if (item.type === "assigned") {
    return item.assigneeName ? `assigned this to ${item.assigneeName}` : "unassigned this task";
  }
  if (item.type === "due-date") {
    return item.dueDate ? `set the due date to ${item.dueDate}` : "cleared the due date";
  }
  return "made a change";
}

// "YYYY-MM-DD" string compare is safe here since both sides are the same
// fixed format — avoids Timestamp/timezone handling for what's just a
// calendar-day due date, not a precise moment in time.
function isOverdue(dueDate) {
  if (!dueDate) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  return dueDate < todayStr;
}

// Merges the comment thread and the system activity log into one
// chronological timeline for the task detail view. Firestore can't
// natively order two different subcollections together, so this is done
// client-side. createdAt is a serverTimestamp() and briefly reads back as
// null on the client before the server round-trip confirms it — falling
// back to "now" for sorting purposes just means a just-posted item shows
// up at the end until the real timestamp arrives a moment later.
function buildTimeline(comments, activity) {
  const items = [
    ...comments.map((c) => ({ ...c, kind: "comment" })),
    ...activity.map((a) => ({ ...a, kind: "activity" })),
  ];
  items.sort((a, b) => {
    const aMillis = a.createdAt?.toMillis?.() ?? Date.now();
    const bMillis = b.createdAt?.toMillis?.() ?? Date.now();
    return aMillis - bMillis;
  });
  return items;
}

export default function ProjectBoardPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading...</div>}>
      <ProjectBoardPageInner />
    </Suspense>
  );
}

function ProjectBoardPageInner() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("board");
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [invites, setInvites] = useState([]);
  const [resendingId, setResendingId] = useState(null);
  const [resendMsg, setResendMsg] = useState({});
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const unsubProject = onSnapshot(
      doc(db, "projects", projectId),
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        setProject({ id: snap.id, ...snap.data() });
      },
      (err) => {
        console.error("Failed to load project", err);
        setLoadError("Couldn't load this project. Please refresh the page.");
      }
    );
    const q = query(
      collection(db, "projects", projectId, "tasks"),
      orderBy("createdAt", "asc")
    );
    const unsubTasks = onSnapshot(
      q,
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to load tasks", err);
        setLoadError("Couldn't load tasks for this project. Please refresh the page.");
      }
    );
    return () => {
      unsubProject();
      unsubTasks();
    };
  }, [projectId, user, loading, router]);

  // Deep-link from the dashboard search: /dashboard/{id}?task={taskId}
  // should open straight to that task's detail modal. Guarded with a ref
  // so it only fires once — otherwise re-running this every time `tasks`
  // updates (e.g. after posting a comment) would re-open a modal the user
  // deliberately closed.
  const didAutoOpenTask = useRef(false);
  useEffect(() => {
    if (didAutoOpenTask.current) return;
    const wantedTaskId = searchParams.get("task");
    if (!wantedTaskId) return;
    if (tasks.some((t) => t.id === wantedTaskId)) {
      setSelectedTaskId(wantedTaskId);
      didAutoOpenTask.current = true;
    }
  }, [tasks, searchParams]);

  useEffect(() => {
    if (!project?.memberIds?.length) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    async function loadMembers() {
      const rows = [];
      for (const uid of project.memberIds) {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : null;
        rows.push({
          uid,
          email: data?.email || "(unknown)",
          displayName: data?.displayName || "",
          role: project.roles?.[uid] || "member",
          // Missing field = never explicitly opted out = notifications on.
          emailNotifications: data?.emailNotifications !== false,
        });
      }
      if (!cancelled) setMembers(rows);
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [project]);

  useEffect(() => {
    // Only the owner ever sees this (gated below in the JSX too), and every
    // invite for a project is always created with invitedBy == that
    // project's owner (enforced by the security rules), so this query only
    // ever runs as the one user for whom every matching doc satisfies the
    // rules — it isn't a query any non-owner could run.
    if (!user || !project || project.ownerId !== user.uid) {
      setInvites([]);
      return;
    }
    const q = query(
      collection(db, "invites"),
      where("projectId", "==", projectId),
      where("invitedBy", "==", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to load invites", err);
      }
    );
    return () => unsub();
  }, [user, project, projectId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setComments([]);
      setCommentsError("");
      return;
    }
    const q = query(
      collection(db, "projects", projectId, "tasks", selectedTaskId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCommentsError("");
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to load comments", err);
        setCommentsError("Couldn't load comments. Please try again.");
      }
    );
    return () => unsub();
  }, [selectedTaskId, projectId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setActivity([]);
      return;
    }
    const q = query(
      collection(db, "projects", projectId, "tasks", selectedTaskId, "activity"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to load activity", err);
      }
    );
    return () => unsub();
  }, [selectedTaskId, projectId]);

  // Best-effort system-log write. Never throws — a failed activity-log
  // entry shouldn't undo the actual task write it's describing, which
  // already succeeded by the time this is called.
  async function logActivity(taskId, entry) {
    try {
      await addDoc(collection(db, "projects", projectId, "tasks", taskId, "activity"), {
        ...entry,
        actorId: user.uid,
        actorName: user.displayName || "",
        actorEmail: user.email || "",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to log activity", err);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !selectedTaskId) return;
    setCommentBusy(true);
    try {
      await addDoc(
        collection(db, "projects", projectId, "tasks", selectedTaskId, "comments"),
        {
          text: newComment.trim(),
          authorId: user.uid,
          authorName: user.displayName || "",
          authorEmail: user.email || "",
          createdAt: serverTimestamp(),
        }
      );
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment", err);
      window.alert("Couldn't post that comment. Please try again.");
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleDeleteComment(commentId) {
    if (!selectedTaskId) return;
    try {
      await deleteDoc(
        doc(db, "projects", projectId, "tasks", selectedTaskId, "comments", commentId)
      );
    } catch (err) {
      console.error("Failed to delete comment", err);
      window.alert("Couldn't delete that comment. Please try again.");
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const ref = await addDoc(collection(db, "projects", projectId, "tasks"), {
        title: newTitle.trim(),
        status: "todo",
        createdAt: serverTimestamp(),
      });
      setNewTitle("");
      logActivity(ref.id, { type: "created" });
    } catch (err) {
      console.error("Failed to add task", err);
      window.alert("Couldn't add that task. Please try again.");
    }
  }

  async function moveTask(taskId, direction) {
    const idx = tasks.findIndex((t) => t.id === taskId);
    const currentStatus = tasks[idx].status;
    const colIdx = COLUMNS.findIndex((c) => c.key === currentStatus);
    const nextIdx = colIdx + direction;
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;
    const nextStatus = COLUMNS[nextIdx].key;
    try {
      await updateDoc(doc(db, "projects", projectId, "tasks", taskId), {
        status: nextStatus,
      });
      logActivity(taskId, { type: "moved", fromStatus: currentStatus, toStatus: nextStatus });
    } catch (err) {
      console.error("Failed to move task", err);
      window.alert("Couldn't move that task. Please try again.");
    }
  }

  async function handleAssign(taskId, assigneeId) {
    try {
      await updateDoc(doc(db, "projects", projectId, "tasks", taskId), {
        assigneeId: assigneeId || null,
      });
      const assignee = assigneeId ? members.find((m) => m.uid === assigneeId) : null;
      logActivity(taskId, {
        type: "assigned",
        assigneeId: assigneeId || null,
        assigneeName: assignee ? assignee.displayName || assignee.email : "",
      });
      // Don't email someone for assigning a task to themselves, and respect
      // their notification preference before ever hitting the API route.
      if (assignee && assignee.uid !== user.uid && assignee.emailNotifications && assignee.email) {
        const task = tasks.find((t) => t.id === taskId);
        notifyAssignment({
          to: assignee.email,
          taskTitle: task?.title || "a task",
          projectName: project.name,
          projectId,
          taskId,
          assignedByName: user.displayName || user.email || "Someone",
        });
      }
    } catch (err) {
      console.error("Failed to assign task", err);
      window.alert("Couldn't update the assignee. Please try again.");
    }
  }

  async function handleSetDueDate(taskId, dueDate) {
    try {
      await updateDoc(doc(db, "projects", projectId, "tasks", taskId), {
        dueDate: dueDate || null,
      });
      logActivity(taskId, { type: "due-date", dueDate: dueDate || null });
    } catch (err) {
      console.error("Failed to set due date", err);
      window.alert("Couldn't update the due date. Please try again.");
    }
  }

  async function removeTask(taskId) {
    try {
      // Same orphan-data issue fixed earlier for whole-project deletion:
      // Firestore never cascade-deletes subcollections, so deleting the
      // task doc alone would leave its comments and activity log behind
      // forever as invisible, unreachable documents. Clean those up first.
      const [commentsSnap, activitySnap] = await Promise.all([
        getDocs(collection(db, "projects", projectId, "tasks", taskId, "comments")),
        getDocs(collection(db, "projects", projectId, "tasks", taskId, "activity")),
      ]);
      await Promise.all([
        ...commentsSnap.docs.map((d) => deleteDoc(d.ref)),
        ...activitySnap.docs.map((d) => deleteDoc(d.ref)),
      ]);
      await deleteDoc(doc(db, "projects", projectId, "tasks", taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } catch (err) {
      console.error("Failed to delete task", err);
      window.alert("Couldn't delete that task. Please try again.");
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteMsg("");
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      const result = await inviteTeammate({
        projectId,
        projectName: project.name,
        email: inviteEmail,
        invitedBy: user.uid,
      });
      const base =
        result.status === "added"
          ? "Added — they already have a Sprintora account."
          : "Invite saved — they'll be added automatically when they sign up with this email.";
      setInviteMsg(
        result.emailResult?.ok
          ? `${base} Notification email sent.`
          : `${base} (Email not sent: ${result.emailResult?.error || "unknown error"} — use Resend below to retry.)`
      );
      setInviteEmail("");
    } catch (err) {
      console.error("Failed to save invite", err);
      setInviteMsg(`Something went wrong saving that invite: ${err?.message || "unknown error"}`);
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleResend(invite) {
    setResendingId(invite.id);
    setResendMsg((m) => ({ ...m, [invite.id]: "" }));
    try {
      const result = await resendInvite(invite);
      setResendMsg((m) => ({
        ...m,
        [invite.id]: result.ok ? "Email sent." : `Failed: ${result.error || "unknown error"}`,
      }));
    } finally {
      setResendingId(null);
    }
  }

  async function removeMember(uid) {
    if (uid === project.ownerId) {
      window.alert("The project owner can't be removed. Delete the project instead, or transfer ownership first.");
      return;
    }
    try {
      await updateDoc(doc(db, "projects", projectId), {
        memberIds: arrayRemove(uid),
      });
      const removed = members.find((m) => m.uid === uid);
      if (removed?.email) {
        await markInviteStatus(projectId, removed.email, "removed");
      }
    } catch (err) {
      console.error("Failed to remove member", err);
      window.alert("Couldn't remove that member. Please try again.");
    }
  }

  // Self-removal ("Leave project"). Distinct from removeMember: the security
  // rules only allow a member to remove themselves (not anyone else), and
  // once it succeeds the caller immediately loses read access to this
  // project doc (the read rule requires being in memberIds), so — unlike
  // an owner removing someone else — this has to navigate the leaving
  // member away rather than just letting the page re-render in place.
  async function handleLeaveProject() {
    if (!window.confirm(`Leave "${project.name}"? You'll lose access unless you're invited back.`)) {
      return;
    }
    try {
      await updateDoc(doc(db, "projects", projectId), {
        memberIds: arrayRemove(user.uid),
      });
      if (user.email) {
        await markInviteStatus(projectId, user.email, "left");
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to leave project", err);
      window.alert("Couldn't leave the project. Please try again.");
    }
  }

  async function handleDeleteProject() {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      // Firestore never cascade-deletes subcollections: deleting the project
      // doc alone leaves every task underneath it as an orphaned, invisible
      // document taking up storage forever — and each task now has its own
      // comments and activity subcollections one level deeper, which have
      // the exact same problem. Clean up bottom-up: comments/activity for
      // every task, then the tasks themselves, then the project.
      const tasksSnap = await getDocs(collection(db, "projects", projectId, "tasks"));
      await Promise.all(
        tasksSnap.docs.map(async (t) => {
          const [commentsSnap, activitySnap] = await Promise.all([
            getDocs(collection(db, "projects", projectId, "tasks", t.id, "comments")),
            getDocs(collection(db, "projects", projectId, "tasks", t.id, "activity")),
          ]);
          await Promise.all([
            ...commentsSnap.docs.map((d) => deleteDoc(d.ref)),
            ...activitySnap.docs.map((d) => deleteDoc(d.ref)),
          ]);
          await deleteDoc(t.ref);
        })
      );
      await deleteDoc(doc(db, "projects", projectId));
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to delete project", err);
      window.alert("Couldn't delete the project. Please try again.");
    }
  }

  if (loading || !user) return <div className="loading-screen">Loading...</div>;
  if (notFound) {
    return (
      <div className="loading-screen">
        Project not found, or you don&apos;t have access to it.
      </div>
    );
  }
  if (loadError && !project) return <div className="loading-screen">{loadError}</div>;
  if (!project) return <div className="loading-screen">Loading project...</div>;

  const isMember = (project.memberIds || []).includes(user.uid);
  if (!isMember) {
    return <div className="loading-screen">You don&apos;t have access to this project.</div>;
  }
  const isOwner = project.ownerId === user.uid;

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="logo">
          <div className="logo-mark">S</div>Sprintora
        </div>
        <Link href="/dashboard" className="btn btn-secondary">
          &larr; All projects
        </Link>
      </div>
      <div className="app-main">
        {loadError && (
          <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{loadError}</p>
        )}
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>{project.name}</h1>
        <p style={{ fontSize: 13, color: "var(--slate-500)" }}>
          {members.length} member{members.length === 1 ? "" : "s"}
        </p>

        <div className="tabs">
          <button className={`tab ${tab === "board" ? "active" : ""}`} onClick={() => setTab("board")}>
            Board
          </button>
          <button className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>
            Team
          </button>
        </div>

        {tab === "board" && (
          <>
            <form className="add-task-form" style={{ marginTop: 20 }} onSubmit={handleAddTask}>
              <input
                placeholder="Add a task..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>

            <div className="board">
              {COLUMNS.map((col, colIdx) => (
                <div className="board-col" key={col.key}>
                  <h4>{col.label}</h4>
                  {tasks
                    .filter((t) => t.status === col.key)
                    .map((t) => (
                      <div
                        className="task-card"
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {t.title}
                        {(t.assigneeId || t.dueDate) && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                            {t.assigneeId && (
                              <span style={{ fontSize: 11, color: "var(--slate-500)" }}>
                                {(() => {
                                  const a = members.find((m) => m.uid === t.assigneeId);
                                  return a ? a.displayName || a.email : "Unknown";
                                })()}
                              </span>
                            )}
                            {t.dueDate && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: isOverdue(t.dueDate) ? "var(--red)" : "var(--slate-500)",
                                  fontWeight: isOverdue(t.dueDate) ? 700 : 400,
                                }}
                              >
                                Due {t.dueDate}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="task-actions">
                          {colIdx > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); moveTask(t.id, -1); }}>
                              &larr; Move
                            </button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <button onClick={(e) => { e.stopPropagation(); moveTask(t.id, 1); }}>
                              Move &rarr;
                            </button>
                          )}
                          <button
                            className="danger"
                            onClick={(e) => { e.stopPropagation(); removeTask(t.id); }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "team" && (
          <div className="team-panel">
            {isOwner && (
              <>
                <form className="invite-form" onSubmit={handleInvite}>
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={inviteBusy}>
                    {inviteBusy ? "Inviting..." : "Invite"}
                  </button>
                </form>
                {inviteMsg && <p className="invite-note">{inviteMsg}</p>}
              </>
            )}

            {isOwner && invites.length > 0 && (
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--slate-500)", marginBottom: 10 }}>
                  Invites sent
                </h4>
                <div className="member-list">
                  {invites.map((inv) => (
                    <div className="member-row" key={inv.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                        <div className="member-info">
                          <span className="member-email">{inv.email}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            className="role-badge"
                            style={INVITE_STATUS_STYLES[inv.status] || INVITE_STATUS_STYLES.pending}
                          >
                            {inv.status}
                          </span>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleResend(inv)}
                            disabled={resendingId === inv.id}
                          >
                            {resendingId === inv.id ? "Resending..." : "Resend"}
                          </button>
                        </div>
                      </div>
                      {resendMsg[inv.id] && (
                        <p style={{ fontSize: 12, color: "var(--slate-500)", marginTop: 4 }}>
                          {resendMsg[inv.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="member-list" style={{ marginTop: 20 }}>
              {members.map((m) => (
                <div className="member-row" key={m.uid}>
                  <div className="member-info">
                    <span className="member-email">{m.displayName || m.email}</span>
                    {m.displayName && (
                      <span style={{ fontSize: 12, color: "var(--slate-500)" }}>{m.email}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`role-badge ${m.role === "owner" ? "owner" : ""}`}>
                      {m.role}
                    </span>
                    {isOwner && m.uid !== project.ownerId && (
                      <button className="btn btn-sm btn-secondary" onClick={() => removeMember(m.uid)}>
                        Remove
                      </button>
                    )}
                    {!isOwner && m.uid === user.uid && (
                      <button className="btn btn-sm btn-secondary" onClick={handleLeaveProject}>
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isOwner && (
              <div className="danger-zone">
                <h4>Danger zone</h4>
                <button className="btn btn-danger" onClick={handleDeleteProject}>
                  Delete this project
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTaskId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setSelectedTaskId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              width: "min(480px, 90vw)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18 }}>
                {tasks.find((t) => t.id === selectedTaskId)?.title || "Task"}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedTaskId(null)}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                <label>Assignee</label>
                <select
                  value={tasks.find((t) => t.id === selectedTaskId)?.assigneeId || ""}
                  onChange={(e) => handleAssign(selectedTaskId, e.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName || m.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                <label>Due date</label>
                <input
                  type="date"
                  value={tasks.find((t) => t.id === selectedTaskId)?.dueDate || ""}
                  onChange={(e) => handleSetDueDate(selectedTaskId, e.target.value || null)}
                />
              </div>
            </div>

            <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--slate-500)", marginBottom: 10 }}>
              Activity
            </h4>

            {commentsError && (
              <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{commentsError}</p>
            )}

            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {buildTimeline(comments, activity).length === 0 && !commentsError && (
                <p style={{ color: "var(--slate-500)", fontSize: 13 }}>Nothing here yet.</p>
              )}
              {buildTimeline(comments, activity).map((item) =>
                item.kind === "comment" ? (
                  <div key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {item.authorName || item.authorEmail || "Someone"}
                      </span>
                      {item.authorId === user.uid && (
                        <button
                          style={{
                            fontSize: 12,
                            color: "var(--red)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onClick={() => handleDeleteComment(item.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 14, marginTop: 4, whiteSpace: "pre-wrap" }}>{item.text}</p>
                  </div>
                ) : (
                  <p key={item.id} style={{ fontSize: 12, color: "var(--slate-500)", fontStyle: "italic", marginBottom: 10 }}>
                    {item.actorName || item.actorEmail || "Someone"} {formatActivityText(item)}
                  </p>
                )
              )}
            </div>

            <form onSubmit={handleAddComment} className="comment-form" style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={commentBusy}>
                {commentBusy ? "Posting..." : "Post"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
