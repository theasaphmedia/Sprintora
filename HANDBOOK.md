# Sprintora Engineering Handbook

This is a current-state reference, not a history. For "why was this decision made," see `SPRINTORA-PROJECT-BRIEF.md` — that file is a chronological session log. This file is for "how does this actually work today" and "what do I need to know to touch this safely."

Last written: 2026-07-14.

## 1. What this is, in one paragraph

Sprintora is a project-management SaaS: Next.js 14 (App Router, plain JavaScript) on Vercel, Firebase (Auth + Firestore) as the backend, Paystack for billing, Sentry for error monitoring, Gmail SMTP for outbound email. Single codebase, no separate backend service — API routes under `app/api/` are the entire server side.

## 2. Where things live, and who can get in

| Piece | Where | Who has access |
|---|---|---|
| Source code | `github.com/theasaphmedia/Sprintora` (public repo) | GitHub account `theasaphmedia` |
| Hosting/deploys | Vercel, team `taiglobal`, project `sprintora` | Vercel account under `theasaphmedia@gmail.com` |
| Database + Auth | Firebase project `sprintora-cda3a`, Firestore region `nam5` | Google account `theasaphmedia@gmail.com` |
| Payments | Paystack (business profile: TAI DIGITAL, trading name of The Asaph Innovations — converting to Ltd as of this writing) | Paystack dashboard login |
| Error monitoring | Sentry org `tai-digital`, project `sprintora` (https://tai-digital.sentry.io) | Sentry account tied to the same org |
| Outbound email | Gmail SMTP, personal Gmail address + App Password | Whichever Google account owns that App Password |

**If the person who set this up is unreachable**, the actual blocker isn't the code — it's these five account logins. None of the passwords/keys live in this repo (see §4); they're only in Vercel's environment variable store and in the heads/password managers of whoever set them up. Losing access to the Google account tied to Firebase + Gmail SMTP is the single biggest bus-factor risk in this whole stack — write down account recovery details somewhere outside this repo.

## 3. Architecture map

```
app/
  page.js                    Public landing page (pricing, marketing)
  login/, signup/            Auth pages (Firebase Auth, email/password + Google)
  terms/, privacy/           Legal pages — still has unresolved [COMPANY LEGAL NAME]
                              and other placeholders, not lawyer-reviewed yet
  dashboard/page.js           Project list, "create project" (+ templates)
  dashboard/[projectId]/page.js   The actual product: Board / List / Calendar /
                              Insights / Team tabs, task detail modal, comments,
                              activity feed, invites
  account/page.js             Billing: trial start, tier picker, Paystack checkout
  api/
    create-checkout-session/  Real Paystack subscription checkout (tier-aware)
    create-portal-session/    Paystack's subscription-management page
    start-trial/               Card-less 14-day trial grant (pure Firestore write)
    webhooks/paystack/         Paystack webhook — the only place a plan actually
                                gets upgraded for real money
    send-invite/, send-notification/   Gmail SMTP email sends
    cron/due-soon/              Daily 13:00 UTC — due-tomorrow reminder emails
    cron/trial-expiry/          Daily 14:00 UTC — reverts expired card-less trials

lib/
  firebase.js / firebaseAdmin.js   Client SDK vs. Admin SDK (server-only, privileged)
  serverAuth.js                    Lightweight ID-token verification (no Admin SDK)
  planLimits.js                    Single source of truth for tier caps/pricing
  paystack.js                      Thin fetch wrapper around Paystack's REST API
  rateLimit.js                     Firestore-transaction-based fixed-window limiter
  projectTemplates.js              Preset task lists for new projects
  sentry.js                        Sentry DSN + enabled flag (DSN isn't a secret)
  invites.js / notifications.js / emailUtils.js   Invite + email plumbing

components/
  CommandPalette.js            Global Cmd+K nav, mounted once in app/layout.js

sprintora-firestore-rules.txt  The REAL security rules — editing this file locally
                                does nothing until it's republished via the
                                Firebase Console Rules tab. This is the actual
                                enforcement layer for member caps and billing
                                field locks, not just documentation.

vercel.json                    Cron schedule definitions (committed, not
                                dashboard-only — Vercel reads this on every deploy)
```

## 4. Environment variables (names only — real values live in Vercel, never in this repo)

- `FIREBASE_SERVICE_ACCOUNT_JSON` — Admin SDK credentials. Treat like a password.
- `CRON_SECRET` — Vercel sends this as the cron jobs' auth header automatically.
- `PAYSTACK_SECRET_KEY` — also doubles as the webhook signature-verification key (no separate webhook secret, unlike Stripe).
- `PAYSTACK_PLAN_CODE_STARTER` / `_TEAM` / `_BUSINESS` — one Paystack Plan code per tier.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — outbound email.

No `SENTRY_DSN` env var exists or is needed — the DSN is hardcoded in `lib/sentry.js` (Sentry DSNs are meant to ship in client bundles, they're not secrets).

**Important operational fact**: Vercel env vars only apply to deployments created *after* they're added. Adding one and not redeploying means it silently isn't live yet.

## 5. How a deploy actually happens

There is no build/CI step to trigger manually. `git push` to `main` → Vercel's GitHub integration builds and deploys automatically → production URL updates within a couple minutes. Verify a deploy landed via the Vercel dashboard or by asking whoever's driving this to check `list_deployments`/`get_deployment` if working with an AI assistant that has Vercel access.

There is no `package-lock.json` committed — every deploy runs a fresh `npm install` against whatever ranges are in `package.json`. This means a dependency could resolve to a newer minor/patch version between two deploys without any code change — worth knowing if something breaks that "shouldn't have."

## 6. Local development

Not really set up as a documented workflow — this project has been built and deployed entirely through Vercel's git-push pipeline, with verification done by code review plus Vercel's own build logs rather than a local `npm run dev` loop. To actually run it locally, you'd need: Node installed, `npm install`, and a `.env.local` with every variable in §4 filled in with real (ideally test-mode) values, plus Firebase Auth configured to allow `localhost` as an authorized domain.

## 7. Biggest real risks right now (short version — see the brief for full detail)

- **Legal**: ToS and Privacy Policy pages are live and gate signup, but still carry visible "not lawyer-reviewed" placeholders (governing law, liability cap, data-subject-rights, international transfers). Don't let this sit indefinitely once there are real paying users outside a small pilot.
- **NDPA cross-border data transfer**: Nigerian user data flows to US-hosted Firebase/Google Cloud infrastructure. Whether that legally requires Standard Contractual Clauses or another mechanism is unconfirmed — needs a real lawyer, not more research from an AI.
- **No Firestore backups yet**: planned (native scheduled backups), not enabled — blocked on a Blaze plan upgrade decision. Until that happens, an accidental bad write or delete is unrecoverable.
- **Project-count caps are UI-only, not server-enforced**: Firestore security rules can enforce a per-project member cap (single-document read) but cannot enforce a per-owner project *count* cap without a Cloud Function or denormalized counter — a technically savvy free-tier user could exceed their project limit by going around the UI. Low real-world risk at current scale, worth knowing it exists.
- **No automated tests.** Every change so far has shipped on manual code review plus Vercel's build succeeding. Fine at current size and pace; will not stay fine forever.

## 8. If you're picking this up cold

Read `SPRINTORA-PROJECT-BRIEF.md` end to end for the "why" behind every non-obvious decision (why Paystack not Stripe, why bracket pricing not per-seat, why card-less trials, why Gmail SMTP not a real transactional email provider). Then use this file as your map while actually working in the code. The brief is long because it's a real decision log, not padding — the reasoning in it has already prevented at least one re-litigated decision this project.
