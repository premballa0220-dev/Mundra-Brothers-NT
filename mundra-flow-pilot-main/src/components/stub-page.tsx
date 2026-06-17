import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function StubPage({
  variant,
  title,
  description,
}: {
  variant: "client" | "admin";
  title: string;
  description: string;
}) {
  return (
    <AppShell variant={variant}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>

        <Card className="mt-6 border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted grid place-items-center">
              <Construction className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">This screen ships in the next phase</p>
              <p className="text-sm text-muted-foreground max-w-md">
                The foundation (multi-tenant model, role-based access, dashboards) is in
                place. Detailed CRUD, workflows and document generation for this module are
                next on the build plan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
