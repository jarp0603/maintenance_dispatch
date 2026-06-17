import { requireUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">Maintenance Dispatch</span>
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
