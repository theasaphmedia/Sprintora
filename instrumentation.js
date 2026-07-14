// Next.js instrumentation hook — runs once when the server starts, and is
// the mechanism that wires up the right Sentry config for whichever
// runtime the current process is (Node.js server functions vs Edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown during server-side rendering (React Server
// Components, layouts, etc.) that wouldn't otherwise hit an API route's
// own error handling.
export async function onRequestError(...args) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
