import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TenantForm } from "@/components/tenants/tenant-form";
import { updateTenant } from "@/lib/tenants/actions";

interface EditTenantPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTenantPage({ params }: EditTenantPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: tenant }, { data: properties }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
    supabase.from("properties").select("id, name").order("name", { ascending: true }),
  ]);

  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Tenant</h1>
      <TenantForm
        action={updateTenant.bind(null, tenant.id)}
        mode="edit"
        properties={properties ?? []}
        defaultValues={{
          fullName: tenant.full_name,
          email: tenant.email ?? undefined,
          phone: tenant.phone ?? undefined,
          unit: tenant.unit ?? undefined,
          propertyId: tenant.property_id ?? undefined,
          notes: tenant.notes ?? undefined,
        }}
      />
    </div>
  );
}
