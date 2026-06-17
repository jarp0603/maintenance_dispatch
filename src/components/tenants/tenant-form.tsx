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
import type { TenantFormState } from "@/lib/tenants/actions";
import { NO_PROPERTY_VALUE } from "@/lib/tenants/schema";

export interface TenantFormDefaults {
  fullName?: string;
  email?: string;
  phone?: string;
  unit?: string;
  propertyId?: string;
  notes?: string;
}

interface TenantFormProps {
  action: (prevState: TenantFormState, formData: FormData) => Promise<TenantFormState>;
  defaultValues?: TenantFormDefaults;
  mode: "create" | "edit";
  properties: { id: string; name: string }[];
}

const initialState: TenantFormState = {};

export function TenantForm({ action, defaultValues = {}, mode, properties }: TenantFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Tenant name</Label>
        <Input id="fullName" name="fullName" defaultValue={defaultValues.fullName} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues.phone} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" name="unit" defaultValue={defaultValues.unit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="propertyId">Property</Label>
        <Select name="propertyId" defaultValue={defaultValues.propertyId ?? NO_PROPERTY_VALUE}>
          <SelectTrigger id="propertyId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROPERTY_VALUE}>— None —</SelectItem>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={defaultValues.notes} rows={3} />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create tenant" : "Save changes"}
      </Button>
    </form>
  );
}
