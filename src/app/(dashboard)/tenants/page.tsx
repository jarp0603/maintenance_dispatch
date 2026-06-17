import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TenantsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: tenants }, { data: properties }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, full_name, email, phone, unit, property_id")
      .order("full_name", { ascending: true }),
    supabase.from("properties").select("id, name"),
  ]);

  const propertyNameById = new Map((properties ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <Button asChild>
          <Link href="/tenants/new">New tenant</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Property</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants && tenants.length > 0 ? (
            tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>{tenant.full_name}</TableCell>
                <TableCell>{tenant.email ?? "—"}</TableCell>
                <TableCell>{tenant.phone ?? "—"}</TableCell>
                <TableCell>{tenant.unit ?? "—"}</TableCell>
                <TableCell>
                  {tenant.property_id ? propertyNameById.get(tenant.property_id) ?? "—" : "—"}
                </TableCell>
                <TableCell>
                  <Link href={`/tenants/${tenant.id}/edit`} className="hover:underline">
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">
                No tenants yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
