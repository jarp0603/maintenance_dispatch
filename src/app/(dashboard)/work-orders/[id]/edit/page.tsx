import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { updateWorkOrder } from "@/lib/work-orders/actions";

interface EditWorkOrderPageProps {
  params: Promise<{ id: string }>;
}

function toDatetimeLocalValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditWorkOrderPage({ params }: EditWorkOrderPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: workOrder } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!workOrder) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Work Order</h1>
      <WorkOrderForm
        action={updateWorkOrder.bind(null, workOrder.id)}
        mode="edit"
        defaultValues={{
          tenantName: workOrder.tenant_name,
          tenantEmail: workOrder.tenant_email ?? undefined,
          tenantPhone: workOrder.tenant_phone ?? undefined,
          propertyName: workOrder.property_name ?? undefined,
          address: workOrder.address ?? undefined,
          unit: workOrder.unit ?? undefined,
          propertyManager: workOrder.property_manager ?? undefined,
          issueTitle: workOrder.issue_title,
          issueDescription: workOrder.issue_description ?? undefined,
          priority: workOrder.priority,
          accessInstructions: workOrder.access_instructions ?? undefined,
          status: workOrder.status,
          scheduledAt: toDatetimeLocalValue(workOrder.scheduled_at),
          internalNotes: workOrder.internal_notes ?? undefined,
          completionNotes: workOrder.completion_notes ?? undefined,
          contactAttemptCount: workOrder.contact_attempt_count,
          nextFollowUpAt: toDatetimeLocalValue(workOrder.next_follow_up_at),
        }}
      />
    </div>
  );
}
