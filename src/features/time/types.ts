/** DTOs for the viewer's own time entries (never anyone else's). */

export type ActiveTimer = {
  id: string;
  taskId: string;
  taskKey: string | null;
  taskTitle: string | null;
  teamSlug: string | null;
  startedAt: string;
};

export type TaskTime = {
  /** Finished, non-deleted time the viewer logged on this task. */
  mySeconds: number;
  /** The viewer's running timer on any task, after the stop rule was applied. */
  active: ActiveTimer | null;
  /** Server clock at render; the client derives elapsed time from it. */
  serverNow: string;
};

export type MyTimeEntry = {
  id: string;
  taskId: string;
  taskKey: string | null;
  taskTitle: string | null;
  teamSlug: string | null;
  source: "timer" | "manual";
  startedAt: string;
  endedAt: string | null;
  seconds: number | null;
  note: string | null;
  stopReason: "user" | "switched" | "access_lost" | "suspended" | "task_archived" | null;
  corrected: boolean;
  version: number;
};
