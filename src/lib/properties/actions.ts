"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { parsePropertyFormData, type PropertyInput } from "./schema";

export interface PropertyFormState {
  error?: string;
}

function buildPropertyFields(input: PropertyInput) {
  return {
    name: input.name,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    property_manager_name: input.propertyManagerName ?? null,
    property_manager_phone: input.propertyManagerPhone ?? null,
    property_manager_email: input.propertyManagerEmail ?? null,
    notes: input.notes ?? null,
  };
}

export async function createProperty(
  _prevState: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const user = await requireUser();
  const parsed = parsePropertyFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("properties").insert({
    owner_id: user.id,
    ...buildPropertyFields(parsed.data),
  });

  if (error) {
    logger.error("failed to create property", { reason: error.message });
    return { error: "Could not create the property. Please try again." };
  }

  revalidatePath("/properties");
  redirect("/properties");
}

export async function updateProperty(
  propertyId: string,
  _prevState: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  await requireUser();
  const parsed = parsePropertyFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("properties")
    .update(buildPropertyFields(parsed.data))
    .eq("id", propertyId);

  if (error) {
    logger.error("failed to update property", { reason: error.message });
    return { error: "Could not save changes. Please try again." };
  }

  revalidatePath("/properties");
  redirect("/properties");
}
