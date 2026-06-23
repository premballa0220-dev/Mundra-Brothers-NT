import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDispatchRequests, createDispatchRequest, getPurchaseOrders, getClientDeliveryLocations } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Plus, Loader2, AlertTriangle, CreditCard, FileSignature, HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/client/dispatches")({
  ssr: false,
  component: ClientDispatchesPage,
});

function ClientDispatchesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form states
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split("T")[0]);
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");

  const { data: deliveryLocations } = useQuery({
    queryKey: ["client-delivery-locations"],
    queryFn: () => getClientDeliveryLocations(),
  });

  const { data: dispatches, isLoading: dispatchesLoading } = useQuery({
    queryKey: ["client-dispatches"],
    queryFn: () => getDispatchRequests(),
  });

  const { data: pos } = useQuery({
    queryKey: ["client-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  // Automatically pre-fill site address and contact when modal opens or PO is selected
  useEffect(() => {
    if (!open) return;
    if (purchaseOrderId && pos) {
      const selectedPo = pos.find((p: any) => p.id === purchaseOrderId);
      if (selectedPo) {
        setSiteAddress(selectedPo.site_address);
        setDeliveryContact(selectedPo.delivery_contact ?? "");
        return;
      }
    }
    
    // Fallback to default delivery location if PO doesn't have one or none selected
    if (deliveryLocations && deliveryLocations.length > 0) {
      const defaultLoc = deliveryLocations.find((l: any) => l.is_default) || deliveryLocations[0];
      setSiteAddress(defaultLoc.address);
      setDeliveryContact("");
    } else {
      setSiteAddress("");
      setDeliveryContact("");
    }
  }, [open, purchaseOrderId, pos, deliveryLocations]);

  const createMutation = useMutation({
    mutationFn: (newDr: any) => createDispatchRequest({ data: newDr }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-dispatches"] });
      toast.success("Dispatch request submitted! Automated eligibility checks initiated.");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to request dispatch");
    },
  });

  function resetForm() {
    setPurchaseOrderId("");
    setQuantity(0);
    setRequestedDate(new Date().toISOString().split("T")[0]);
    setSiteAddress("");
    setDeliveryContact("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    createMutation.mutate({
      purchaseOrderId,
      quantity,
      requestedDate,
      siteAddress,
      deliveryContact,
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const approvedPOs = pos?.filter((p: any) => p.status === "approved") ?? [];

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dispatch Requests</h1>
            <p className="text-sm text-muted-foreground">
              Request dispatch of materials against approved POs. Blocked requests are verified against real-time credit metrics.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Request Dispatch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Request Material Dispatch</DialogTitle>
                  <DialogDescription>
                    Select an approved contract PO and specify the quantity and date.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="po">Purchase Order Scope *</Label>
                    <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Approved PO" />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedPOs.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.po_number} — {p.products?.name} ({Number(p.original_quantity).toFixed(0)} MT)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="qty">Dispatch Qty (MT) *</Label>
                      <Input
                        id="qty"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantity || ""}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="date">Requested Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="address">Site Address *</Label>
                    {deliveryLocations && deliveryLocations.length > 0 ? (
                      <Select value={siteAddress} onValueChange={setSiteAddress} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Delivery Address" />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryLocations.map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.address}>
                              <span className="font-semibold">{loc.label}</span> - <span className="text-muted-foreground">{loc.address.substring(0, 30)}...</span>
                            </SelectItem>
                          ))}
                          {purchaseOrderId && pos?.find((p: any) => p.id === purchaseOrderId)?.site_address && !deliveryLocations.find((l: any) => l.address === pos?.find((p: any) => p.id === purchaseOrderId)?.site_address) && (
                            <SelectItem value={pos.find((p: any) => p.id === purchaseOrderId).site_address}>
                              <span className="font-semibold">PO Address</span> - <span className="text-muted-foreground">{pos.find((p: any) => p.id === purchaseOrderId).site_address.substring(0, 30)}...</span>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="address"
                        value={siteAddress}
                        onChange={(e) => setSiteAddress(e.target.value)}
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contact">Site Contact Info</Label>
                    <Input
                      id="contact"
                      value={deliveryContact}
                      onChange={(e) => setDeliveryContact(e.target.value)}
                    />
                  </div>
                  {deliveryLocations && deliveryLocations.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Address is selected from your pre-configured delivery locations or PO address.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Request Dispatch
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="hidden">
          {/* Legacy global address settings removed */}
        </div>

        {dispatchesLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {dispatches?.map((dr: any) => {
              if (dr.status === "blocked") {
                const res = dr.eligibility_result || {};
                const reasonsList = res.reasons || [];
                return (
                  <Alert variant="destructive" key={dr.id} className="border-destructive/50 bg-destructive/5">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="font-semibold flex items-center gap-2">
                      Dispatch #{dr.id.slice(0, 8)} is Blocked
                      <Badge variant="destructive" className="capitalize">
                        {dr.status}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-2 space-y-3">
                      <p className="text-sm">
                        This dispatch request failed automated compliance checks:
                      </p>
                      <ul className="list-disc list-inside text-xs space-y-1 pl-2 font-mono">
                        {reasonsList.map((reason: string, i: number) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button size="sm" variant="outline" asChild className="text-xs">
                          <Link to="/client/payments">
                            <CreditCard className="h-3 w-3 mr-1" /> Report A Payment
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild className="text-xs">
                          <Link to="/client/ledgers">
                            <FileSignature className="h-3 w-3 mr-1" /> View/Confirm Ledger
                          </Link>
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Dispatch Request Registry</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>PO Reference</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Site Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches && dispatches.length > 0 ? (
                      dispatches.map((dr: any) => (
                        <TableRow key={dr.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            #{dr.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {dr.purchase_orders?.po_number ?? "—"}
                          </TableCell>
                          <TableCell>
                            {dr.purchase_orders?.products?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {Number(dr.quantity).toFixed(2)} MT
                          </TableCell>
                          <TableCell>
                            {new Date(dr.requested_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="truncate max-w-[200px]" title={dr.site_address}>
                            {dr.site_address}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                dr.status === "auto_approved" || dr.status === "approved"
                                  ? "default"
                                  : dr.status === "blocked"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {dr.status === "auto_approved" ? "Auto Approved" : dr.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          No dispatch requests submitted yet. Click "Request Dispatch" to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
