import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  getProducts,
  getApplicableRate,
  getClientDeliveryLocations,
  getClientOrganization,
} from "@/lib/api/business.functions";
import { getPoFormats } from "@/lib/api/po-formats.functions";
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
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Loader2,
  IndianRupee,
  AlertCircle,
  UploadCloud,
  FileIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/client/purchase-orders")({
  ssr: false,
  component: ClientPurchaseOrdersPage,
});

function ClientPurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form states
  const [poNumber, setPoNumber] = useState("");
  type LineItem = { productId: string; quantity: number; lockedRate: number; rateSource?: string };
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { productId: "", quantity: 0, lockedRate: 0 },
  ]);
  const [isExceptionRate, setIsExceptionRate] = useState(false);
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [selectedBillingProfileId, setSelectedBillingProfileId] = useState("");
  const [documentMethod, setDocumentMethod] = useState<"upload" | "generate">("upload");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [poFormatText, setPoFormatText] = useState("");
  const [selectedPoFormatId, setSelectedPoFormatId] = useState<string | null>(null);
  const [viewGeneratedPo, setViewGeneratedPo] = useState<any>(null);

  const { data: deliveryLocations } = useQuery({
    queryKey: ["client-delivery-locations"],
    queryFn: () => getClientDeliveryLocations(),
  });

  // When modal opens, pre-fill with default delivery location
  useEffect(() => {
    if (open) {
      if (deliveryLocations && deliveryLocations.length > 0) {
        const defaultLoc = deliveryLocations.find((l: any) => l.is_default) || deliveryLocations[0];
        setSiteAddress(defaultLoc.address);
        if (defaultLoc.contact_person) {
          setDeliveryContact(
            `${defaultLoc.contact_person} ${defaultLoc.contact_phone ? `(${defaultLoc.contact_phone})` : ""}`.trim(),
          );
        } else {
          setDeliveryContact("");
        }
      } else {
        setSiteAddress("");
        setDeliveryContact("");
      }
    }
  }, [open, deliveryLocations]);

  const { data: pos, isLoading: posLoading } = useQuery({
    queryKey: ["client-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  const { data: products } = useQuery({
    queryKey: ["client-products"],
    queryFn: () => getProducts(),
  });

  const { data: organization } = useQuery({
    queryKey: ["client-organization"],
    queryFn: () => getClientOrganization(),
  });

  const { data: poFormats } = useQuery({
    queryKey: ["po-formats"],
    queryFn: () => getPoFormats(),
  });

  useEffect(() => {
    if (open) {
      if (poFormats && poFormats.length > 0) {
        const activeFormat = poFormats[0];
        setSelectedPoFormatId(activeFormat.id);
        const schema = activeFormat.template_schema as { template_text?: string } | null;
        setPoFormatText(schema?.template_text || "");
      } else {
        setSelectedPoFormatId(null);
        setPoFormatText("");
      }
      
      if (organization?.billing_addresses && organization.billing_addresses.length > 0) {
        const defaultProfile = organization.billing_addresses.find((b: any) => b.is_default) || organization.billing_addresses[0];
        setSelectedBillingProfileId(defaultProfile.id);
      } else {
        setSelectedBillingProfileId("");
      }
    }
  }, [open, poFormats, organization]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  // When a product is picked (and not an exception rate), auto-fetch its contract rate.
  async function handleProductChange(index: number, newProductId: string) {
    updateItem(index, { productId: newProductId });
    if (newProductId && !isExceptionRate) {
      try {
        const info = await getApplicableRate({ data: { productId: newProductId } });
        updateItem(index, { lockedRate: info?.rate ?? 0, rateSource: info?.source });
      } catch {
        updateItem(index, { lockedRate: 0, rateSource: undefined });
      }
    }
  }

  const addLineItem = () =>
    setLineItems((prev) => [...prev, { productId: "", quantity: 0, lockedRate: 0 }]);
  const removeLineItem = (index: number) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  // When exception mode is switched off, re-resolve every row's contract rate.
  useEffect(() => {
    if (isExceptionRate) return;
    lineItems.forEach(async (it, i) => {
      if (!it.productId) return;
      try {
        const info = await getApplicableRate({ data: { productId: it.productId } });
        updateItem(i, { lockedRate: info?.rate ?? 0, rateSource: info?.source });
      } catch {
        /* leave as-is */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExceptionRate]);

  const orderTotal = lineItems.reduce((s, it) => s + it.quantity * it.lockedRate, 0);

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
    setLineItems([{ productId: "", quantity: 0, lockedRate: 0 }]);
    setIsExceptionRate(false);
    setSiteAddress("");
    setDeliveryContact("");
    setDocumentMethod("upload");
    setDocumentUrl("");
    setDocumentFile(null);
    if (poFormats && poFormats.length > 0) {
      const activeFormat = poFormats[0];
      setSelectedPoFormatId(activeFormat.id);
      const schema = activeFormat.template_schema as { template_text?: string } | null;
      setPoFormatText(schema?.template_text || "");
    } else {
      setSelectedPoFormatId(null);
      setPoFormatText("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lineItems.some((it) => !it.productId)) {
      toast.error("Please select a product for every line.");
      return;
    }
    if (lineItems.some((it) => it.quantity <= 0)) {
      toast.error("Every product needs a quantity greater than 0.");
      return;
    }
    const productIds = lineItems.map((it) => it.productId);
    if (new Set(productIds).size !== productIds.length) {
      toast.error("The same product is listed more than once. Combine them into one line.");
      return;
    }

    let finalDocumentUrl = documentUrl;

    if (documentMethod === "upload" && documentFile) {
      setIsUploading(true);
      try {
        const fileExt = documentFile.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("po_container")
          .upload(filePath, documentFile);

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("po_container").getPublicUrl(filePath);

        finalDocumentUrl = publicUrl;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Failed to upload document: ${err.message}`);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    createMutation.mutate({
      poNumber,
      items: lineItems.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        lockedRate: it.lockedRate,
      })),
      isExceptionRate,
      siteAddress,
      deliveryContact,
      documentMethod,
      documentUrl: finalDocumentUrl || null,
      poFormatId: documentMethod === "generate" ? selectedPoFormatId : null,
      poFormatData: documentMethod === "generate" 
        ? { 
            html_content: poFormatText,
            billing_profile_id: selectedBillingProfileId,
            billing_address: organization?.billing_addresses?.find((b: any) => b.id === selectedBillingProfileId)?.billing_address || organization?.billing_address || "",
            gst_number: organization?.billing_addresses?.find((b: any) => b.id === selectedBillingProfileId)?.gst_number || organization?.gst_number || ""
          } 
        : null,
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
              Create POs, lock contract rates, and upload documents or authorize platform-generated
              POs.
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
                    Fill in PO quantity and shipping details. Contract rates will lock
                    automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  {/* Product line items — add a row per product */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Products *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
                      </Button>
                    </div>
                    {lineItems.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_90px_110px_auto] gap-2 items-end border rounded-md p-2 bg-muted/20"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">Product</Label>
                          <Select
                            value={item.productId}
                            onValueChange={(v) => handleProductChange(index, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} {p.packaging ? `- ${p.packaging}` : ""}{" "}
                                  {p.grade ? `(${p.grade})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty (MT)</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity || ""}
                            onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-4">
                            <Label className="text-xs">Rate/MT</Label>
                            {item.rateSource && !isExceptionRate && (
                              <span className="text-[9px] uppercase text-muted-foreground">
                                {item.rateSource}
                              </span>
                            )}
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.lockedRate || ""}
                            onChange={(e) =>
                              updateItem(index, { lockedRate: Number(e.target.value) })
                            }
                            disabled={!isExceptionRate}
                            className={
                              !isExceptionRate
                                ? "bg-muted font-semibold text-primary"
                                : "font-semibold"
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          disabled={lineItems.length === 1}
                          onClick={() => removeLineItem(index)}
                          title="Remove product"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2 border rounded-md p-3 bg-card mt-1">
                    <Switch
                      id="exception-rate"
                      checked={isExceptionRate}
                      onCheckedChange={setIsExceptionRate}
                    />
                    <Label htmlFor="exception-rate" className="flex flex-col cursor-pointer">
                      <span>Request Exception Rate</span>
                      <span className="font-normal text-xs text-muted-foreground leading-snug">
                        Requires manual admin approval and may delay dispatch processing.
                      </span>
                    </Label>
                  </div>

                  <div className="space-y-1">
                    <Label>Calculated PO Value ({lineItems.length} product{lineItems.length > 1 ? "s" : ""})</Label>
                    <div className="h-10 border border-success/30 rounded-md flex items-center px-3 bg-success/5 font-bold text-success text-lg">
                      {formatCurrency(orderTotal)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="siteAddress">Site Delivery Address *</Label>
                      {deliveryLocations && deliveryLocations.length > 0 ? (
                        <Select
                          value={siteAddress}
                          onValueChange={(val) => {
                            setSiteAddress(val);
                            const loc = deliveryLocations.find((l: any) => l.address === val);
                            if (loc?.contact_person) {
                              setDeliveryContact(
                                `${loc.contact_person} ${loc.contact_phone ? `(${loc.contact_phone})` : ""}`.trim(),
                              );
                            } else {
                              setDeliveryContact("");
                            }
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Delivery Address" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryLocations.map((loc: any) => (
                              <SelectItem key={loc.id} value={loc.address}>
                                <span className="font-semibold">{loc.label}</span> -{" "}
                                <span className="text-muted-foreground">
                                  {loc.address.substring(0, 30)}...
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="siteAddress"
                          value={siteAddress}
                          onChange={(e) => setSiteAddress(e.target.value)}
                          placeholder="Full site destination address"
                          required
                        />
                      )}
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
                  </div>
                  {deliveryLocations && deliveryLocations.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Address is selected from your pre-configured delivery locations.
                    </p>
                  )}

                  {documentMethod === "generate" && organization?.billing_addresses && organization.billing_addresses.length > 0 && (
                    <div className="space-y-1 mt-4">
                      <Label>Billing Profile *</Label>
                      <Select 
                        value={selectedBillingProfileId} 
                        onValueChange={setSelectedBillingProfileId} 
                        required={documentMethod === "generate"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a billing profile..." />
                        </SelectTrigger>
                        <SelectContent>
                          {organization.billing_addresses.map((profile: any) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.gst_number ? `GST: ${profile.gst_number}` : "No GST"} - {profile.billing_address?.substring(0, 40)}{profile.billing_address?.length > 40 ? "..." : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {documentMethod === "generate" && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Format Editor</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={poFormatText}
                        onChange={(e) => setPoFormatText(e.target.value)}
                        rows={8}
                        placeholder="Edit the PO template here..."
                      />
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t mt-1">
                    <Label>PO Document</Label>
                    <div className="border rounded-md p-4 bg-muted/10 space-y-4">
                      <div className="flex gap-4">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="docMethod"
                            checked={documentMethod === "upload"}
                            onChange={() => setDocumentMethod("upload")}
                            className="accent-primary"
                          />
                          Upload PO PDF
                        </Label>
                        <Label className={`flex items-center gap-2 cursor-pointer ${!organization?.logo_url ? 'text-muted-foreground' : ''}`}>
                          <input
                            type="radio"
                            name="docMethod"
                            checked={documentMethod === "generate"}
                            onChange={() => setDocumentMethod("generate")}
                            className="accent-primary"
                            disabled={!organization?.logo_url}
                          />
                          Generate Proforma {(!organization?.logo_url) && "(Logo Required)"}
                        </Label>
                      </div>

                      {documentMethod === "upload" && (
                        !documentFile ? (
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-accent/50 transition-colors relative bg-white">
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Supports PDF, PNG, JPG up to 1MB
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded flex items-center justify-center">
                                <FileIcon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{documentFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setDocumentFile(null);
                                setDocumentUrl("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      isUploading ||
                      lineItems.some((it) => it.productId && !it.lockedRate)
                    }
                  >
                    {(createMutation.isPending || isUploading) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isUploading ? "Uploading PO..." : "Submit PO"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="hidden">{/* Legacy settings removed */}</div>

        {posLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
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
                    <TableHead className="text-right">Quantity</TableHead>
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
                        {(() => {
                          const rows =
                            po.items && po.items.length > 0
                              ? po.items
                              : [
                                  {
                                    product: po.product,
                                    original_quantity: po.original_quantity,
                                    locked_rate: po.locked_rate,
                                  },
                                ];
                          return (
                            <>
                              <TableCell>
                                {rows.map((it: any, i: number) => (
                                  <div key={i} className="whitespace-nowrap">
                                    {it.product?.name ?? "—"}
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {rows.map((it: any, i: number) => (
                                  <div key={i}>{it.original_quantity}</div>
                                ))}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {rows.map((it: any, i: number) => (
                                  <div key={i}>{formatCurrency(it.locked_rate)}/MT</div>
                                ))}
                              </TableCell>
                            </>
                          );
                        })()}
                        <TableCell className="text-right font-medium">
                          {formatCurrency(po.total_value)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={po.status === "approved" ? "default" : "secondary"}>
                              {po.status.replace("_", " ")}
                            </Badge>
                            {po.document_method === "generate" && po.po_format_data && (
                              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setViewGeneratedPo(po)}>
                                View PO
                              </Button>
                            )}
                          </div>
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

      {/* Generated PO Viewer Dialog - Structured Layout */}
      <Dialog open={!!viewGeneratedPo} onOpenChange={(open) => !open && setViewGeneratedPo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50">
          <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
            <div>
              <DialogTitle className="text-lg">Generated Purchase Order</DialogTitle>
              <DialogDescription>
                {viewGeneratedPo?.po_number} - {viewGeneratedPo?.organization?.trade_name || viewGeneratedPo?.organization?.legal_name}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center print:p-0 print:bg-white">
            {viewGeneratedPo && viewGeneratedPo.po_format_data && (
              <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl p-12 print:shadow-none print:w-full font-sans text-sm border border-slate-200">
                
                {/* Header with Logo and Billing Address */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-800 gap-6">
                  <div className="flex-shrink-0 w-1/3">
                    {viewGeneratedPo.organization?.logo_url ? (
                      <img 
                        src={viewGeneratedPo.organization.logo_url} 
                        alt="Client Logo" 
                        className="max-h-24 w-full object-contain object-left"
                      />
                    ) : (
                      <div className="h-20 w-32 flex items-center justify-center text-slate-400 italic border rounded">No logo</div>
                    )}
                  </div>
                  <div className="text-right flex-1">
                    <h1 className="text-2xl font-bold uppercase text-slate-900 tracking-wide">
                      {viewGeneratedPo.organization?.trade_name || viewGeneratedPo.organization?.legal_name}
                    </h1>
                    {viewGeneratedPo.po_format_data?.gst_number && (
                      <p className="text-slate-800 font-semibold text-sm mt-1 ml-auto">
                        GSTIN: {viewGeneratedPo.po_format_data.gst_number}
                      </p>
                    )}
                    <p className="text-slate-600 text-sm mt-1 ml-auto whitespace-pre-wrap">
                      {viewGeneratedPo.po_format_data?.billing_address || viewGeneratedPo.organization?.billing_address || "Billing address not provided"}
                    </p>
                  </div>
                </div>

                {/* PO No and Date */}
                <div className="flex justify-between font-bold text-slate-800 mb-6">
                  <div>P.O.NO : {viewGeneratedPo.po_number}</div>
                  <div>DATE : {new Date(viewGeneratedPo.created_at || Date.now()).toLocaleDateString('en-GB')}</div>
                </div>

                {/* To Address */}
                <div className="mb-6 text-slate-800">
                  <p>To,</p>
                  <p className="font-bold">ULTRATECH CEMENT LIMITED</p>
                  <p className="whitespace-pre-wrap">A wing, Ahura Centre,
1st Floor Mahakali Caves Rd
Andheri (E)
Mumbai 400093</p>
                </div>

                <div className="mb-4 text-slate-800">
                  <p>Dear Sir,</p>
                  <p>We are pleased to submit you Purchase Order as follows:</p>
                </div>

                {/* Items Table */}
                <div className="mb-6 border border-slate-800">
                  <Table className="border-collapse">
                    <TableHeader className="bg-slate-100 border-b border-slate-800">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[80px] font-bold text-slate-800 text-center border-r border-slate-800 h-auto py-2">Sr.No.</TableHead>
                        <TableHead className="font-bold text-slate-800 text-center border-r border-slate-800 h-auto py-2">Description</TableHead>
                        <TableHead className="font-bold text-slate-800 text-center border-r border-slate-800 h-auto py-2">Qty (MT)</TableHead>
                        <TableHead className="font-bold text-slate-800 text-center border-r border-slate-800 h-auto py-2">Rate Per MT</TableHead>
                        <TableHead className="font-bold text-slate-800 text-center h-auto py-2">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewGeneratedPo.items && viewGeneratedPo.items.length > 0
                        ? viewGeneratedPo.items
                        : [
                            {
                              product: viewGeneratedPo.product,
                              original_quantity: viewGeneratedPo.original_quantity,
                              locked_rate: viewGeneratedPo.locked_rate,
                            },
                          ]
                      ).map((it: any, i: number) => (
                        <TableRow key={i} className="hover:bg-transparent border-b border-slate-800">
                          <TableCell className="text-center border-r border-slate-800 py-2">{i + 1}</TableCell>
                          <TableCell className="text-center border-r border-slate-800 py-2">{it.product?.name || "UltraTech Cement - PPC"}</TableCell>
                          <TableCell className="text-center border-r border-slate-800 py-2">
                            {Number(it.original_quantity).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center border-r border-slate-800 py-2">
                            {formatCurrency(it.locked_rate)}
                          </TableCell>
                          <TableCell className="text-center py-2 font-medium">
                            {formatCurrency(it.original_quantity * it.locked_rate)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="hover:bg-transparent bg-slate-50 font-bold">
                        <TableCell colSpan={4} className="text-right border-r border-slate-800 py-2">Total</TableCell>
                        <TableCell className="text-center py-2">{formatCurrency(viewGeneratedPo.total_value)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Terms and Conditions */}
                <div className="mb-6 text-slate-800">
                  <div 
                    className="whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none prose-p:my-1"
                    dangerouslySetInnerHTML={{
                      __html: (viewGeneratedPo.po_format_data?.html_content || "<b>Terms & Conditions.</b>\n\n1. Above rate is inclusive of GST and Transport Charges\n2. Above price is exclusive of TCS.\n\n<b>Payment Terms :</b> 30 days PDC from date of delivery")
                        .replace(/\{\{PO_NUMBER\}\}/g, viewGeneratedPo.po_number || "")
                        .replace(/\{\{CLIENT_NAME\}\}/g, viewGeneratedPo.organization?.trade_name || viewGeneratedPo.organization?.legal_name || "")
                        .replace(/\{\{DATE\}\}/g, new Date(viewGeneratedPo.created_at || Date.now()).toLocaleDateString('en-GB'))
                    }}
                  />
                </div>

                {/* Delivery Address */}
                <div className="mb-8 text-slate-800 space-y-4">
                  <div className="flex gap-2 items-start">
                    <span className="font-bold whitespace-nowrap">Delivery Address:</span>
                    <span className="whitespace-pre-wrap leading-tight">{viewGeneratedPo.site_address || "—"}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-12 gap-y-2">
                    <div className="flex gap-2">
                      <span className="font-bold">Contact Person:</span>
                      <span>{viewGeneratedPo.delivery_contact ? viewGeneratedPo.delivery_contact.split('(')[0]?.replace(/[-:]/g, '')?.trim() : "—"}</span>
                    </div>
                    {viewGeneratedPo.delivery_contact && viewGeneratedPo.delivery_contact.includes('(') && (
                      <div className="flex gap-2">
                        <span className="font-bold">Mobile No:</span>
                        <span>{viewGeneratedPo.delivery_contact.match(/\((.*?)\)/)?.[1] || "—"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Declarations */}
                <div className="text-slate-800 pb-10">
                  <p className="mb-4">Kindly send the above material as early as possible.</p>
                  <p className="mb-16">We declare that the cement purchased by us from "Ultratech Cement Ltd" under this purchase order is for our own usage and not for resale.</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="mb-12">Yours Faithfully,</p>
                      <p className="font-medium">(Authorized Signatory)</p>
                    </div>
                    <div>
                      {viewGeneratedPo.organization?.stamp_url ? (
                        <div className="h-24 w-24 flex items-center justify-center">
                          <img 
                            src={viewGeneratedPo.organization.stamp_url} 
                            alt="Company Stamp" 
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-full border-2 border-slate-300 flex items-center justify-center opacity-40">
                          <span className="text-xs text-center font-medium">Company<br/>Stamp</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
