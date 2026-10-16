import { z } from "zod";

const uuid = z.uuid({ message: "Invalid reference." });
const optionalUuid = z.union([uuid, z.literal(""), z.null()]).transform((v) => (v ? v : null));
const isoDate = z.union([z.iso.date({ message: "Use a valid date." }), z.literal(""), z.null()]).transform((v) => (v ? v : null));

export const priority = z.enum(["none", "low", "medium", "high", "urgent"]);
export const taskType = z.enum(["task", "bug", "feature", "chore", "research", "documentation"]);

export const createTaskSchema = z.object({
  teamSlug: z.string().min(2).max(40),
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Keep the title under 200 characters."),
  description: z
    .string()
    .max(20000)
    .optional()
    .transform((v) => (v?.trim() ? v : null)),
  statusId: optionalUuid.optional(),
  priority: priority.default("none"),
  type: taskType.default("task"),
  assigneeId: optionalUuid.optional(),
  dueDate: isoDate.optional(),
  projectId: optionalUuid.optional(),
  milestoneId: optionalUuid.optional(),
  parentId: optionalUuid.optional(),
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title can't be empty.").max(200),
    description: z
      .string()
      .max(20000)
      .transform((v) => (v.trim() ? v : null)),
    priority,
    type: taskType,
    assigneeId: optionalUuid,
    reviewerId: optionalUuid,
    dueDate: isoDate,
    startDate: isoDate,
    projectId: optionalUuid,
    milestoneId: optionalUuid,
    estimate: z.union([z.number().int().min(0).max(100), z.null()]),
    blocked: z.boolean(),
    blockedReason: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v ? v : null)),
  })
  .partial()
  .refine((v) => !(v.blocked === true && !v.blockedReason), {
    path: ["blockedReason"],
    message: "Say what's blocking this so someone can help.",
  });
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  taskId: uuid,
  statusId: uuid,
  version: z.number().int().positive(),
  afterId: optionalUuid.optional(),
  beforeId: optionalUuid.optional(),
});

export const commentSchema = z.object({
  taskId: uuid,
  body: z.string().trim().min(1, "Write a comment first.").max(10000, "That comment is too long."),
});

export const checklistSchema = z.object({
  taskId: uuid,
  body: z.string().trim().min(1, "Describe the step.").max(300),
});
