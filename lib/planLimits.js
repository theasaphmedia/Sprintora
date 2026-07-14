// Central definition of what each billing tier allows. Imported from both
// client components (to show/soft-enforce limits in the UI) and server
// routes, so this file must never reference secrets or process.env.
//
// Two different kinds of caps here, enforced in two very different ways —
// documented explicitly so this isn't assumed to be more solid than it is:
//
// - maxMembers (per project) IS enforced server-side, in the Firestore
//   security rules themselves (see sprintora-firestore-rules.txt,
//   memberLimitForPlan()). A project's memberIds array size and its
//   owner's plan are both readable in a rule without an aggregate query,
//   so every membership-adding write is checked for real, regardless of
//   which code path triggers it.
//
// - maxProjects (per owner) is NOT enforced server-side. Firestore
//   security rules have no "count how many project docs this user owns"
//   primitive — only single-document reads via get()/exists(), not
//   aggregate queries over a collection. Real enforcement would need a
//   Cloud Function maintaining a denormalized project-count field, or a
//   server API route that counts before writing; neither exists yet. This
//   cap is UI-level only for now: it stops the normal "Create project"
//   button once the owner's own project count hits the limit, but someone
//   could still exceed it with a direct Firestore write from devtools.
//   Known gap, not a hidden one — worth a real fix if this ever matters
//   for revenue (i.e. someone actually abuses it).
export const PLAN_LIMITS = {
  beta: { label: "Free", maxProjects: 1, maxMembers: 3, priceNgn: 0 },
  starter: { label: "Starter", maxProjects: 3, maxMembers: 5, priceNgn: 3000 },
  team: { label: "Team", maxProjects: Infinity, maxMembers: 15, priceNgn: 7500 },
  business: { label: "Business", maxProjects: Infinity, maxMembers: 40, priceNgn: 15000 },
};

// Every non-free tier, in display order — used to render the plan picker
// on the account page and to validate the `tier` a client requests at
// checkout.
export const PAID_TIERS = ["starter", "team", "business"];

// The tier granted for the 14-day no-card trial. "team" was chosen over
// "starter" or "business" deliberately: generous enough that a trialing
// user hits real value (unlimited projects, a real team size) rather than
// bumping into Starter's low caps immediately, but not the top tier either
// — so upgrading past the trial to Business still feels like an upgrade.
export const TRIAL_TIER = "team";

export function limitsForPlan(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.beta;
}
