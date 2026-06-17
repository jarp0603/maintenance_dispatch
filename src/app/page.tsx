import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Maintenance Dispatch</h1>
      <p className="text-muted-foreground max-w-md">
        Foundation is set up. The dashboard, authentication, and work-order management land in the
        next phases.
      </p>
      <Button disabled>Dashboard (coming soon)</Button>
    </div>
  );
}
