"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setInfo("");
    if (!email) {
      setError("Enter your email above first, then click 'Forgot password?'");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="sub">Log in to your Sprintora account</p>
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Logging in..." : "Log in"}
          </button>
        </form>
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={busy}
          style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 13, marginTop: 10, cursor: "pointer", display: "block", textAlign: "center", width: "100%" }}
        >
          Forgot password?
        </button>
        <div className="divider">or</div>
        <button className="btn btn-secondary btn-block" onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </button>
        <p className="auth-switch">Don&apos;t have an account? <Link href="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Incorrect email or password.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code.includes("popup-closed-by-user")) {
    return "Google sign-in was cancelled.";
  }
  if (code.includes("unauthorized-domain")) {
    return "Google sign-in isn't enabled for this domain yet. Please try again shortly or use email/password.";
  }
  if (code.includes("network-request-failed")) {
    return "Network error. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
