# Sprintora — Project Brief (for continuing chat sessions)

Last updated: 2026-07-12

## What this is

Sprintora is a project management SaaS being built toward a real pilot: a company will subscribe and have their team use it. The end goal is to compete with tools like Asana, Monday.com, ClickUp, and Linear.

**Stated plainly, carried over from earlier in this project:** software alone doesn't make a company competitive on a "world stage." That requires capital, a team, a legal entity, a sales/support org, and years of go-to-market execution — none of which exist yet. What has been built is a legitimate technical MVP foundation, not a company. Every session should keep separating "the app works" from "the business exists."

## Name history (why it's called Sprintora)

Started as "Waypoint" → found a direct same-category collision (waypoint.software, an existing PM tool) → tried "Ontrail" → also collided (ontrail.app, a task manager) → settled on **Sprintora**, which had no exact-match collision in casual web searches. Important caveat: casual Googling is not real trademark clearance. Before any full public launch, this still needs an actual USPTO/EUIPO search or a lawyer — not more searching from an AI.

## Competitive research grounding the product's positioning

Sourced via web search during this project (not assumption):
- **Asana**: recurring complaint about notification overload in large workspaces.
- **ClickUp**: steep learning curve ("onboarding my team is taking months"); lag/slow load times in large workspaces (tens of thousands of items).
- **General**: per-seat pricing gets painful as teams scale; user adoption/engagement matters more than raw feature count.

Sprintora's marketing and product decisions lean into these three gaps: staying fast at scale, fast onboarding, and sane notification defaults — not feature-count parity with the big players.

## Stack and infrastructure

- **Frontend/backend**: Next.js 14 (App Router, plain JavaScript, not TypeScript)
- **Auth + database**: Firebase — project ID `sprintora-cda3a` (free Spark plan), Firestore default database in region `nam5`. Auth providers: Email/Password and Google.
- **Hosting**: Vercel — project name `sprintora`, team `taiglobal`. Production URL: `https://sprintora-taiglobal.vercel.app` (aliases: `sprintora-nine.vercel.app`, `sprintora-theasaphmedia-taiglobal.vercel.app`). Deployment Protection has been turned off, so it's genuinely public.
- **Source code location**: `C:\Users\USER\Documents\AI\sprintora-app` — this is the real, current source. Deploys are pushed directly from file contents (no git repo backing the Vercel project currently).
- **Also in this folder**: `sprintora-firestore-rules.txt` (published to Firebase console already) and two legal drafts, `Sprintora-Terms-of-Service-DRAFT.docx` / `Sprintora-Privacy-Policy-DRAFT.docx`.

## Data model (Firestore)

- `users/{uid}`: `email`, `displayName`, `plan` (currently `"beta"`), `createdAt`
- `projects/{projectId}`: `name`, `ownerId`, `memberIds` (array), `roles` (map of `uid` → `"owner"|"member"`), `createdAt`
- `projects/{projectId}/tasks/{taskId}`: `title`, `status` (`"todo"|"in_progress"|"done"`), `createdAt`
- `invites/{inviteId}`: `projectId`, `projectName`, `email`, `invitedBy`, `status` (`"pending"|"accepted"`), `createdAt`

## Tier 1 — complete

- Marketing landing page, copy grounded in the competitor research above (no fabricated testimonials or customer logos — those were deliberately removed after being flagged as a legal/honesty risk)
- Signup / login: email+password and Google sign-in, password reset via email
- Dashboard: create and list projects
- Task board per project: To Do / In Progress / Done columns; add, move, delete tasks
- Team invites by email (works whether the invitee already has an account or not), owner/member roles, remove member, delete project (owner-only in the UI)
- Account/billing placeholder page: shows plan as "Free (Early Access Beta)", disabled "Upgrade" button — structure is there for Stripe to slot in later; no real billing exists yet
- Firestore security rules: written and **published** to the Firebase console

## Known limitations in Tier 1 — be honest about these, don't quietly paper over them

- The published rules allow **any current project member to remove any other member, including the owner** — not owner-restricted at the rule level. Acceptable simplification for a small, trusted pilot team; not something to leave as-is for a larger or less-trusted user base.
- Rules enforcement has **not been independently verified** by an AI session — repeated attempts were blocked by sandbox network egress restrictions. Recommended verification method: Firebase Console → Firestore → **Rules Playground**, simulating reads/writes as different fake UIDs against real document paths.
- No email verification step on signup.
- No real payment processing (Stripe or otherwise) — the "beta" plan is a placeholder field, not a working billing system.
- No legal entity formed yet. The ToS/Privacy Policy drafts have placeholder fields (`[COMPANY LEGAL NAME]`, `[CONTACT EMAIL]`, governing jurisdiction) and **must be reviewed by an actual lawyer** before any real company relies on them.
- Firebase is on the free Spark plan: hard daily caps (50,000 reads / 20,000 writes per day). Fine for a small pilot; upgrade to the Blaze pay-as-you-go plan before wider usage, otherwise the app can simply stop responding mid-pilot if caps are hit. (User has said: upgrade "when we get there.")
- Still running on the `vercel.app` subdomain, not a purchased custom domain. (User has said: staying on Vercel for now, will purchase a domain once everything else is done.)

## Tier 2 — not yet built, next up

Competitive-parity features — expected by anyone evaluating a PM tool, not differentiators on their own, but their absence reads as "unfinished":
- Comments / activity feed on tasks
- File attachments on tasks
- Search across tasks and projects
- Email notifications (assigned to you, due soon) — should follow the "sane defaults, not overload" positioning that's already part of Sprintora's pitch, since notification overload is one of the specific competitor complaints being targeted

## Tier 3 — differentiation ideas, not urgent build items

- Keep the core differentiators front and center as the product grows: stays fast at scale, fast onboarding, sane notifications, transparent pricing.
- A genuinely flat, non-per-seat-penalty pricing model would be a *structural* differentiator, not just marketing copy, given the researched pricing-pain complaint.
- AI-assisted features (auto-summarized status updates, smart due-date suggestions) are a bigger, separate lift — optional, not part of reaching a working pilot.

## Explicit business decisions made so far (don't re-litigate these without new information)

- Legal entity + real Stripe billing: deferred, "we can add later" — only the data-model/UI structure for it has been built.
- Firebase Blaze upgrade: deferred until usage approaches free-tier limits.
- Custom domain: deferred until later; staying on the Vercel subdomain for now.
- International market for v1: English-only, global availability (not multi-language, not EU-specific compliance work) — that was the explicit choice made earlier.

## Suggested next step for whoever picks this up

Verify the published Firestore rules actually enforce access control (Rules Playground, as noted above), then start on Tier 2 in the order listed.
