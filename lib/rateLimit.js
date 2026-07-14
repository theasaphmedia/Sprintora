// Minimal IP-based rate limiting backed by Firestore (via the Admin SDK),
// not an in-memory store. Vercel serverless functions are stateless across
// invocations — a plain in-memory counter would reset constantly and give
// almost no real protection. Firestore is shared and persistent, so this
// actually works across cold starts and multiple function instances, at
// the cost of one extra read+write per checked request. Fine at this
// scale; would need a real rate-limiting service (Upstash Redis, etc.) if
// traffic ever gets heavy enough for the extra Firestore ops to matter.
//
// Deliberately simple: a fixed window, not a sliding one. Good enough to
// blunt casual abuse (the same person spinning up several trial accounts
// in a row); a determined attacker rotating IPs or using a VPN/proxy per
// signup isn't stopped by this, and that's a known, accepted gap — real
// bot-defense (CAPTCHA, device fingerprinting) is a bigger build than this
// scope covers.
export async function checkAndRecordRateLimit(db, key, { maxCount, windowMs }) {
  const ref = db.collection("rateLimits").doc(key);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;

    if (!data || now - data.windowStart > windowMs) {
      // No record yet, or the previous window has expired — start fresh.
      tx.set(ref, { windowStart: now, count: 1 });
      return { allowed: true };
    }

    if (data.count >= maxCount) {
      return { allowed: false, retryAfterMs: windowMs - (now - data.windowStart) };
    }

    tx.set(ref, { windowStart: data.windowStart, count: data.count + 1 });
    return { allowed: true };
  });
}

// Vercel sets x-forwarded-for as a comma-separated list; the first entry
// is the original client IP. Falls back to a constant key if the header
// is somehow missing (e.g. local dev) so the function doesn't crash —
// that fallback means all such requests share one bucket, which is a
// conservative (more restrictive) failure mode, not a bypass.
export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
