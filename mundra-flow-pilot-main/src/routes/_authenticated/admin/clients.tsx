import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClients, createClient } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  ssr: false,
  component: AdminClientsPage,
});

function AdminClientsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form states
  const [legalName, setLegalName] = useState("");
  const [shortName, setShortName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [gracePeriodDays, setGracePeriodDays] = useState(0);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const createMutation = useMutation({
    mutationFn: (newClient: any) => createClient({ data: newClient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client organization onboarded successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to onboard client");
    },
  });

  function resetForm() {
    setLegalName("");
    setShortName("");
    setGstNumber("");
    setPanNumber("");
    setCreditLimit(0);
    setPaymentTermsDays(30);
    setGracePeriodDays(0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      legalName,
      shortName,
      gstNumber,
      panNumber,
      creditLimit,
      paymentTermsDays,
      gracePeriodDays,
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Client Directory</h1>
            <p className="text-sm text-muted-foreground">
              Manage client organizations, commercial credit limits, payment terms, and onboarding.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Onboard Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Onboard Client Organization</DialogTitle>
                  <DialogDescription>
                    Configure legal identity and commercial credit terms for the new tenant.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="legalName" className="text-right">
                      Legal Name *
                    </Label>
                    <Input
                      id="legalName"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="shortName" className="text-right">
                      Short Name
                    </Label>
                    <Input
                      id="shortName"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gstNumber" className="text-right">
                      GST Number
                    </Label>
                    <Input
                      id="gstNumber"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="panNumber" className="text-right">
                      PAN Number
                    </Label>
                    <Input
                      id="panNumber"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <hr className="my-2 border-border" />
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="creditLimit" className="text-right">
                      Credit Limit *
                    </Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="paymentTerms" className="text-right">
                      Terms (Days) *
                    </Label>
                    <Input
                      id="paymentTerms"
                      type="number"
                      value={paymentTermsDays}
                      onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gracePeriod" className="text-right">
                      Grace (Days)
                    </Label>
                    <Input
                      id="gracePeriod"
                      type="number"
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Active Client Organizations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Legal Name</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>GST Number</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Grace Period</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients && clients.length > 0 ? (
                    clients.map((client: any) => {
                      const comm = client.client_commercial_profiles?.[0] || {};
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {client.legal_name}
                            </div>
                          </TableCell>
                          <TableCell>{client.short_name ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {client.gst_number ?? "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(comm.credit_limit ?? 0)}
                          </TableCell>
                          <TableCell>{comm.payment_terms_days ?? 30} Days</TableCell>
                          <TableCell>{comm.grace_period_days ?? 0} Days</TableCell>
                          <TableCell>
                            <Badge
                              variant={client.status === "active" ? "success" : "secondary"}
                              className="capitalize"
                            >
                              {client.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No clients onboarded yet. Click "Onboard Client" to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
