// Shared by every server-side route that builds HTML emails, so a value
// pulled from user input (task titles, project names, display names) can
// never break out of its tag and inject markup into the sent email.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
