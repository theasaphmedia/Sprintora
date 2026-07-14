// Shared Sentry config. The DSN is not a secret — Sentry DSNs are meant to
// be embedded in client-side bundles (that's how the browser SDK reports
// errors at all), so it's safe to hardcode here rather than requiring a
// Vercel env var for it.
//
// Project: tai-digital/sprintora (https://tai-digital.sentry.io)
export const SENTRY_DSN =
  "https://f81693fa3910e46bdceb484177186ac1@o4511671186096128.ingest.de.sentry.io/4511733756198992";

// Only report errors from real deployments. Local dev noise (broken WIP
// code, hot-reload weirdness) isn't worth polluting the issue stream —
// and it would make real production errors harder to spot.
export const SENTRY_ENABLED = process.env.NODE_ENV === "production";
