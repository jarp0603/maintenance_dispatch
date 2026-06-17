import { WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/lib/work-orders/constants";

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
}

function statusLabel(status: string): string {
  return WORK_ORDER_STATUS_LABELS[status as WorkOrderStatus] ?? status;
}

export function StatusHistoryTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No status changes recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="border-border border-l-2 pl-4 text-sm">
          <p>
            {entry.old_status ? (
              <>
                <span className="text-muted-foreground">{statusLabel(entry.old_status)}</span>
                {" → "}
              </>
            ) : null}
            <span className="font-medium">{statusLabel(entry.new_status)}</span>
          </p>
          <p className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
          {entry.note ? <p className="mt-1">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
