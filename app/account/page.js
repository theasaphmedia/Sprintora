"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";
import { PAID_TIERS, limitsForPlan } from "../../lib/planLimits";

const SUBSCRIPTION_STATUS_LABELS = {
  trialing: "Trial",
  active: "Active",
  "non-renewing": "Canceling at period end",
  attention: "Payment issue — update your card",
  completed: "Completed",
  cancelled: "Canceled",
  expired: "Trial ended",
};

// useSearchParams() (used to read ?checkout=success/cancel after returning
// from Paystack) requires a Suspense boundary in the App Router, same
// reason as the project board page's deep-link support.
export default function AccountPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading...</div>}>
      <AccountPageInner />
    </Suspense>
  );
}

function AccountPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [prefBusy, setPrefBusy] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Live-updating rather than a one-time read: after returning from
    // Paystack Checkout, the webhook that actually flips `plan` to the paid tier
    // can take a few seconds to arrive. onSnapshot means the page updates
    // on its own the moment it does, instead of showing a stale plan until
    // a manual refresh. Also picks up /api/start-trial's write instantly,
    // since that one doesn't involve a redirect at all.
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setProfile(data);
      // Missing field = never explicitly opted out = notifications on.
      setEmailNotifications(data?.emailNotifications !== false);
    });
    return () => unsub();
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

  // Used for the two flows that redirect to a hosted Paystack page:
  // subscribing for real (create-checkout-session) and managing an
  // existing subscription (create-portal-session). `tier` is only relevant
  // for checkout — omit it for the portal session, and omit it when adding
  // a payment method mid-trial so the route defaults to keeping the tier
  // already being trialed (see TRIAL_TIER fallback in the route itself).
  async function callBillingApi(path, tier) {
    setBillingMsg("");
    setBillingBusy(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...(tier ? { "Content-Type": "application/json" } : {}),
        },
        ...(tier ? { body: JSON.stringify({ tier }) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(`Failed to call ${path}`, err);
      setBillingMsg("Something went wrong. Please try again.");
      setBillingBusy(false);
    }
  }

  // Starting a trial never leaves this page — no card, no redirect, just a
  // Firestore write the onSnapshot listener above picks up automatically.
  async function handleStartTrial() {
    setBillingMsg("");
    setBillingBusy(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/start-trial", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to start trial", err);
      setBillingMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setBillingBusy(false);
    }
  }

  if (loading || !user) return <div className="loading-screen">Loading...</div>;

  const plan = profile?.plan || "beta";
  const isPro = plan !== "beta";
  const planLabel = limitsForPlan(plan).label;
  const subscriptionStatus = profile?.subscriptionStatus;
  const isTrialing = subscriptionStatus === "trialing";
  const trialUsed = !!profile?.trialUsed;
  const checkoutResult = searchParams.get("checkout");

  let trialDaysLeft = null;
  if (isTrialing && profile?.trialEndsAt) {
    const msLeft = new Date(profile.trialEndsAt).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="logo"><div className="logo-mark">S</div>Sprintora</div>
        <Link href="/dashboard" className="btn btn-secondary">&larr; Back to projects</Link>
      </div>
      <div className="app-main" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>Account &amp; billing</h1>

        {checkoutResult === "success" && (
          <div className="project-card" style={{ marginBottom: 20, borderColor: "var(--green)" }}>
            <p>
              Checkout complete. It can take a few seconds for your plan below to update —
              this page will refresh itself automatically once it does.
            </p>
          </div>
        )}
        {checkoutResult === "cancel" && (
          <div className="project-card" style={{ marginBottom: 20 }}>
            <p style={{ color: "var(--slate-500)" }}>Checkout was canceled — no charge was made.</p>
          </div>
        )}

        <div className="project-card" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 4 }}>Signed in as</p>
          <h3 style={{ marginBottom: 0 }}>{user.email}</h3>
        </div>

        <div className="project-card">
          <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 4 }}>Current plan</p>
          <h3>{isPro ? (isTrialing ? `${planLabel} (Trial)` : planLabel) : "Free (Early Access Beta)"}</h3>

          {subscriptionStatus && (
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--slate-500)" }}>
              Status: {SUBSCRIPTION_STATUS_LABELS[subscriptionStatus] || subscriptionStatus}
            </p>
          )}

          {isTrialing && (
            <p style={{ marginTop: 8 }}>
              {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in your trial &mdash; no
              card on file. Add a payment method any time to keep Pro access once the trial
              ends; if you don&apos;t, you&apos;ll automatically move back to the free plan
              with no charge.
            </p>
          )}

          {!isPro && !trialUsed && (
            <p style={{ marginTop: 8 }}>
              Sprintora is free during early access. Start a 14-day {limitsForPlan("team").label} trial
              with no card required &mdash; you&apos;ll only be asked for payment details if you
              decide to keep it after the trial ends.
            </p>
          )}

          {!isPro && trialUsed && subscriptionStatus === "expired" && (
            <p style={{ marginTop: 8 }}>
              Your free trial ended without a payment method on file, so you&apos;re back on
              the free plan. Pick a plan below to get paid access again.
            </p>
          )}

          {!isPro && trialUsed && subscriptionStatus === "cancelled" && (
            <p style={{ marginTop: 8 }}>Your subscription was canceled. Resubscribe any time.</p>
          )}

          {billingMsg && (
            <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{billingMsg}</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {!isPro && !trialUsed && (
              <button className="btn btn-primary" onClick={handleStartTrial} disabled={billingBusy}>
                {billingBusy ? "Starting..." : "Start 14-day free trial"}
              </button>
            )}
            {isTrialing && (
              <button
                className="btn btn-secondary"
                onClick={() => callBillingApi("/api/create-checkout-session", plan)}
                disabled={billingBusy}
              >
                {billingBusy ? "Starting checkout..." : `Add payment method (${planLabel})`}
              </button>
            )}
            {isPro && !isTrialing && (
              <button
                className="btn btn-secondary"
                onClick={() => callBillingApi("/api/create-portal-session")}
                disabled={billingBusy}
              >
                {billingBusy ? "Opening..." : "Manage billing"}
              </button>
            )}
          </div>

          {!isPro && trialUsed && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 10 }}>
                Choose a plan to subscribe:
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {PAID_TIERS.map((tier) => {
                  const t = limitsForPlan(tier);
                  return (
                    <button
                      key={tier}
                      className="btn btn-primary"
                      onClick={() => callBillingApi("/api/create-checkout-session", tier)}
                      disabled={billingBusy}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 140 }}
                    >
                      <span>{t.label}</span>
                      <span style={{ fontWeight: 400, fontSize: 12 }}>
                        ₦{t.priceNgn.toLocaleString()}/mo &middot;{" "}
                        {t.maxMembers} members{t.maxProjects === Infinity ? "" : `, ${t.maxProjects} projects`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
