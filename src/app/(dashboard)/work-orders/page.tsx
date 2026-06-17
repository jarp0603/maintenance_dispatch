import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/work-orders/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderPriority,
} from "@/lib/work-orders/constants";
import { sanitizeSearchTerm } from "@/lib/search";

interface WorkOrdersPageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function WorkOrdersPage({ searchParams }: WorkOrdersPageProps) {
  const params = await searchParams;
  const status = params.status;
  const searchTerm = params.q ? sanitizeSearchTerm(params.q) : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("work_orders")
    .select("id, reference_number, tenant_name, issue_title, status, priority, created_at")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (searchTerm) {
    query = query.or(
      `tenant_name.ilike.%${searchTerm}%,issue_title.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,reference_number.ilike.%${searchTerm}%`,
    );
  }

  const { data: workOrders } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Work Orders</h1>
        <Button asChild>
          <Link href="/work-orders/new">New work order</Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="GET">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={params.q} placeholder="Tenant, issue, address, reference…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? "all"}
            className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
          >
            <option value="all">All</option>
            {WORK_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WORK_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders && workOrders.length > 0 ? (
            workOrders.map((workOrder) => (
              <TableRow key={workOrder.id}>
                <TableCell>
                  <Link href={`/work-orders/${workOrder.id}`} className="hover:underline">
                    {workOrder.reference_number}
                  </Link>
                </TableCell>
                <TableCell>{workOrder.tenant_name}</TableCell>
                <TableCell>{workOrder.issue_title}</TableCell>
                <TableCell>
                  <StatusBadge status={workOrder.status} />
                </TableCell>
                <TableCell>
                  {WORK_ORDER_PRIORITY_LABELS[workOrder.priority as WorkOrderPriority] ??
                    workOrder.priority}
                </TableCell>
                <TableCell>{new Date(workOrder.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">
                No work orders match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
