import type { TaskTime } from "@/features/time/types";
import type { StatusCategory, TaskPriority, TaskType } from "./meta";

export type Status = { id: string; key: string; label: string; category: StatusCategory; position: number };
export type Transition = { from: string; to: string };
export type Member = { id: string; name: string; role: "lead" | "member"; active: boolean };
export type Label = { id: string; name: string };
export type ProjectRef = { id: string; name: string; milestones: { id: string; name: string }[] };

/** Minimal card DTO shared by Board, List and My Work. */
export type TaskCard = {
  id: string;
  key: string;
  title: string;
  statusId: string;
  priority: TaskPriority;
  type: TaskType;
  assigneeId: string | null;
  dueDate: string | null;
  blocked: boolean;
  blockedReason: string | null;
  /** Live "blocked by" links whose blocker is still open (includes ones the viewer can't read). */
  openBlockers: number;
  rank: number;
  version: number;
  projectId: string | null;
  milestoneId: string | null;
  parentId: string | null;
  labels: Label[];
  commentCount: number;
  completedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type TaskComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
};

export type TaskActivity = {
  id: number;
  actorName: string | null;
  event: string;
  data: Record<string, unknown>;
  createdAt: string;
  /** For dependency events: the other task's key, or null when the viewer can't read it. */
  relatedKey?: string | null;
};

/**
 * One live dependency link seen from this task. `other` is null when the viewer
 * can't read the linked task: no key, title or team is disclosed (spec §7.14).
 */
export type TaskDependency = {
  linkId: string;
  direction: "blocked_by" | "blocks";
  /** The other task is completed, canceled or archived. */
  resolved: boolean;
  createdAt: string;
  other: {
    id: string;
    key: string;
    title: string;
    teamSlug: string;
    teamName: string;
    statusLabel: string;
    statusCategory: StatusCategory;
    archived: boolean;
  } | null;
};

export type ChecklistItem = { id: string; body: string; done: boolean; position: number };

export type TaskDetail = TaskCard & {
  teamId: string;
  description: string | null;
  reviewerId: string | null;
  creatorName: string | null;
  startDate: string | null;
  estimate: number | null;
  archivedAt: string | null;
  checklist: ChecklistItem[];
  comments: TaskComment[];
  activity: TaskActivity[];
  subtasks: { id: string; key: string; title: string; statusId: string; assigneeId: string | null }[];
  parent: { key: string; title: string } | null;
  linkedRequests: { id: string; number: number; title: string; status: string }[];
  dependencies: TaskDependency[];
  /** The viewer's own time on this task and their running timer (owner-only data). */
  time: TaskTime;
};

export type TeamWorkspace = {
  statuses: Status[];
  transitions: Transition[];
  members: Member[];
  labels: Label[];
  projects: ProjectRef[];
};
