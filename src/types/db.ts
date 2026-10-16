import type { Database as Generated } from "./database";

/**
 * Columns that database triggers derive or overwrite on INSERT (ownership,
 * keys, actors). Clients never need to — and cannot meaningfully — supply
 * them, so they are optional in the Insert types used by the app. The
 * generated file (`npm run db:types`) stays untouched.
 */
type Managed = {
  tasks: "org_id" | "creator_id" | "issue_key" | "number" | "rank" | "status_id";
  projects: "org_id" | "created_by";
  task_checklist_items: "team_id";
  task_comments: "team_id" | "author_id";
  parking_ideas: "org_id" | "creator_id";
  library_items: "org_id" | "owner_id";
  work_request_messages: "author_id";
  work_request_internal_notes: "author_id" | "target_team_id";
};

type Tables = Generated["public"]["Tables"];
type Relax<T, K extends PropertyKey> = Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>;

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables"> & {
    Tables: {
      [N in keyof Tables]: N extends keyof Managed
        ? Omit<Tables[N], "Insert"> & { Insert: Relax<Tables[N]["Insert"], Managed[N]> }
        : Tables[N];
    };
  };
};
