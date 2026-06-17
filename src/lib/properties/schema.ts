import { z } from "zod";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("Enter a valid email.").optional(),
);

export const propertyInputSchema = z.object({
  name: z.string().min(1, "Property name is required."),
  addressLine1: z.string().min(1, "Address is required."),
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  propertyManagerName: optionalText,
  propertyManagerPhone: optionalText,
  propertyManagerEmail: optionalEmail,
  notes: optionalText,
});

export type PropertyInput = z.infer<typeof propertyInputSchema>;

export function parsePropertyFormData(formData: FormData) {
  return propertyInputSchema.safeParse({
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    propertyManagerName: formData.get("propertyManagerName"),
    propertyManagerPhone: formData.get("propertyManagerPhone"),
    propertyManagerEmail: formData.get("propertyManagerEmail"),
    notes: formData.get("notes"),
  });
}
