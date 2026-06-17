"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { parseTenantFormData, type TenantInput } from "./schema";

export interface TenantFormState {
  error?: string;
}

function buildTenantFields(input: TenantInput) {
  return {
    full_name: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    unit: input.unit ?? null,
    property_id: input.propertyId ?? null,
    notes: input.notes ?? null,
  };
}

export async function createTenant(
  _prevState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const user = await requireUser();
  const parsed = parseTenantFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenants").insert({
    owner_id: user.id,
    ...buildTenantFields(parsed.data),
  });

  if (error) {
    logger.error("failed to create tenant", { reason: error.message });
    return { error: "Could not create the tenant. Please try again." };
  }

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function updateTenant(
  tenantId: string,
  _prevState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  await requireUser();
  const parsed = parseTenantFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenants")
    .update(buildTenantFields(parsed.data))
    .eq("id", tenantId);

  if (error) {
    logger.error("failed to update tenant", { reason: error.message });
    return { error: "Could not save changes. Please try again." };
  }

  revalidatePath("/tenants");
  redirect("/tenants");
}
