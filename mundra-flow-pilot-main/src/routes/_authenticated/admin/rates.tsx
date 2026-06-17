import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRates, getProducts, getClients, createOrUpdateRate } from "@/lib/api/business.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { IndianRupee, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rates")({
  ssr: false,
  component: AdminRatesPage,
});

function AdminRatesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form states
  const [productId, setProductId] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("generic"); // "generic" = null
  const [amount, setAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState("");

  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ["admin-rates"],
    queryFn: () => getRates(),
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getProducts(),
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const createMutation = useMutation({
    mutationFn: (newRate: any) => createOrUpdateRate({ data: newRate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rates"] });
      toast.success("Rate successfully updated!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to save rate");
    },
  });

  function resetForm() {
    setProductId("");
    setOrganizationId("generic");
    setAmount(0);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEffectiveTo("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      productId,
      organizationId: organizationId === "generic" ? null : organizationId,
      amount,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rate Administration</h1>
            <p className="text-sm text-muted-foreground">
              Define standard/generic rates and override rates per client organization.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Set New Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Configure Pricing Rule</DialogTitle>
                  <DialogDescription>
                    Configure generic product rates or target a specific client override rate.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="product">Product *</Label>
                    <Select value={productId} onValueChange={setProductId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.grade ? `(${p.grade})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="organization">Target Client Scope *</Label>
                    <Select value={organizationId} onValueChange={setOrganizationId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="generic">Generic (All Clients)</SelectItem>
                        {clients?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="amount">Rate per MT *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      placeholder="e.g. 5200"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="effectiveFrom">Effective From *</Label>
                      <Input
                        id="effectiveFrom"
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="effectiveTo">Effective To</Label>
                      <Input
                        id="effectiveTo"
                        type="date"
                        value={effectiveTo}
                        onChange={(e) => setEffectiveTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Rate Rule
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {ratesLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Pricing Rates Register</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Client Scope</TableHead>
                    <TableHead>Rate Amount</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead>Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates && rates.length > 0 ? (
                    rates.map((rate: any) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">
                          {rate.products?.name} {rate.products?.grade ? `(${rate.products?.grade})` : ""}
                        </TableCell>
                        <TableCell>
                          {rate.organizations?.legal_name ?? (
                            <span className="text-muted-foreground italic">Generic (All Clients)</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(rate.amount)} / {rate.products?.unit ?? "MT"}
                        </TableCell>
                        <TableCell>{new Date(rate.effective_from).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {rate.effective_to ? new Date(rate.effective_to).toLocaleDateString() : "Active"}
                        </TableCell>
                        <TableCell>
                          {rate.organization_id ? (
                            <Badge variant="outline" className="border-warning text-warning bg-warning/5">
                              Override
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success bg-success/5">
                              Standard
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No rates configured yet. Click "Set New Rate" to define pricing rules.
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
