import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPurchaseOrders, createPurchaseOrder, getProducts, getRates } from "@/lib/api/business.functions";
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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileText, Plus, Loader2, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/purchase-orders")({
  ssr: false,
  component: ClientPurchaseOrdersPage,
});

function ClientPurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form states
  const [poNumber, setPoNumber] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [lockedRate, setLockedRate] = useState<number>(0);
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [documentMethod, setDocumentMethod] = useState<"upload" | "generate">("upload");
  const [documentUrl, setDocumentUrl] = useState("");

  const { data: pos, isLoading: posLoading } = useQuery({
    queryKey: ["client-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  const { data: products } = useQuery({
    queryKey: ["client-products"],
    queryFn: () => getProducts(),
  });

  const { data: rates } = useQuery({
    queryKey: ["client-rates"],
    queryFn: () => getRates(),
  });

  // Automatically compute / set rate when product is selected
  useEffect(() => {
    if (!productId || !rates) return;
    // Look for client-specific rate first (rates query already filters to this client or generic)
    const productRates = rates.filter((r: any) => r.product_id === productId);
    const clientSpecific = productRates.find((r: any) => r.organization_id !== null);
    const generic = productRates.find((r: any) => r.organization_id === null);

    const activeRate = clientSpecific?.amount ?? generic?.amount ?? 0;
    setLockedRate(Number(activeRate));
  }, [productId, rates]);

  const createMutation = useMutation({
    mutationFn: (newPo: any) => createPurchaseOrder({ data: newPo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-pos"] });
      toast.success("Purchase Order submitted successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to submit Purchase Order");
    },
  });

  function resetForm() {
    setPoNumber("");
    setProductId("");
    setQuantity(0);
    setLockedRate(0);
    setSiteAddress("");
    setDeliveryContact("");
    setDocumentMethod("upload");
    setDocumentUrl("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      poNumber,
      productId,
      originalQuantity: quantity,
      lockedRate,
      siteAddress,
      deliveryContact,
      documentMethod,
      documentUrl: documentUrl || "https://example.com/demo-po.pdf", // Mock file link
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
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">
              Create POs, lock contract rates, and upload documents or authorize platform-generated POs.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Raise PO
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Raise Purchase Order</DialogTitle>
                  <DialogDescription>
                    Fill in PO quantity and shipping details. Contract rates will lock automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="poNumber">PO Number *</Label>
                    <Input
                      id="poNumber"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-001"
                      required
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="quantity">Quantity (MT) *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Contract Rate per MT</Label>
                      <div className="h-10 border border-input rounded-md flex items-center px-3 bg-muted font-semibold text-primary">
                        {formatCurrency(lockedRate)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Calculated PO Value</Label>
                    <div className="h-10 border border-success/30 rounded-md flex items-center px-3 bg-success/5 font-bold text-success text-lg">
                      {formatCurrency(quantity * lockedRate)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="siteAddress">Site Delivery Address *</Label>
                    <Input
                      id="siteAddress"
                      value={siteAddress}
                      onChange={(e) => setSiteAddress(e.target.value)}
                      placeholder="Full site destination address"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deliveryContact">Site Contact Person / Phone</Label>
                    <Input
                      id="deliveryContact"
                      value={deliveryContact}
                      onChange={(e) => setDeliveryContact(e.target.value)}
                      placeholder="Name, Phone details"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label>Document Method</Label>
                      <Select
                        value={documentMethod}
                        onValueChange={(val: any) => setDocumentMethod(val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">Upload Signed Purchase Order PDF</SelectItem>
                          <SelectItem value="generate">Generate using Seal & Signatory</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {documentMethod === "upload" ? (
                    <div className="space-y-1">
                      <Label htmlFor="documentUrl">PO PDF Link *</Label>
                      <Input
                        id="documentUrl"
                        value={documentUrl}
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        placeholder="Paste URL or upload PO document"
                        required
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-md border border-dashed text-xs text-muted-foreground text-center">
                      Our system will autogenerate a clean, compliant PO. If you onboard client seals/signatures, they will be applied automatically.
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit PO
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {posLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Submitted Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Locked Rate</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Site Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos && pos.length > 0 ? (
                    pos.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-semibold">{po.po_number}</TableCell>
                        <TableCell>
                          {po.products?.name} {po.products?.grade ? `(${po.products?.grade})` : ""}
                        </TableCell>
                        <TableCell>
                          {Number(po.original_quantity).toFixed(2)} {po.products?.unit ?? "MT"}
                        </TableCell>
                        <TableCell>{formatCurrency(po.locked_rate)}</TableCell>
                        <TableCell className="font-bold text-success">
                          {formatCurrency(po.total_value)}
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]" title={po.site_address}>
                          {po.site_address}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              po.status === "approved"
                                ? "success"
                                : po.status === "submitted" || po.status === "pending_approval"
                                ? "warning"
                                : "secondary"
                            }
                            className="capitalize"
                          >
                            {po.status === "pending_approval" ? "Pending Approval" : po.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {po.document_url ? (
                            <a
                              href={po.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" /> View
                            </a>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No purchase orders raised yet. Click "Raise PO" to submit one.
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
