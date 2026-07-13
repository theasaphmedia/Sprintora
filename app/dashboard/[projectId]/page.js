"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { inviteTeammate } from "../../../lib/invites";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function ProjectBoardPage() {
  const { projectId } = useParams();
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

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await addDoc(collection(db, "projects", projectId, "tasks"), {
        title: newTitle.trim(),
        status: "todo",
        createdAt: serverTimestamp(),
      });
      setNewTitle("");
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
    try {
      await updateDoc(doc(db, "projects", projectId, "tasks", taskId), {
        status: COLUMNS[nextIdx].key,
      });
    } catch (err) {
      console.error("Failed to move task", err);
      window.alert("Couldn't move that task. Please try again.");
    }
  }

  async function removeTask(taskId) {
    try {
      await deleteDoc(doc(db, "projects", projectId, "tasks", taskId));
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
      setInviteMsg(
        result.status === "added"
          ? "Added — they already have a Sprintora account."
          : "Invite saved — they'll be added automatically when they sign up with this email."
      );
      setInviteEmail("");
    } catch (err) {
      setInviteMsg("Something went wrong sending that invite.");
    } finally {
      setInviteBusy(false);
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
    } catch (err) {
      console.error("Failed to remove member", err);
      window.alert("Couldn't remove that member. Please try again.");
    }
  }

  async function handleDeleteProject() {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      // Firestore never cascade-deletes subcollections: deleting the project
      // doc alone leaves every task underneath it as an orphaned, invisible
      // document taking up storage forever. Clean those up first.
      const tasksSnap = await getDocs(collection(db, "projects", projectId, "tasks"));
      await Promise.all(tasksSnap.docs.map((t) => deleteDoc(t.ref)));
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
                      <div className="task-card" key={t.id}>
                        {t.title}
                        <div className="task-actions">
                          {colIdx > 0 && (
                            <button onClick={() => moveTask(t.id, -1)}>&larr; Move</button>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <button onClick={() => moveTask(t.id, 1)}>Move &rarr;</button>
                          )}
                          <button className="danger" onClick={() => removeTask(t.id)}>
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
                    <div className="member-row" key={inv.id}>
                      <div className="member-info">
                        <span className="member-email">{inv.email}</span>
                      </div>
                      <span
                        className="role-badge"
                        style={
                          inv.status === "accepted"
                            ? { background: "#dcfce7", color: "var(--green)" }
                            : { background: "#fef3c7", color: "var(--amber)" }
                        }
                      >
                        {inv.status}
                      </span>
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
    </div>
  );
}
