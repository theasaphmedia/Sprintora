// Starter task sets for new projects. Purely a UX/onboarding convenience —
// picking a template just pre-populates a handful of "todo" tasks in the
// new project instead of leaving it empty; nothing structural changes
// about the project itself, and every seeded task can be renamed or
// deleted immediately like any other task. "blank" is the default and
// intentionally seeds nothing, preserving today's behavior for anyone who
// doesn't want a template.
export const PROJECT_TEMPLATES = {
  blank: {
    label: "Blank project",
    tasks: [],
  },
  sprint: {
    label: "Sprint board",
    tasks: [
      "Define sprint goal",
      "Break down user stories",
      "Daily standup",
      "Sprint review & retro",
    ],
  },
  bugs: {
    label: "Bug tracker",
    tasks: [
      "Triage new bugs",
      "Reproduce and confirm",
      "Fix and test",
      "Verify in production",
    ],
  },
  marketing: {
    label: "Marketing campaign",
    tasks: [
      "Define campaign goals",
      "Draft creative assets",
      "Schedule launch",
      "Track performance",
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(PROJECT_TEMPLATES);
