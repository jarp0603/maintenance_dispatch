import { z } from "zod";

/** Sentinel for the form's "no property" select option (Radix Select disallows an empty string value). */
export const NO_PROPERTY_VALUE = "__none__";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("Enter a valid email.").optional(),
);
const optionalPropertyId = z.preprocess(
  (val) => (val === NO_PROPERTY_VALUE ? undefined : emptyToUndefined(val)),
  z.string().optional(),
);

export const tenantInputSchema = z.object({
  fullName: z.string().min(1, "Tenant name is required."),
  email: optionalEmail,
  phone: optionalText,
  unit: optionalText,
  propertyId: optionalPropertyId,
  notes: optionalText,
});

export type TenantInput = z.infer<typeof tenantInputSchema>;

export function parseTenantFormData(formData: FormData) {
  return tenantInputSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    unit: formData.get("unit"),
    propertyId: formData.get("propertyId"),
    notes: formData.get("notes"),
  });
}
