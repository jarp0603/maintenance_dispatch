"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PropertyFormState } from "@/lib/properties/actions";

export interface PropertyFormDefaults {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  propertyManagerName?: string;
  propertyManagerPhone?: string;
  propertyManagerEmail?: string;
  notes?: string;
}

interface PropertyFormProps {
  action: (prevState: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  defaultValues?: PropertyFormDefaults;
  mode: "create" | "edit";
}

const initialState: PropertyFormState = {};

export function PropertyForm({ action, defaultValues = {}, mode }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Property name</Label>
        <Input id="name" name="name" defaultValue={defaultValues.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={defaultValues.addressLine1} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input id="addressLine2" name="addressLine2" defaultValue={defaultValues.addressLine2} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={defaultValues.city} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={defaultValues.state} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={defaultValues.postalCode} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="propertyManagerName">Property manager name</Label>
        <Input
          id="propertyManagerName"
          name="propertyManagerName"
          defaultValue={defaultValues.propertyManagerName}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="propertyManagerPhone">Property manager phone</Label>
          <Input
            id="propertyManagerPhone"
            name="propertyManagerPhone"
            defaultValue={defaultValues.propertyManagerPhone}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyManagerEmail">Property manager email</Label>
          <Input
            id="propertyManagerEmail"
            name="propertyManagerEmail"
            type="email"
            defaultValue={defaultValues.propertyManagerEmail}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={defaultValues.notes} rows={3} />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create property" : "Save changes"}
      </Button>
    </form>
  );
}
