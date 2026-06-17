import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TenantForm } from "@/components/tenants/tenant-form";
import { createTenant } from "@/lib/tenants/actions";

export default async function NewTenantPage() {
  const supabase = await createSupabaseServerClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Tenant</h1>
      <TenantForm action={createTenant} mode="create" properties={properties ?? []} />
    </div>
  );
}
