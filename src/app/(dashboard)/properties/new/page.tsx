import { PropertyForm } from "@/components/properties/property-form";
import { createProperty } from "@/lib/properties/actions";

export default function NewPropertyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Property</h1>
      <PropertyForm action={createProperty} mode="create" />
    </div>
  );
}
