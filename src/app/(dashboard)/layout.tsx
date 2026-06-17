import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/work-orders", label: "Work Orders" },
  { href: "/tenants", label: "Tenants" },
  { href: "/properties", label: "Properties" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <span className="font-semibold">Maintenance Dispatch</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
