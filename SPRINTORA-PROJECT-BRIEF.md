# Sprintora — Project Brief (for continuing chat sessions)

Last updated: 2026-07-13

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
- **Auth + database**: Firebase — project ID `sprintora-cda3a` (free Spark plan), Firestore default database in region `nam5`. Auth providers: Email/Password and Google. Email verification is live (see Tier 1 below).
- **Hosting**: Vercel — project name `sprintora`, team `taiglobal`. Production URL: `https://sprintora-taiglobal.vercel.app` (aliases: `sprintora-nine.vercel.app`, `sprintora-theasaphmedia-taiglobal.vercel.app`). Deployment Protection is off, so it's genuinely public.
- **Version control**: a real git repo now backs this, pushed to GitHub at `github.com/theasaphmedia/Sprintora` (public repo), connected to Vercel's Git integration — every `git push` to `main` triggers an automatic production deploy. This did NOT exist as of the last brief update; deploys used to go straight from local file contents with no history. Note: the sandbox this AI runs in cannot execute git commands against the mounted project folder (FUSE filesystem restriction) — the human running the session has to run `git add / commit / push` themselves each time; the AI can prepare commit messages and file changes but not push.
- **Outbound email**: Gmail SMTP via `nodemailer`, authenticated with a Google App Password (env vars `GMAIL_USER` / `GMAIL_APP_PASSWORD` in Vercel). This is a **deliberate free-tier workaround, not the long-term answer** — Resend (the originally planned provider) was tried first but its free/sandbox tier only delivers to the account owner's own registered email address without a verified sending domain, which was a dead end without buying a domain. Gmail SMTP has no such restriction and needs no domain, but caps at 500 emails/day and sends from a personal Gmail address rather than a branded one. Revisit this (buy a domain, verify it with Resend or similar) once either volume or professionalism actually requires it.
- **Source code location**: `C:\Users\USER\Documents\AI\sprintora-app` — this is the real, current source, and is now a live git working directory (see above).
- **Also in this folder**: `sprintora-firestore-rules.txt` (kept in sync with what's published to Firebase console — **always re-publish through the Firebase console's Rules tab after editing this file locally; editing the file alone does nothing to the live rules**) and two legal drafts, `Sprintora-Terms-of-Service-DRAFT.docx` / `Sprintora-Privacy-Policy-DRAFT.docx`.

## Data model (Firestore)

- `users/{uid}`: `email`, `displayName`, `plan` (currently `"beta"`), `createdAt`
- `projects/{projectId}`: `name`, `ownerId`, `memberIds` (array), `roles` (map of `uid` → `"owner"|"member"`), `createdAt`
- `projects/{projectId}/tasks/{taskId}`: `title`, `status` (`"todo"|"in_progress"|"done"`), `createdAt`
- `projects/{projectId}/tasks/{taskId}/comments/{commentId}`: `text`, `authorId`, `authorName`, `authorEmail`, `createdAt`. New this session — see Tier 2 below. Comments are immutable once posted (no edit) and can only be deleted by their own author (not even the project owner can delete someone else's comment yet — deliberate scope decision, not an oversight; add owner/moderator delete later if actually needed).
- `invites/{inviteId}`: `projectId`, `projectName`, `email`, `invitedBy`, `status` (`"pending"|"accepted"|"left"|"removed"`), `createdAt`. The `status` field is a **single current-value snapshot, not a history log** — it's overwritten on every transition (e.g. removed → re-invited flips it straight back to `"accepted"`, erasing the fact it was ever "removed"). A real audit trail would need a different shape (an array or subcollection of timestamped events) — not built, flagged as a possible future need.
  - **Known gap**: any member added via the "already has an account" branch of the invite flow *before this session's fixes* has no invite doc at all (that branch didn't create one until this session). Their `left`/`removed` status can never be tracked retroactively — there's no record to update. Only affects a handful of early test accounts on the `TWN STUDIOS` test project; not a concern for real users invited going forward.

## Tier 1 — complete, and more thoroughly verified than before

