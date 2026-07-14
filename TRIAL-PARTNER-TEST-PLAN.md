# Trial Partner Smoke Test — Pre-Pilot Checklist

Purpose: exercise the exact path a real trial partner will take, as two real accounts, before anyone outside this project touches the live app. Not exhaustive QA — a smoke test of the core loop: signup → trial → invite → tasks → billing gates.

Live URL: https://sprintora-nine.vercel.app (or your production alias)

Sentry baseline before this test: **0 unresolved issues** (checked 2026-07-14). Any new issue that appears in `tai-digital/sprintora` during this test run is attributable to something below — flag it and we'll dig in together.

Use two real, separate email addresses you control — call them **Account A** (the "owner"/trial partner) and **Account B** (a teammate they invite). Don't reuse an account that's already used its free trial (`trialUsed` is permanent).

---

## Part 1 — Signup and legal consent (Account A)

1. Go to `/signup`. **Before checking the ToS/Privacy consent box**, try submitting. Expected: blocked with an error message, account is NOT created.
2. Check the consent box, click through to Terms and Privacy in the new tab to confirm they actually load with real content (not a 404).
3. Complete signup with email/password. Expected: lands on `/dashboard`, signed in.
4. Optional: sign out, try the "Continue with Google" path too, confirm the same consent gate applies there.

**Pass looks like:** can't create an account without consenting; both auth paths work; legal pages are reachable and load.

## Part 2 — Trial start

5. On `/account`, click **Start 14-day free trial**. Expected: no payment info requested at all, plan flips to Team-tier immediately.
6. Check `/account` shows the trial end date and Team-tier limits (10 members, unlimited-ish projects — check `lib/planLimits.js` for the exact current numbers).

**Pass looks like:** trial starts with zero friction, no card requested, correct tier granted.

## Part 3 — Project creation and the new views

7. Create a project. Try each template option in the picker (blank / sprint / bugs / marketing) — confirm each one seeds the expected starter tasks.
8. Add 3–4 tasks manually with a mix of: some with due dates (one in the past to test overdue styling, one this week, one with no due date), some assigned, some not.
9. Click through **Board**, **List**, **Calendar**, and **Insights** tabs. Specifically check:
   - List: click each column header, confirm sort direction toggles and the arrow indicator updates.
   - Calendar: confirm the overdue task shows in red, confirm the undated task shows in the "No due date" section below the grid, not silently missing.
   - Insights: confirm the numbers match what you'd expect by hand (total tasks, completion %, overdue count).
10. Try **Cmd+K / Ctrl+K** (or the ⌘K button in the dashboard header) — confirm the command palette opens and can navigate to the project.

**Pass looks like:** all four views render real data correctly, nothing crashes, sort/filter behavior matches what's described above.

## Part 4 — Inviting a real second person (Account B)

11. On the project's Team tab, invite Account B's real email address.
12. **Check that email actually arrives** — this is the one that's silently failed before (Resend 403 in old logs). If it doesn't arrive, check the in-app message — it should say whether the email send failed and offer a Resend button, not just silently claim success.
13. Sign in as Account B (new browser/incognito), accept the invite, confirm they land in the project with "member" role (not owner).

**Pass looks like:** invite email actually lands in a real inbox; Account B gets real access with the correct role.

## Part 5 — Assignment and notification emails

14. As Account A, assign one of the tasks to Account B.
15. Confirm Account B receives an assignment email with a working deep link back to that exact task (`/dashboard/{projectId}?task={taskId}` should auto-open the task detail modal).
16. As Account B, open Account settings and toggle **email notifications** off, then have Account A reassign a different task to them — confirm no email is sent this time (respecting the opt-out).

**Pass looks like:** assignment email arrives with a working deep link; opt-out is actually respected.

## Part 6 — Member cap enforcement (real test, not just UI)

17. Check the Team tier's member cap in `lib/planLimits.js` (current brief lists it as part of the tier table). Invite enough distinct emails to hit that cap exactly.
18. Try inviting one more past the cap. Expected: blocked with a friendly message pointing at the limit — **and** confirm it's actually enforced (not just hidden), by checking this isn't just a UI-level block. If you want to be thorough, this would require testing at the Firestore rules level directly, which is harder to fake from the UI alone — for this smoke test, the friendly-message block is enough; treat true rules-level bypass testing as a separate, later task if you want full confidence.

**Pass looks like:** can't exceed the cap, get a clear explanation why, not a raw permission error.

## Part 7 — Billing (use Paystack test mode — confirm `PAYSTACK_SECRET_KEY` is still `sk_test_...`, not live, before doing this)

19. From `/account`, pick a paid tier and go through checkout with a Paystack test card (`4084 0840 8408 4081`, any future expiry, any CVV, PIN `0000`, OTP `123456`).
20. Confirm `/account` updates to show the correct tier and active subscription within a few seconds.
21. Specifically confirm the tier you picked is the tier you actually got — this exercises the webhook's plan_code → tier resolution, the part most likely to silently default wrong.

**Pass looks like:** checkout completes, correct tier lands, no manual reconciliation needed.

## Part 8 — Leaving / removing

22. As Account B, use "Leave project" — confirm they lose access and get redirected sensibly.
23. Re-invite Account B, then as Account A (owner), remove them instead — confirm the same end state from the owner-initiated path.

**Pass looks like:** both self-leave and owner-removal work and leave the project in a consistent state.

---

## After the test

Report back anything that didn't match "pass looks like" above, plus anything that felt confusing or slow even if it technically worked — that's real pilot-partner-experience signal, not just pass/fail. I'll cross-check Sentry and Vercel logs against whatever you report to catch anything that failed silently without you noticing.

Deliberately not covered here (out of scope for a smoke test, would need dedicated setup): the due-soon and trial-expiry cron jobs (both run on fixed daily schedules, can't easily trigger on demand without the `CRON_SECRET` value), and the new backup-export cron (first real run is tonight at 3am UTC — check your inbox tomorrow separately).
