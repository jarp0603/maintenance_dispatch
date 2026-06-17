"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { logger } from "@/lib/logger";
import { parseWorkOrderFormData, type WorkOrderInput } from "./schema";

export interface WorkOrderFormState {
  error?: string;
}

type DbClient = SupabaseClient<Database>;

async function findOrCreateProperty(
  supabase: DbClient,
  ownerId: string,
  name: string | undefined,
  address: string | undefined,
  propertyManager: string | undefined,
): Promise<string | null> {
  if (!name) return null;

  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("properties")
    .insert({
      owner_id: ownerId,
      name,
      address_line1: address ?? name,
      property_manager_name: propertyManager ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    logger.warn("failed to auto-create property from work order", { reason: error?.message });
    return null;
  }
  return created.id;
}

async function findOrCreateTenant(
  supabase: DbClient,
  ownerId: string,
  fullName: string,
  email: string | undefined,
  phone: string | undefined,
  unit: string | undefined,
  propertyId: string | null,
): Promise<string | null> {
  if (email) {
    const { data: existing } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", ownerId)
      .ilike("email", email)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: created, error } = await supabase
    .from("tenants")
    .insert({
      owner_id: ownerId,
      full_name: fullName,
      email: email ?? null,
      phone: phone ?? null,
      unit: unit ?? null,
      property_id: propertyId,
    })
    .select("id")
    .single();

  if (error || !created) {
    logger.warn("failed to auto-create tenant from work order", { reason: error?.message });
    return null;
  }
  return created.id;
}

async function recordStatusChange(
  supabase: DbClient,
  ownerId: string,
  workOrderId: string,
  oldStatus: string | null,
  newStatus: string,
  changedBy: string,
): Promise<void> {
  if (oldStatus === newStatus) return;

  const { error } = await supabase.from("status_history").insert({
    owner_id: ownerId,
    work_order_id: workOrderId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
  });

  if (error) {
    logger.warn("failed to record work order status history", { reason: error.message });
  }
}

function toIsoOrNull(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function buildSnapshotFields(input: WorkOrderInput) {
  return {
    tenant_name: input.tenantName,
    tenant_email: input.tenantEmail ?? null,
    tenant_phone: input.tenantPhone ?? null,
    property_name: input.propertyName ?? null,
    address: input.address ?? null,
    unit: input.unit ?? null,
    property_manager: input.propertyManager ?? null,
    issue_title: input.issueTitle,
    issue_description: input.issueDescription ?? null,
    priority: input.priority,
    access_instructions: input.accessInstructions ?? null,
    status: input.status,
    scheduled_at: toIsoOrNull(input.scheduledAt),
    internal_notes: input.internalNotes ?? null,
  };
}

export async function createWorkOrder(
  _prevState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const user = await requireUser();
  const parsed = parseWorkOrderFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const propertyId = await findOrCreateProperty(
    supabase,
    user.id,
    input.propertyName,
    input.address,
    input.propertyManager,
  );
  const tenantId = await findOrCreateTenant(
    supabase,
    user.id,
    input.tenantName,
    input.tenantEmail,
    input.tenantPhone,
    input.unit,
    propertyId,
  );

  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .insert({
      owner_id: user.id,
      tenant_id: tenantId,
      property_id: propertyId,
      source: "manual",
      ...buildSnapshotFields(input),
    })
    .select("id")
    .single();

  if (error || !workOrder) {
    logger.error("failed to create work order", { reason: error?.message });
    return { error: "Could not create the work order. Please try again." };
  }

  await recordStatusChange(supabase, user.id, workOrder.id, null, input.status, user.id);

  revalidatePath("/work-orders");
  redirect(`/work-orders/${workOrder.id}`);
}

export async function updateWorkOrder(
  workOrderId: string,
  _prevState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const user = await requireUser();
  const parsed = parseWorkOrderFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: current } = await supabase
    .from("work_orders")
    .select("status")
    .eq("id", workOrderId)
    .single();

  const { error } = await supabase
    .from("work_orders")
    .update({
      ...buildSnapshotFields(input),
      completion_notes: input.completionNotes ?? null,
      contact_attempt_count: input.contactAttemptCount ?? 0,
      next_follow_up_at: toIsoOrNull(input.nextFollowUpAt),
    })
    .eq("id", workOrderId);

  if (error) {
    logger.error("failed to update work order", { reason: error.message });
    return { error: "Could not save changes. Please try again." };
  }

  if (current && current.status !== input.status) {
    await recordStatusChange(supabase, user.id, workOrderId, current.status, input.status, user.id);
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  redirect(`/work-orders/${workOrderId}`);
}
