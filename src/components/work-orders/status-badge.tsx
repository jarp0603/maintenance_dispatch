import { Badge } from "@/components/ui/badge";
import {
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatus,
} from "@/lib/work-orders/constants";

export function StatusBadge({ status }: { status: string }) {
  const knownStatus = status as WorkOrderStatus;
  const label = WORK_ORDER_STATUS_LABELS[knownStatus] ?? status;
  const variant = WORK_ORDER_STATUS_BADGE_VARIANT[knownStatus] ?? "outline";

  return <Badge variant={variant}>{label}</Badge>;
}
