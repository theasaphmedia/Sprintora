"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
  }, [user, loading, router]);

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
      </div>
    </div>
  );
}
