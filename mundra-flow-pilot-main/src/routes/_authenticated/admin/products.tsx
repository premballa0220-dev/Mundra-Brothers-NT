import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, createProduct, updateProduct, deleteProduct, getRatesForProduct, proposeProductRate, approveProductRate, getClients } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Loader2, IndianRupee, Clock, Check, X, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/products")({
  ssr: false,
  component: AdminProductsPage,
});

function ProductDetailsSheet({ product, open, setOpen }: { product: any; open: boolean; setOpen: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [rateAmount, setRateAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [orgId, setOrgId] = useState<string>("generic");

  const { data: clients } = useQuery({ queryKey: ["admin-clients"], queryFn: () => getClients() });
  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ["product-rates", product.id],
    queryFn: () => getRatesForProduct({ data: { productId: product.id } }),
    enabled: open,
  });

  const proposeMutation = useMutation({
    mutationFn: (data: any) => proposeProductRate({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-rates", product.id] });
      toast.success("Rate proposed successfully");
      setRateAmount("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to propose rate"),
  });

  const approveMutation = useMutation({
    mutationFn: (data: { rateId: string; action: "approve" | "reject" }) => approveProductRate({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-rates", product.id] });
      toast.success(`Rate ${variables.action === "approve" ? "approved" : "rejected"} successfully`);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to process rate"),
  });

  function handleProposeRate(e: React.FormEvent) {
    e.preventDefault();
    if (!rateAmount || isNaN(Number(rateAmount))) return;
    proposeMutation.mutate({
      productId: product.id,
      organizationId: orgId === "generic" ? null : orgId,
      amount: Number(rateAmount),
      effectiveFrom,
      effectiveTo: null,
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-[400px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>Product parameters and rate management.</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="rates">Rates & Pricing</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Weight</div>
                  <div className="font-medium">{product.packaging || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Standard Unit</div>
                  <div className="font-medium">{product.unit}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">HSN Code</div>
                  <div className="font-medium">{product.hsn_code || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Price (ex. GST)</div>
                  <div className="font-medium">
                    {product.basePrice ? `₹${Number(product.basePrice).toLocaleString("en-IN")}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">GST Rate (%)</div>
                  <div className="font-medium">
                    {product.gst_rate != null ? `${product.gst_rate}%` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Calculated GST Amount</div>
                  <div className="font-medium text-amber-600 dark:text-amber-400">
                    {product.basePrice != null && product.gst_rate != null
                      ? `₹${(Number(product.basePrice) * (Number(product.gst_rate) / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Price (incl. GST)</div>
                  <div className="font-semibold text-primary">
                    {product.basePrice != null && product.gst_rate != null
                      ? `₹${(Number(product.basePrice) * (1 + Number(product.gst_rate) / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                      : product.basePrice ? `₹${Number(product.basePrice).toLocaleString("en-IN")}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="rates" className="space-y-6 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Propose New Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProposeRate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Scope (Generic or Client Specific)</Label>
                      <Select value={orgId} onValueChange={setOrgId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="generic">Generic Standard Rate</SelectItem>
                          {clients?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (excluding GST) (₹)</Label>
                        <Input value={rateAmount} onChange={e => setRateAmount(e.target.value)} type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Effective From</Label>
                        <Input value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} type="date" required />
                      </div>
                    </div>
                    <Button type="submit" disabled={proposeMutation.isPending} className="w-full">
                      {proposeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Propose Rate
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div>
                <h3 className="font-medium mb-3">Rate History</h3>
                {ratesLoading ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : rates && rates.length > 0 ? (
                  <div className="space-y-3">
                    {rates.map((rate: any) => (
                      <Card key={rate.id}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold flex items-center">
                                <IndianRupee className="h-3 w-3 mr-1" />{Number(rate.amount).toLocaleString()}
                              </span>
                              <Badge variant={rate.status === "active" ? "default" : rate.status === "pending_approval" ? "outline" : "secondary"}>
                                {rate.status.replace("_", " ")}
                              </Badge>
                              {!rate.organization_id ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Generic</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none">{rate.organization?.trade_name}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(rate.effective_from).toLocaleDateString()} to {rate.effective_to ? new Date(rate.effective_to).toLocaleDateString() : "Ongoing"}
                            </div>
                          </div>
                          {rate.status === "pending_approval" && (
                            <div className="flex gap-2">
                              <Button size="icon" variant="outline" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate({ rateId: rate.id, action: "approve" })} disabled={approveMutation.isPending}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => approveMutation.mutate({ rateId: rate.id, action: "reject" })} disabled={approveMutation.isPending}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">No rates found for this product.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form states
  const [name, setName] = useState("");
  const [packaging, setPackaging] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [basePrice, setBasePrice] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [unitSelection, setUnitSelection] = useState("Bag");
  const [customUnit, setCustomUnit] = useState("");
  
  const [editOpen, setEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (newProd: any) => createProduct({ data: newProd }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product successfully created!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create product"),
  });

  const updateMutation = useMutation({
    mutationFn: (prodData: any) => updateProduct({ data: prodData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product successfully updated!");
      setEditOpen(false);
      setEditingProduct(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update product"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted successfully");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete product"),
  });

  function resetForm() {
    setName("");
    setPackaging("");
    setWeightUnit("kg");
    setBasePrice("");
    setUnitSelection("Bag");
    setCustomUnit("");
    setHsnCode("");
    setGstRate("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalUnit = unitSelection === "Other" ? customUnit : unitSelection;
    if (!finalUnit.trim()) {
      toast.error("Please specify a unit");
      return;
    }

    const finalName = name.trim().endsWith("(1T)") ? name.trim() : `${name.trim()} (1T)`;
    const finalPackaging = packaging.trim() ? `${packaging.trim()} ${weightUnit}` : "";

    createMutation.mutate({ 
      name: finalName, 
      packaging: finalPackaging, 
      unit: finalUnit,
      basePrice: basePrice ? Number(basePrice) : undefined,
      hsnCode,
      gstRate: gstRate ? Number(gstRate) : undefined 
    });
  }

  function openEditDialog(prod: any) {
    setEditingProduct(prod);
    setName(prod.name);
    
    if (prod.packaging) {
      const match = prod.packaging.match(/^([\d.]+)\s*(kg|T|MT)$/i);
      if (match) {
        setPackaging(match[1]);
        setWeightUnit(match[2].toUpperCase() === 'T' ? 'T' : match[2].toUpperCase() === 'MT' ? 'MT' : 'kg');
      } else {
        setPackaging(prod.packaging);
        setWeightUnit("kg");
      }
    } else {
      setPackaging("");
      setWeightUnit("kg");
    }
    
    setBasePrice(prod.basePrice ? String(prod.basePrice) : "");
    setHsnCode(prod.hsn_code || "");
    setGstRate(prod.gst_rate ? String(prod.gst_rate) : "");
    if (prod.unit === "Bag" || prod.unit === "Bulker") {
      setUnitSelection(prod.unit);
      setCustomUnit("");
    } else {
      setUnitSelection("Other");
      setCustomUnit(prod.unit || "");
    }
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalUnit = unitSelection === "Other" ? customUnit : unitSelection;
    if (!finalUnit.trim()) {
      toast.error("Please specify a unit");
      return;
    }

    const finalName = name.trim().endsWith("(1T)") ? name.trim() : `${name.trim()} (1T)`;
    const finalPackaging = packaging.trim() ? `${packaging.trim()} ${weightUnit}` : "";

    updateMutation.mutate({ 
      id: editingProduct.id,
      name: finalName, 
      packaging: finalPackaging, 
      unit: finalUnit,
      basePrice: basePrice ? Number(basePrice) : undefined,
      hsnCode,
      gstRate: gstRate ? Number(gstRate) : undefined 
    });
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Product Catalogue</h1>
            <p className="text-sm text-muted-foreground">
              Define the types, weight, grades, and units of products offered.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Product to Master</DialogTitle>
                  <DialogDescription>Define product parameters including name, and standard weight.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g. UltraTech Premium Cement" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="packaging" className="text-right">Weight</Label>
                    <div className="col-span-3 flex gap-2">
                      <Input id="packaging" value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="e.g. 50" />
                      <Select value={weightUnit} onValueChange={setWeightUnit}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="T">T</SelectItem>
                          <SelectItem value="MT">MT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">Unit *</Label>
                    <div className="col-span-3 space-y-2">
                      <Select value={unitSelection} onValueChange={setUnitSelection}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bag">Bag</SelectItem>
                          <SelectItem value="Bulker">Bulker</SelectItem>
                          <SelectItem value="Other">Other (Specify)</SelectItem>
                        </SelectContent>
                      </Select>
                      {unitSelection === "Other" && (
                        <Input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="Enter custom unit" required />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="basePrice" className="text-right">Price (ex. GST)</Label>
                    <Input id="basePrice" type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="col-span-3" placeholder="e.g. 350" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="hsnCode" className="text-right">HSN Code</Label>
                    <Input id="hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="col-span-3" placeholder="e.g. 2523" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gstRate" className="text-right">GST Rate (%)</Label>
                    <Input id="gstRate" type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="col-span-3" placeholder="e.g. 18" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Product
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={(o) => {
            if (!o) { setEditOpen(false); setEditingProduct(null); resetForm(); }
          }}>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleEditSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Product</DialogTitle>
                  <DialogDescription>Modify product parameters.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">Name *</Label>
                    <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-packaging" className="text-right">Weight</Label>
                    <div className="col-span-3 flex gap-2">
                      <Input id="edit-packaging" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
                      <Select value={weightUnit} onValueChange={setWeightUnit}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="T">T</SelectItem>
                          <SelectItem value="MT">MT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Unit *</Label>
                    <div className="col-span-3 space-y-2">
                      <Select value={unitSelection} onValueChange={setUnitSelection}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bag">Bag</SelectItem>
                          <SelectItem value="Bulker">Bulker</SelectItem>
                          <SelectItem value="Other">Other (Specify)</SelectItem>
                        </SelectContent>
                      </Select>
                      {unitSelection === "Other" && (
                        <Input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="Enter custom unit" required />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-basePrice" className="text-right">Price (ex. GST)</Label>
                    <Input id="edit-basePrice" type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-hsnCode" className="text-right">HSN Code</Label>
                    <Input id="edit-hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-gstRate" className="text-right">GST Rate (%)</Label>
                    <Input id="edit-gstRate" type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Product Master</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Standard Unit</TableHead>
                    <TableHead>Price (ex. GST)</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead>Price (incl. GST)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products && products.length > 0 ? (
                    products.map((prod: any) => (
                      <TableRow key={prod.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {prod.name}
                          </div>
                        </TableCell>
                        <TableCell>{prod.packaging || "—"}</TableCell>
                        <TableCell>{prod.unit}</TableCell>
                        <TableCell>{prod.basePrice ? `₹${Number(prod.basePrice).toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell>{prod.gst_rate != null ? `${prod.gst_rate}%` : "—"}</TableCell>
                        <TableCell className="font-semibold">
                          {prod.basePrice != null && prod.gst_rate != null
                            ? `₹${(Number(prod.basePrice) * (1 + Number(prod.gst_rate) / 100)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                            : prod.basePrice ? `₹${Number(prod.basePrice).toLocaleString("en-IN")}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={prod.is_active ? "default" : "secondary"}>
                            {prod.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedProduct(prod)}>
                              Details & Rates
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10" onClick={() => openEditDialog(prod)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(prod.id)} disabled={deleteMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No products configured yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedProduct && (
        <ProductDetailsSheet 
          product={selectedProduct} 
          open={!!selectedProduct} 
          setOpen={(o) => !o && setSelectedProduct(null)} 
        />
      )}
    </AppShell>
  );
}
