import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getClients } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PoFormatManager } from "@/components/PoFormatManager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/po-formats")({
  component: POFormatsPage,
});

function POFormatsPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(),
  });

  return (
    <AppShell variant="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PO Formats</h2>
          <p className="text-muted-foreground">
            Manage custom Purchase Order formats (letterheads & templates) for each client.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label>Client</Label>
                {clientsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading clients...
                  </div>
                ) : (
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client to manage their PO format" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.legal_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedClientId && (
          <PoFormatManager organizationId={selectedClientId} />
        )}
      </div>
    </AppShell>
  );
}
