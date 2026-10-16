/** Exact, plain-language grant scopes (spec §4.4, §10.13). Never "admin access". */
export const SCOPES = {
  dashboard_summary: {
    label: "Summary only",
    sees: "Aggregate counts on the team's summary page: how many tasks are not started, in progress, in review, blocked, overdue and recently completed.",
    never: "No task titles, keys, people, comments, projects, files or activity. Counts under 3 are hidden.",
    approval: "Active immediately. Logged in the audit trail.",
  },
  workspace_read: {
    label: "Read the team workspace",
    sees: "The team's board, list, tasks, comments, projects, Parking Lot, Library and work request intake notes.",
    never: "Can't change anything or comment. No time records or security logs. Can't pass access on.",
    approval: "Needs approval from the team lead (or another admin if the team has no lead).",
  },
  collaboration: {
    label: "Read and comment",
    sees: "Everything in “Read the team workspace”, plus commenting on tasks.",
    never: "Can't create or change tasks, triage requests or manage the team.",
    approval: "Needs approval from the team lead (or another admin if the team has no lead).",
  },
  edit: {
    label: "Edit team work",
    sees: "Read the workspace, comment, and create or change tasks, projects, ideas and references.",
    never: "Can't triage work requests, manage membership or issue grants.",
    approval: "Needs approval from the team lead (or another admin if the team has no lead).",
  },
} as const;

export type Scope = keyof typeof SCOPES;
