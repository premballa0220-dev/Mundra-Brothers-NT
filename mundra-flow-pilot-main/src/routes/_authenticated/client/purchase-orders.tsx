import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPurchaseOrders, createPurchaseOrder, getProducts, getApplicableRate } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileText, Plus, Loader2, IndianRupee, AlertCircle, UploadCloud, FileIcon, X } from "lucide-react";

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
  const [isExceptionRate, setIsExceptionRate] = useState(false);
  const [globalSiteAddress, setGlobalSiteAddress] = useState(
    typeof window !== "undefined" ? localStorage.getItem("defaultSiteAddress") || "" : ""
  );
  const [globalDeliveryContact, setGlobalDeliveryContact] = useState(
    typeof window !== "undefined" ? localStorage.getItem("defaultDeliveryContact") || "" : ""
  );
  const [useEverytime, setUseEverytime] = useState(
    typeof window !== "undefined" ? localStorage.getItem("useEverytime") === "true" : false
  );

  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [documentMethod, setDocumentMethod] = useState<"upload" | "generate">("upload");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Persist global settings when they change
  useEffect(() => {
    localStorage.setItem("defaultSiteAddress", globalSiteAddress);
    localStorage.setItem("defaultDeliveryContact", globalDeliveryContact);
    localStorage.setItem("useEverytime", String(useEverytime));
  }, [globalSiteAddress, globalDeliveryContact, useEverytime]);

  // When modal opens, pre-fill if not using everytime (if using everytime, they are disabled and use global)
  useEffect(() => {
    if (open) {
      if (!useEverytime) {
        setSiteAddress("");
        setDeliveryContact("");
      }
    }
  }, [open, useEverytime]);

  const { data: pos, isLoading: posLoading } = useQuery({
    queryKey: ["client-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  const { data: products } = useQuery({
    queryKey: ["client-products"],
    queryFn: () => getProducts(),
  });

  const { data: applicableRateInfo, isLoading: rateLoading } = useQuery({
    queryKey: ["applicable-rate", productId],
    queryFn: () => getApplicableRate({ data: { productId } }),
    enabled: !!productId,
  });

  // Automatically compute / set rate when product is selected and not in exception mode
  useEffect(() => {
    if (applicableRateInfo && !isExceptionRate) {
      setLockedRate(applicableRateInfo.rate);
    }
  }, [applicableRateInfo, isExceptionRate]);

  const createMutation = useMutation({
    mutationFn: (newPo: any) => createPurchaseOrder({ data: newPo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-pos"] });
      toast.success("Purchase Order submitted successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to submit Purchase Order"),
  });

  function resetForm() {
    setPoNumber("");
    setProductId("");
    setQuantity(0);
    setLockedRate(0);
    setIsExceptionRate(false);
    setSiteAddress("");
    setDeliveryContact("");
    setDocumentMethod("upload");
    setDocumentUrl("");
    setDocumentFile(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      poNumber,
      productId,
      originalQuantity: quantity,
      lockedRate,
      isExceptionRate,
      siteAddress: useEverytime ? globalSiteAddress : siteAddress,
      deliveryContact: useEverytime ? globalDeliveryContact : deliveryContact,
      documentMethod,
      documentUrl: documentUrl || "https://example.com/demo-po.pdf",
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
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
            <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Raise Purchase Order</DialogTitle>
                  <DialogDescription>
                    Fill in PO quantity and shipping details. Contract rates will lock automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="poNumber">PO Number *</Label>
                      <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-001" required />
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="quantity">Quantity (MT) *</Label>
                      <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center h-4 mb-1">
                        <Label>Contract Rate per MT</Label>
                        {rateLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        {applicableRateInfo && !rateLoading && (
                          <span className="text-[10px] uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-medium tracking-wider">
                            {applicableRateInfo.source}
                          </span>
                        )}
                      </div>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={lockedRate || ""} 
                        onChange={e => setLockedRate(Number(e.target.value))}
                        disabled={!isExceptionRate}
                        className={!isExceptionRate ? "bg-muted font-semibold text-primary" : "font-semibold"}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 border rounded-md p-3 bg-card mt-1">
                    <Switch id="exception-rate" checked={isExceptionRate} onCheckedChange={setIsExceptionRate} />
                    <Label htmlFor="exception-rate" className="flex flex-col cursor-pointer">
                      <span>Request Exception Rate</span>
                      <span className="font-normal text-xs text-muted-foreground leading-snug">
                        Requires manual admin approval and may delay dispatch processing.
                      </span>
                    </Label>
                  </div>

                  <div className="space-y-1">
                    <Label>Calculated PO Value</Label>
                    <div className="h-10 border border-success/30 rounded-md flex items-center px-3 bg-success/5 font-bold text-success text-lg">
                      {formatCurrency(quantity * lockedRate)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="siteAddress">Site Delivery Address *</Label>
                      <Input id="siteAddress" value={useEverytime ? globalSiteAddress : siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Full site destination address" required={!useEverytime} disabled={useEverytime} className={useEverytime ? "bg-muted" : ""} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="deliveryContact">Site Contact Person / Phone</Label>
                      <Input id="deliveryContact" value={useEverytime ? globalDeliveryContact : deliveryContact} onChange={(e) => setDeliveryContact(e.target.value)} placeholder="Name, Phone details" disabled={useEverytime} className={useEverytime ? "bg-muted" : ""} />
                    </div>
                  </div>
                  {useEverytime && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Using the default delivery settings from the top of the page.
                    </p>
                  )}
                  
                  <div className="space-y-2 pt-3 border-t mt-1">
                    <Label>PO Document (PDF/Image)</Label>
                    {!documentFile ? (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-accent/50 transition-colors relative">
                        <Input 
                          type="file" 
                          accept=".pdf,image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 1024 * 1024) {
                                toast.error("File size must be less than 1MB");
                                e.target.value = "";
                                return;
                              }
                              setDocumentFile(file);
                              setDocumentUrl(URL.createObjectURL(file));
                              setDocumentMethod("upload");
                            }
                          }}
                        />
                        <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Click or drag file to upload</p>
                        <p className="text-xs text-muted-foreground mt-1">Supports PDF, PNG, JPG up to 1MB</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded flex items-center justify-center">
                            <FileIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{documentFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(documentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => { setDocumentFile(null); setDocumentUrl(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || (!lockedRate && quantity > 0)}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit PO
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1 w-full">
              <Label htmlFor="globalSiteAddress">Default Site Delivery Address</Label>
              <Input id="globalSiteAddress" value={globalSiteAddress} onChange={(e) => setGlobalSiteAddress(e.target.value)} placeholder="Full site destination address" className="bg-background" />
            </div>
            <div className="flex-1 space-y-1 w-full">
              <Label htmlFor="globalDeliveryContact">Default Contact Person / Phone</Label>
              <Input id="globalDeliveryContact" value={globalDeliveryContact} onChange={(e) => setGlobalDeliveryContact(e.target.value)} placeholder="Name, Phone details" className="bg-background" />
            </div>
            <div className="flex items-center space-x-2 pb-2 shrink-0">
              <Switch id="useEverytime" checked={useEverytime} onCheckedChange={setUseEverytime} />
              <Label htmlFor="useEverytime" className="text-sm font-medium cursor-pointer whitespace-nowrap">Use Everytime</Label>
            </div>
          </CardContent>
        </Card>

        {posLoading ? (
          <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">My Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity (MT)</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos && pos.length > 0 ? (
                    pos.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {po.po_number}
                          </div>
                        </TableCell>
                        <TableCell>{po.product?.name}</TableCell>
                        <TableCell className="text-right font-medium">{po.original_quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(po.locked_rate)}/MT</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(po.total_value)}</TableCell>
                        <TableCell>
                          <Badge variant={po.status === "approved" ? "default" : "secondary"}>
                            {po.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No purchase orders found.
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
