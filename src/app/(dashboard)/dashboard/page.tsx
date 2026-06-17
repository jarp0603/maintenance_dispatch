import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/work-orders/status-badge";

const CLOSED_STATUSES = new Set(["completed", "closed", "canceled"]);

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: statusRows }, { data: recent }] = await Promise.all([
    supabase.from("work_orders").select("status"),
    supabase
      .from("work_orders")
      .select("id, tenant_name, issue_title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const rows = statusRows ?? [];
  const openCount = rows.filter((row) => !CLOSED_STATUSES.has(row.status)).length;
  const needsReviewCount = rows.filter((row) => row.status === "needs_review").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button asChild>
          <Link href="/work-orders/new">New work order</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Open work orders
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{openCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Needs review</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{needsReviewCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total work orders
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{rows.length}</CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent work orders</h2>
        {recent && recent.length > 0 ? (
          <ul className="space-y-2">
            {recent.map((workOrder) => (
              <li key={workOrder.id}>
                <Link
                  href={`/work-orders/${workOrder.id}`}
                  className="hover:bg-accent flex items-center justify-between rounded-lg border p-3"
                >
                  <span>
                    <span className="font-medium">{workOrder.tenant_name}</span> —{" "}
                    {workOrder.issue_title}
                  </span>
                  <StatusBadge status={workOrder.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No work orders yet.{" "}
            <Link href="/work-orders/new" className="underline">
              Create one
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
