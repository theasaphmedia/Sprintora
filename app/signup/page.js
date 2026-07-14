"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { acceptPendingInvites } from "../../lib/invites";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function createUserDoc(user, displayName) {
    await setDoc(doc(db, "users", user.uid), {
      email: user.email.toLowerCase(),
      displayName: displayName || user.displayName || "",
      plan: "beta",
      createdAt: serverTimestamp(),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await createUserDoc(cred.user, name);
      try {
        // Firebase doesn't verify email ownership at password sign-up, so
        // invite accept/self-join is gated on email_verified in the
        // security rules. Send the verification email now; if it fails
        // (e.g. rate limited) the account still exists and the user can
        // resend it from the dashboard.
        await sendEmailVerification(cred.user);
      } catch (verifyErr) {
        console.error("Failed to send verification email", verifyErr);
      }
      await acceptPendingInvites(cred.user);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await createUserDoc(cred.user);
      await acceptPendingInvites(cred.user);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="sub">Free during early access &mdash; no credit card needed</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "14px 0", fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" style={{ textDecoration: "underline" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" style={{ textDecoration: "underline" }}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !agreed}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>
        <div className="divider">or</div>
        <button className="btn btn-secondary btn-block" onClick={handleGoogle} disabled={busy || !agreed}>
          Continue with Google
        </button>
        <p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p>
      </div>
    </div>
  );
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "An account with that email already exists.";
  if (code.includes("weak-password")) return "Please choose a stronger password (6+ characters).";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  if (code.includes("unauthorized-domain")) {
    return "Google sign-in isn't enabled for this domain yet. Please try again shortly or use email/password.";
  }
  if (code.includes("network-request-failed")) {
    return "Network error. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
