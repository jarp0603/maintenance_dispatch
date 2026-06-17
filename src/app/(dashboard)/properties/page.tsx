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

export default async function PropertiesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, address_line1, city, state, property_manager_name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <Button asChild>
          <Link href="/properties/new">New property</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>City/State</TableHead>
            <TableHead>Property manager</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties && properties.length > 0 ? (
            properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell>{property.name}</TableCell>
                <TableCell>{property.address_line1}</TableCell>
                <TableCell>
                  {[property.city, property.state].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell>{property.property_manager_name ?? "—"}</TableCell>
                <TableCell>
                  <Link href={`/properties/${property.id}/edit`} className="hover:underline">
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                No properties yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
