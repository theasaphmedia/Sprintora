// DEPRECATED — replaced by app/api/webhooks/paystack/route.js. Sprintora
// switched from Stripe to Paystack for billing because Nigeria isn't in
// Stripe's list of supported merchant countries. This route now just
// returns 410 Gone rather than silently accepting requests to a dead
// integration. Safe to delete this whole app/api/webhooks/stripe directory
// manually — the sandbox this AI runs in can't delete files itself.
export async function POST() {
  return Response.json(
    { error: "This webhook is deprecated. Sprintora now uses Paystack — see /api/webhooks/paystack." },
    { status: 410 }
  );
}
