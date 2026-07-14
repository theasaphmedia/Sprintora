// Sentry SDK for the Edge runtime (middleware, edge API routes). Sprintora
// doesn't currently use edge functions, but Next.js requires this file to
// exist once instrumentation.js references it — keeps future edge routes
// covered automatically without another setup pass.
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED } from "./lib/sentry";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  tracesSampleRate: 0.1,
});
