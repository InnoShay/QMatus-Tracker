import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const clock = z.string().regex(/^\d{2}:\d{2}$/, "Enter a time.");
const note = z
  .string()
  .trim()
  .max(500, "Keep the note under 500 characters.")
  .optional()
  .transform((v) => v || null);

/** Wall-clock values in the viewer's profile time zone; converted on the server. */
export const manualEntrySchema = z.object({
  taskId: z.uuid(),
  date,
  start: clock,
  end: clock,
  note,
  requestId: z.uuid(),
});
export type ManualEntryInput = z.input<typeof manualEntrySchema>;

export const correctionSchema = z.object({
  entryId: z.uuid(),
  version: z.number().int().positive(),
  date,
  start: clock,
  end: clock,
  note,
});
export type CorrectionInput = z.input<typeof correctionSchema>;
