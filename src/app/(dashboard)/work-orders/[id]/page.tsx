import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { StatusHistoryTimeline } from "@/components/work-orders/status-history-timeline";
import { WORK_ORDER_PRIORITY_LABELS, type WorkOrderPriority } from "@/lib/work-orders/constants";

interface WorkOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkOrderDetailPage({ params }: WorkOrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: workOrder }, { data: history }] = await Promise.all([
    supabase.from("work_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("status_history")
      .select("id, old_status, new_status, note, created_at")
      .eq("work_order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!workOrder) {
    notFound();
  }

  const priorityLabel =
    WORK_ORDER_PRIORITY_LABELS[workOrder.priority as WorkOrderPriority] ?? workOrder.priority;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{workOrder.reference_number}</p>
          <h1 className="text-2xl font-semibold">{workOrder.issue_title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={workOrder.status} />
            <span className="text-muted-foreground text-sm">{priorityLabel} priority</span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/work-orders/${workOrder.id}/edit`}>Edit</Link>
        </Button>
      </div>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Tenant</h2>
          <p>{workOrder.tenant_name}</p>
          {workOrder.tenant_email ? (
            <p className="text-muted-foreground text-sm">{workOrder.tenant_email}</p>
          ) : null}
          {workOrder.tenant_phone ? (
            <p className="text-muted-foreground text-sm">{workOrder.tenant_phone}</p>
          ) : null}
        </div>
        <div>
          <h2 className="text-sm font-semibold">Property</h2>
          <p>{workOrder.property_name ?? "—"}</p>
          {workOrder.address ? <p className="text-muted-foreground text-sm">{workOrder.address}</p> : null}
          {workOrder.unit ? <p className="text-muted-foreground text-sm">Unit {workOrder.unit}</p> : null}
          {workOrder.property_manager ? (
            <p className="text-muted-foreground text-sm">Manager: {workOrder.property_manager}</p>
          ) : null}
        </div>
      </section>

      {workOrder.issue_description ? (
        <section>
          <h2 className="text-sm font-semibold">Issue description</h2>
          <p className="whitespace-pre-wrap">{workOrder.issue_description}</p>
        </section>
      ) : null}

      {workOrder.access_instructions ? (
        <section>
          <h2 className="text-sm font-semibold">Access instructions</h2>
          <p className="whitespace-pre-wrap">{workOrder.access_instructions}</p>
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Scheduling</h2>
          <p className="text-sm">
            Scheduled:{" "}
            {workOrder.scheduled_at ? new Date(workOrder.scheduled_at).toLocaleString() : "Not scheduled"}
          </p>
          <p className="text-sm">
            Next follow-up:{" "}
            {workOrder.next_follow_up_at ? new Date(workOrder.next_follow_up_at).toLocaleString() : "—"}
          </p>
          <p className="text-sm">Contact attempts: {workOrder.contact_attempt_count}</p>
          <p className="text-sm">
            Last contact:{" "}
            {workOrder.last_contact_at ? new Date(workOrder.last_contact_at).toLocaleString() : "—"}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Record</h2>
          <p className="text-sm">Created: {new Date(workOrder.created_at).toLocaleString()}</p>
          <p className="text-sm">Updated: {new Date(workOrder.updated_at).toLocaleString()}</p>
          <p className="text-sm">Source: {workOrder.source}</p>
        </div>
      </section>

      {workOrder.internal_notes ? (
        <section>
          <h2 className="text-sm font-semibold">Internal notes</h2>
          <p className="whitespace-pre-wrap">{workOrder.internal_notes}</p>
        </section>
      ) : null}

      {workOrder.completion_notes ? (
        <section>
          <h2 className="text-sm font-semibold">Completion notes</h2>
          <p className="whitespace-pre-wrap">{workOrder.completion_notes}</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Status history</h2>
        <StatusHistoryTimeline entries={history ?? []} />
      </section>
    </div>
  );
}
