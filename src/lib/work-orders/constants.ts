export const WORK_ORDER_STATUSES = [
  "new",
  "needs_review",
  "ready_to_contact",
  "awaiting_tenant",
  "no_response",
  "scheduled",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "additional_work_required",
  "closed",
  "canceled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  new: "New",
  needs_review: "Needs Review",
  ready_to_contact: "Ready to Contact",
  awaiting_tenant: "Awaiting Tenant",
  no_response: "No Response",
  scheduled: "Scheduled",
  en_route: "En Route",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  additional_work_required: "Additional Work Required",
  closed: "Closed",
  canceled: "Canceled",
};

/** Badge color variant per status, grouped by what the status means for the operator. */
export const WORK_ORDER_STATUS_BADGE_VARIANT: Record<
  WorkOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  new: "secondary",
  needs_review: "destructive",
  ready_to_contact: "secondary",
  awaiting_tenant: "outline",
  no_response: "destructive",
  scheduled: "default",
  en_route: "default",
  arrived: "default",
  in_progress: "default",
  completed: "secondary",
  additional_work_required: "destructive",
  closed: "outline",
  canceled: "outline",
};

export const WORK_ORDER_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
