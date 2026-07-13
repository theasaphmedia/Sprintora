// Server-only. Paystack doesn't need a dedicated SDK — it's a plain REST
// API — so this is a thin fetch wrapper rather than another npm dependency.
// Never import this from a client component; the secret key would end up
// in the browser bundle.
const BASE_URL = "https://api.paystack.co";

export async function paystackFetch(path, options = {}) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status === false) {
    const message = body?.message || `Paystack request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}
