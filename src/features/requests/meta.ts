import type { Database } from "@/types/db";

export type RequestStatus = Database["public"]["Enums"]["request_status"];

/** Canonical lifecycle labels (receiving team) — spec §5.1. */
export const TEAM_LABEL: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_triage: "In triage",
  needs_info: "Needs information",
  accepted: "Accepted / Planned",
  in_progress: "In progress",
  delivered: "Delivered",
  closed: "Closed",
  declined: "Declined",
};

/** Plain-language requester labels; each maps 1:1 to a canonical state. */
export const REQUESTER_LABEL: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_triage: "Under review",
  needs_info: "Needs your input",
  accepted: "Planned",
  in_progress: "In progress",
  delivered: "Delivered",
  closed: "Closed",
  declined: "Declined",
};

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
export const STATUS_TONE: Record<RequestStatus, Tone> = {
  draft: "neutral",
  submitted: "accent",
  in_triage: "accent",
  needs_info: "warning",
  accepted: "accent",
  in_progress: "accent",
  delivered: "success",
  closed: "neutral",
  declined: "neutral",
};

/** Mirrors app.request_transition_allowed in SQL; the database is authoritative. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: [],
  submitted: ["in_triage", "declined"],
  in_triage: ["needs_info", "accepted", "declined"],
  needs_info: ["in_triage", "declined"],
  accepted: ["in_progress", "delivered", "declined"],
  in_progress: ["delivered", "accepted"],
  delivered: ["closed", "in_progress"],
  closed: ["in_triage"],
  declined: ["in_triage"],
};

export const OPEN_STATUSES: RequestStatus[] = ["submitted", "in_triage", "needs_info", "accepted", "in_progress", "delivered"];
