import { z } from "zod";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES } from "./constants";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("Enter a valid tenant email.").optional(),
);

const optionalDatetimeLocal = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .optional()
    .refine((val) => val === undefined || !Number.isNaN(Date.parse(val)), {
      message: "Enter a valid date and time.",
    }),
);

const optionalCount = z.preprocess(
  (val) => (typeof val === "string" && val.trim() !== "" ? Number(val) : undefined),
  z.number().int().min(0).optional(),
);

export const workOrderInputSchema = z.object({
  tenantName: z.string().min(1, "Tenant name is required."),
  tenantEmail: optionalEmail,
  tenantPhone: optionalText,
  propertyName: optionalText,
  address: optionalText,
  unit: optionalText,
  issueTitle: z.string().min(1, "Issue title is required."),
  issueDescription: optionalText,
  priority: z.enum(WORK_ORDER_PRIORITIES),
  accessInstructions: optionalText,
  propertyManager: optionalText,
  status: z.enum(WORK_ORDER_STATUSES),
  scheduledAt: optionalDatetimeLocal,
  internalNotes: optionalText,
  completionNotes: optionalText,
  contactAttemptCount: optionalCount,
  nextFollowUpAt: optionalDatetimeLocal,
});

export type WorkOrderInput = z.infer<typeof workOrderInputSchema>;

export function parseWorkOrderFormData(formData: FormData) {
  return workOrderInputSchema.safeParse({
    tenantName: formData.get("tenantName"),
    tenantEmail: formData.get("tenantEmail"),
    tenantPhone: formData.get("tenantPhone"),
    propertyName: formData.get("propertyName"),
    address: formData.get("address"),
    unit: formData.get("unit"),
    issueTitle: formData.get("issueTitle"),
    issueDescription: formData.get("issueDescription"),
    priority: formData.get("priority"),
    accessInstructions: formData.get("accessInstructions"),
    propertyManager: formData.get("propertyManager"),
    status: formData.get("status"),
    scheduledAt: formData.get("scheduledAt"),
    internalNotes: formData.get("internalNotes"),
    completionNotes: formData.get("completionNotes"),
    contactAttemptCount: formData.get("contactAttemptCount"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });
}
