// Sentry SDK for the Node.js server runtime (API routes, server components).
// This is the important half of the setup — it's what catches a broken
// Paystack webhook handler, a Firestore Admin SDK failure, or any other
// server-side exception that would otherwise fail silently and only
// surface when a customer complains.
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED } from "./lib/sentry";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  tracesSampleRate: 0.1,
});
