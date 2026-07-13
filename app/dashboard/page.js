"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { signOut, sendEmailVerification } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";
import { acceptPendingInvites } from "../../lib/invites";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [invitesChecked, setInvitesChecked] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [createError, setCreateError] = useState("");
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [taskIndex, setTaskIndex] = useState(null);
  const [taskIndexLoading, setTaskIndexLoading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setEmailVerified(user.emailVerified);
    if (!invitesChecked) {
      acceptPendingInvites(user).finally(() => setInvitesChecked(true));
    }
  }, [user, loading, router, invitesChecked]);

  async function handleResendVerification() {
    if (!user) return;
    setVerifyMsg("");
    setVerifyBusy(true);
    try {
      await sendEmailVerification(user);
      setVerifyMsg("Verification email sent — check your inbox.");
    } catch (err) {
      setVerifyMsg(
        err?.code === "auth/too-many-requests"
          ? "Already sent recently — check your inbox (and spam folder)."
          : "Couldn't send the email. Please try again shortly."
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handleRefreshVerification() {
    if (!user) return;
    setVerifyMsg("");
    setVerifyBusy(true);
    try {
      await user.reload();
      // Force a fresh ID token so the updated email_verified claim is
      // actually visible to Firestore security rules on the next request —
      // the cached token doesn't pick this up on its own.
      await user.getIdToken(true);
      if (user.emailVerified) {
        setEmailVerified(true);
        setInvitesChecked(false); // re-run acceptPendingInvites now that we're verified
      } else {
        setVerifyMsg("Still not verified — click the link in the email first.");
      }
    } catch (err) {
      setVerifyMsg("Couldn't check verification status. Please try again.");
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !user || !invitesChecked) return;
    const q = query(
      collection(db, "projects"),
      where("memberIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setListError("");
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        // Without this handler, a query failure (e.g. a missing Firestore
        // index) fails completely silently: the listener just never fires
        // again, so the project list looks empty/stuck with no indication
        // anything went wrong. Surface it instead.
        console.error("Failed to load projects", err);
        setListError(
          err?.code === "failed-precondition"
            ? "Couldn't load your projects (missing database index). This has been reported."
            : "Couldn't load your projects. Please refresh the page."
        );
      }
    );
    return () => unsub();
  }, [user, loading, invitesChecked]);

  // Firestore has no built-in full-text/substring search, and a global
  // collectionGroup query across every "tasks" subcollection in the
  // database would be a real privacy hole (it can't be scoped to "tasks in
  // projects I'm a member of" without every task doc separately storing
  // membership info, which they don't). Safe, simple approach for this
  // scale: fetch each of the user's own projects' tasks (already-permitted
  // reads under the existing rules) once, cache client-side, and filter
  // in JS on every keystroke from there. Fine for a handful of projects
  // per user; would need a real search index (Algolia etc.) at real scale.
  async function ensureTaskIndex() {
    if (taskIndex !== null || taskIndexLoading) return;
    setTaskIndexLoading(true);
    try {
      const results = [];
      for (const p of projects) {
        const snap = await getDocs(collection(db, "projects", p.id, "tasks"));
        snap.docs.forEach((d) => {
          results.push({
            id: d.id,
            title: d.data().title || "",
            projectId: p.id,
            projectName: p.name,
          });
        });
      }
      setTaskIndex(results);
    } catch (err) {
      console.error("Failed to build task search index", err);
      setTaskIndex([]);
    } finally {
      setTaskIndexLoading(false);
    }
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const matchingProjects = isSearching
    ? projects.filter((p) => p.name.toLowerCase().includes(trimmedQuery))
    : [];
  const matchingTasks = isSearching
    ? (taskIndex || []).filter((t) => t.title.toLowerCase().includes(trimmedQuery))
    : [];

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setCreating(true);
    setCreateError("");
    try {
      await addDoc(collection(db, "projects"), {
        name: newName.trim(),
        ownerId: user.uid,
        memberIds: [user.uid],
        roles: { [user.uid]: "owner" },
        createdAt: serverTimestamp(),
      });
      setNewName("");
    } catch (err) {
      // Previously uncaught: a failed create silently re-enabled the button
      // with no indication anything went wrong.
      console.error("Failed to create project", err);
      setCreateError("Something went wrong creating that project. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user || !invitesChecked) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="logo"><div className="logo-mark">S</div>Sprintora</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/account" className="btn btn-secondary">Account</Link>
          <button
            className="btn btn-secondary"
            onClick={() => signOut(auth).then(() => router.push("/"))}
          >
            Log out
          </button>
        </div>
      </div>
      <div className="app-main">
        {!emailVerified && (
          <div
            className="project-card"
            style={{ marginBottom: 20, borderColor: "var(--amber, #d97706)" }}
          >
            <p style={{ marginBottom: 8 }}>
              <strong>Verify your email</strong> — until you do, you won&apos;t be able to
              accept teammate invites or join projects sent to {user.email}.
            </p>
            {verifyMsg && (
              <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 8 }}>
                {verifyMsg}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={handleResendVerification}
                disabled={verifyBusy}
              >
                {verifyBusy ? "Working..." : "Resend verification email"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleRefreshVerification}
                disabled={verifyBusy}
              >
                I&apos;ve verified &mdash; refresh
              </button>
            </div>
          </div>
        )}
        <h1 style={{ fontSize: 24 }}>Your projects</h1>

        <div className="new-project-form" style={{ marginTop: 16, marginBottom: 0 }}>
          <input
            placeholder="Search your projects and tasks..."
            value={searchQuery}
            onFocus={ensureTaskIndex}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) ensureTaskIndex();
            }}
          />
        </div>

        <form className="new-project-form" onSubmit={handleCreate}>
          <input
            placeholder="New project name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
        {createError && (
          <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{createError}</p>
        )}
        {listError && (
          <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{listError}</p>
        )}

        {isSearching ? (
          <div style={{ marginTop: 24 }}>
            {taskIndexLoading && (
              <p style={{ color: "var(--slate-500)", fontSize: 13, marginBottom: 12 }}>
                Searching tasks...
              </p>
            )}
            {matchingProjects.length === 0 && matchingTasks.length === 0 && !taskIndexLoading && (
              <p style={{ color: "var(--slate-500)" }}>No projects or tasks match &quot;{searchQuery}&quot;.</p>
            )}

            {matchingProjects.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--slate-500)", marginBottom: 10 }}>
                  Projects
                </h4>
                <div className="projects-grid" style={{ marginBottom: 24 }}>
                  {matchingProjects.map((p) => (
                    <Link key={p.id} href={`/dashboard/${p.id}`} className="project-card">
                      <h3>{p.name}</h3>
                      <p>Open board &rarr;</p>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {matchingTasks.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--slate-500)", marginBottom: 10 }}>
                  Tasks
                </h4>
                <div className="member-list">
                  {matchingTasks.map((t) => (
                    <Link
                      key={`${t.projectId}-${t.id}`}
                      href={`/dashboard/${t.projectId}?task=${t.id}`}
                      className="member-row"
                    >
                      <div className="member-info">
                        <span className="member-email">{t.title}</span>
                        <span style={{ fontSize: 12, color: "var(--slate-500)" }}>{t.projectName}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : projects.length === 0 && !listError ? (
          <p style={{ color: "var(--slate-500)", marginTop: 24 }}>
            No projects yet &mdash; create your first one above.
          </p>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <Link key={p.id} href={`/dashboard/${p.id}`} className="project-card">
                <h3>{p.name}</h3>
                <p>Open board &rarr;</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
