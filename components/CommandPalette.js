"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";

// Global Cmd+K / Ctrl+K command palette. Mounted once in the root layout
// so it's available everywhere, not per-page — but it deliberately does
// nothing (renders null, doesn't even attach a project listener) when
// signed out, since there's nothing useful to jump to on the marketing
// pages or before login.
//
// Scoped intentionally: this is navigation, not action-execution. It jumps
// you to projects/pages fast; it doesn't create tasks or projects from
// inside the palette itself. That's a bigger, separate feature (would need
// its own input flow per action type) — this covers the "get me there
// fast" case, which is most of what a command palette is used for anyway.
export default function CommandPalette() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query_, setQuery] = useState("");
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    const q = query(collection(db, "projects"), where("memberIds", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    function handleKeyDown(e) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // Also openable via a visible on-screen trigger (see the "⌘K" button in
    // the dashboard header) for anyone who wouldn't discover the shortcut
    // on their own — a keyboard-only entry point has close to zero
    // discoverability otherwise.
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!user || !open) {
    // Still render a hidden trigger hint isn't necessary — the keyboard
    // shortcut works from anywhere once signed in, no visible button
    // needed. Nothing to render when closed or signed out.
    return null;
  }

  const staticActions = [
    { label: "Go to Dashboard", action: () => router.push("/dashboard") },
    { label: "Go to Account & billing", action: () => router.push("/account") },
    { label: "Log out", action: () => signOut(auth).then(() => router.push("/")) },
  ];

  const projectActions = projects.map((p) => ({
    label: `Go to project: ${p.name}`,
    action: () => router.push(`/dashboard/${p.id}`),
  }));

  const allActions = [...staticActions, ...projectActions];
  const trimmed = query_.trim().toLowerCase();
  const filtered = trimmed
    ? allActions.filter((a) => a.label.toLowerCase().includes(trimmed))
    : allActions;

  function run(action) {
    setOpen(false);
    action();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 100,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(520px, 90vw)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          placeholder="Jump to a project or page..."
          value={query_}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "16px 20px",
            fontSize: 15,
            border: "none",
            borderBottom: "1px solid var(--slate-200)",
            outline: "none",
          }}
        />
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {filtered.length === 0 && (
            <p style={{ padding: "16px 20px", color: "var(--slate-500)", fontSize: 14 }}>
              No matches.
            </p>
          )}
          {filtered.map((a, i) => (
            <button
              key={i}
              onClick={() => run(a.action)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--slate-100)",
                fontSize: 14,
                cursor: "pointer",
                color: "var(--slate-700)",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "8px 20px", fontSize: 12, color: "var(--slate-500)", background: "var(--slate-50)" }}>
          Esc to close &middot; &#8984;K / Ctrl+K to reopen
        </div>
      </div>
    </div>
  );
}