- Marketing landing page, copy grounded in the competitor research above (no fabricated testimonials or customer logos — those were deliberately removed after being flagged as a legal/honesty risk)
- Signup / login: email+password and Google sign-in, password reset via email
- **Email verification on signup**: `sendEmailVerification` fires at signup, dashboard shows a banner with "Resend" and "I've verified — refresh" (the refresh button forces a fresh ID token, which matters because Firestore rules check the `email_verified` claim baked into the token, not the live profile flag — a stale cached token is the most common cause of "I verified but it's not working," and this is now logged clearly instead of failing silently). Tested end-to-end this session, including the real Gmail-inbox → click-link → banner-clears path.
- Dashboard: create and list projects (a missing Firestore composite index used to make this fail completely silently — fixed, and errors now surface in the UI instead of vanishing)
- Task board per project: To Do / In Progress / Done columns; add, move, delete tasks — tested including refresh-persistence and orphan-cleanup on project deletion (deleting a project now explicitly deletes its `tasks` subcollection first; Firestore never cascade-deletes subcollections on its own, so this used to leave orphaned data forever)
- **Comments on tasks** (new this session, part of Tier 2 — see below): click any task card to open a detail view with a comment thread.
- Team invites by email (works whether the invitee already has an account or not) — the actual **email-sending was silently broken with zero code behind it** until this session; now genuinely sends via Gmail SMTP, with a "Resend" button per pending/accepted invite, and clear on-screen + logged errors if a send ever fails again.
- Owner/member roles. Membership changes: **only the project owner can remove any other member; a member can only remove (leave) themselves** — this was explicitly clarified and re-verified against the published rules this session (an earlier version of this brief described this as an unfixed gap; re-reading the actual rule text showed it was already correctly scoped, and it's since been made airtight either way). A "Leave project" button now exists in the UI for non-owner members (it didn't before — the rule permitted self-removal but no button ever exposed it). Leaving/being removed now updates that person's invite record to `"left"` / `"removed"` with a colored badge in the owner's "Invites sent" list (see the data-model note on this field's limitations).
- Delete project (owner-only in the UI, and now actually cleans up its tasks subcollection — see above)
- Account/billing placeholder page: shows plan as "Free (Early Access Beta)", disabled "Upgrade" button — structure is there for Stripe to slot in later; no real billing exists yet
- Firestore security rules: written, published, and **independently verified this session** via Rules Playground (6/6 test scenarios passed: unverified-email invite acceptance correctly denied, verified-email acceptance correctly allowed, non-member project reads denied, owner-only project deletion enforced, etc.) — the "not yet verified" caveat from the previous brief version no longer applies.

## Known limitations — be honest about these, don't quietly paper over them

- **Gmail SMTP is a workaround** (see Stack section) — 500 emails/day, unbranded sender address, more spam-filter-prone at scale than a verified domain sender. Fine for beta; revisit before real growth.
- **The invite-notification API route (`/api/send-invite`) verifies the requester is signed in, but not that they actually own the project they're inviting to.** Documented in the route's own code comment. Practical risk today: any signed-in Sprintora user could trigger an invite email to an arbitrary address via any project ID, not just one they own. Low severity (no data exposure, just unwanted email), not fixed yet.
- **Invite `status` has no history** — see data-model note above.
- **Untested paths**: password reset ("Forgot password?"), and — now that self-leave/remove exist — re-verify them again after any future rules changes, since they depend on precise rule wording that's easy to accidentally loosen.
- No real payment processing (Stripe or otherwise) — the "beta" plan is a placeholder field, not a working billing system.
- No legal entity formed yet. The ToS/Privacy Policy drafts have placeholder fields (`[COMPANY LEGAL NAME]`, `[CONTACT EMAIL]`, governing jurisdiction) and **must be reviewed by an actual lawyer** before any real company relies on them.
- Firebase is on the free Spark plan: hard daily caps (50,000 reads / 20,000 writes per day). Fine for a small pilot; upgrade to the Blaze pay-as-you-go plan before wider usage, otherwise the app can simply stop responding mid-pilot if caps are hit. (User has said: upgrade "when we get there.")
- Still running on the `vercel.app` subdomain, not a purchased custom domain. (User has said: staying on Vercel for now, will purchase a domain once everything else is done.) Buying a domain would also unlock a proper verified-domain email sender, solving two problems at once if it ever happens.
- No error monitoring (Sentry or similar), no automated tests, no rate limiting on the invite endpoint, no Firestore backup schedule. None urgent at current scale; all worth having before a real paying pilot.

## Tier 2 — in progress

Competitive-parity features — expected by anyone evaluating a PM tool, not differentiators on their own, but their absence reads as "unfinished":
- **Comments on tasks — built this session.** Click a task card to open a detail modal with a threaded comment list and a post box. Not yet built as part of this: an *activity feed* (auto-logged system events like "moved to Done" or "task created") is a distinct, larger feature from user-typed comments and has NOT been built — only the comments half of this line item is done. Decide whether the activity-feed half is still wanted before considering this line fully complete.
- File attachments on tasks — not started
- Search across tasks and projects — not started
- Email notifications (assigned to you, due soon) — not started. Should follow the "sane defaults, not overload" positioning that's already part of Sprintora's pitch, since notification overload is one of the specific competitor complaints being targeted. Can reuse the Gmail-SMTP sending path already built for invites.

## Tier 3 — differentiation ideas, not urgent build items

- Keep the core differentiators front and center as the product grows: stays fast at scale, fast onboarding, sane notifications, transparent pricing.
- A genuinely flat, non-per-seat-penalty pricing model would be a *structural* differentiator, not just marketing copy, given the researched pricing-pain complaint.
- AI-assisted features (auto-summarized status updates, smart due-date suggestions) are a bigger, separate lift — optional, not part of reaching a working pilot.

## Explicit business decisions made so far (don't re-litigate these without new information)

- Legal entity + real Stripe billing: deferred, "we can add later" — only the data-model/UI structure for it has been built.
- Firebase Blaze upgrade: deferred until usage approaches free-tier limits.
- Custom domain: deferred until later; staying on the Vercel subdomain for now.
- International market for v1: English-only, global availability (not multi-language, not EU-specific compliance work) — that was the explicit choice made earlier.
- Membership removal: only the owner can remove other members; any member can remove (leave) themselves; no one can remove someone other than themselves except the owner. Confirmed and built out this session, not just a rules quirk — this is the intended policy.
- Email delivery: staying on free Gmail SMTP for now rather than buying a domain purely to unblock Resend; revisit if/when a custom domain gets purchased anyway.

## Suggested next step for whoever picks this up

Tier 2 is now in progress (comments done, three items left: file attachments, search, email notifications — in that order per this brief). Before starting the next one, decide whether the activity-feed half of the "comments / activity feed" line item is still wanted, since only comments got built.
