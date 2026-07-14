// This file configures the Sentry browser SDK. It runs whenever a page is
// loaded in the client, catching unhandled exceptions and unhandled promise
// rejections in the browser (broken UI interactions, failed fetches, etc).
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED } from "./lib/sentry";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  // Keep this low — Sprintora doesn't need per-request performance tracing
  // at this stage, just error visibility. Raise later if you want real
  // performance monitoring (adds cost/volume).
  tracesSampleRate: 0.1,
  // Don't record session replays by default — no need for it yet and it
  // adds meaningfully to bundle size / quota usage.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
