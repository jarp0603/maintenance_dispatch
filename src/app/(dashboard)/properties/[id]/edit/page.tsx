import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PropertyForm } from "@/components/properties/property-form";
import { updateProperty } from "@/lib/properties/actions";

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!property) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Property</h1>
      <PropertyForm
        action={updateProperty.bind(null, property.id)}
        mode="edit"
        defaultValues={{
          name: property.name,
          addressLine1: property.address_line1,
          addressLine2: property.address_line2 ?? undefined,
          city: property.city ?? undefined,
          state: property.state ?? undefined,
          postalCode: property.postal_code ?? undefined,
          propertyManagerName: property.property_manager_name ?? undefined,
          propertyManagerPhone: property.property_manager_phone ?? undefined,
          propertyManagerEmail: property.property_manager_email ?? undefined,
          notes: property.notes ?? undefined,
        }}
      />
    </div>
  );
}
