"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
} from "@/lib/work-orders/constants";
import type { WorkOrderFormState } from "@/lib/work-orders/actions";

export interface WorkOrderFormDefaults {
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  propertyName?: string;
  address?: string;
  unit?: string;
  propertyManager?: string;
  issueTitle?: string;
  issueDescription?: string;
  priority?: string;
  accessInstructions?: string;
  status?: string;
  scheduledAt?: string;
  internalNotes?: string;
  completionNotes?: string;
  contactAttemptCount?: number;
  nextFollowUpAt?: string;
}

interface WorkOrderFormProps {
  action: (prevState: WorkOrderFormState, formData: FormData) => Promise<WorkOrderFormState>;
  defaultValues?: WorkOrderFormDefaults;
  mode: "create" | "edit";
}

const initialState: WorkOrderFormState = {};

export function WorkOrderForm({ action, defaultValues = {}, mode }: WorkOrderFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tenant</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenantName">Tenant name</Label>
            <Input id="tenantName" name="tenantName" defaultValue={defaultValues.tenantName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenantEmail">Tenant email</Label>
            <Input
              id="tenantEmail"
              name="tenantEmail"
              type="email"
              defaultValue={defaultValues.tenantEmail}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenantPhone">Tenant phone</Label>
            <Input id="tenantPhone" name="tenantPhone" defaultValue={defaultValues.tenantPhone} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Property</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="propertyName">Property name</Label>
            <Input id="propertyName" name="propertyName" defaultValue={defaultValues.propertyName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" defaultValue={defaultValues.unit} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={defaultValues.address} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="propertyManager">Property manager</Label>
            <Input
              id="propertyManager"
              name="propertyManager"
              defaultValue={defaultValues.propertyManager}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Issue</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issueTitle">Issue title</Label>
            <Input id="issueTitle" name="issueTitle" defaultValue={defaultValues.issueTitle} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDescription">Issue description</Label>
            <Textarea
              id="issueDescription"
              name="issueDescription"
              defaultValue={defaultValues.issueDescription}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessInstructions">Access instructions</Label>
            <Textarea
              id="accessInstructions"
              name="accessInstructions"
              defaultValue={defaultValues.accessInstructions}
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue={defaultValues.priority ?? "normal"}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {WORK_ORDER_PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={defaultValues.status ?? "new"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {WORK_ORDER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Scheduled time</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              defaultValue={defaultValues.scheduledAt}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Notes</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal notes</Label>
            <Textarea
              id="internalNotes"
              name="internalNotes"
              defaultValue={defaultValues.internalNotes}
              rows={3}
            />
          </div>
          {mode === "edit" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="completionNotes">Completion notes</Label>
                <Textarea
                  id="completionNotes"
                  name="completionNotes"
                  defaultValue={defaultValues.completionNotes}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactAttemptCount">Contact attempts</Label>
                  <Input
                    id="contactAttemptCount"
                    name="contactAttemptCount"
                    type="number"
                    min={0}
                    defaultValue={defaultValues.contactAttemptCount ?? 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextFollowUpAt">Next follow-up</Label>
                  <Input
                    id="nextFollowUpAt"
                    name="nextFollowUpAt"
                    type="datetime-local"
                    defaultValue={defaultValues.nextFollowUpAt}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create work order" : "Save changes"}
      </Button>
    </form>
  );
}
