"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [prefBusy, setPrefBusy] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const data = snap.exists() ? snap.data() : null;
      setProfile(data);
      // Missing field = never explicitly opted out = notifications on.
      setEmailNotifications(data?.emailNotifications !== false);
    });
  }, [user, loading, router]);

  async function handleToggleNotifications() {
    const next = !emailNotifications;
    setPrefBusy(true);
    setPrefMsg("");
    try {
      await updateDoc(doc(db, "users", user.uid), { emailNotifications: next });
      setEmailNotifications(next);
    } catch (err) {
      console.error("Failed to update notification preference", err);
      setPrefMsg("Couldn't save that. Please try again.");
    } finally {
      setPrefBusy(false);
    }
  }

  if (loading || !user) return <div className="loading-screen">Loading...</div>;

  const plan = profile?.plan || "beta";

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="logo"><div className="logo-mark">S</div>Sprintora</div>
        <Link href="/dashboard" className="btn btn-secondary">&larr; Back to projects</Link>
      </div>
      <div className="app-main" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Account &amp; billing</h1>

        <div className="project-card" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 4 }}>Signed in as</p>
          <h3 style={{ marginBottom: 0 }}>{user.email}</h3>
        </div>

        <div className="project-card">
          <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 4 }}>Current plan</p>
          <h3>{plan === "beta" ? "Free (Early Access Beta)" : plan}</h3>
          <p style={{ marginTop: 8 }}>
            Sprintora is free for everyone during the beta period. Paid plans aren&apos;t
            available yet &mdash; when they are, you&apos;ll be notified here and by email
            before anything changes.
          </p>
          <button className="btn btn-secondary" disabled style={{ marginTop: 16, cursor: "not-allowed" }}>
            Upgrade (coming soon)
          </button>
        </div>

        <div className="project-card" style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 4 }}>Email notifications</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={handleToggleNotifications}
              disabled={prefBusy}
            />
            Email me when I&apos;m assigned a task or have one due tomorrow
          </label>
          {prefMsg && (
            <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{prefMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
