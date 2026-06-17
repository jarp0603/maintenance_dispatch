import { WorkOrderForm } from "@/components/work-orders/work-order-form";
import { createWorkOrder } from "@/lib/work-orders/actions";

export default function NewWorkOrderPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Work Order</h1>
      <WorkOrderForm action={createWorkOrder} mode="create" />
    </div>
  );
}
