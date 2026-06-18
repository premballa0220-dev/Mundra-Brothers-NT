import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, createProduct, getRatesForProduct, proposeProductRate, approveProductRate, getClients } from "@/lib/api/business.functions";
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
import { Package, Plus, Loader2, IndianRupee, Clock, Check, X } from "lucide-react";

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
                  <div className="text-muted-foreground">Grade</div>
                  <div className="font-medium">{product.grade || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Packaging</div>
                  <div className="font-medium">{product.packaging || "N/A"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Standard Unit</div>
                  <div className="font-medium">{product.unit}</div>
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
                        <Label>Amount (₹)</Label>
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
  const [grade, setGrade] = useState("");
  const [packaging, setPackaging] = useState("");
  const [unit, setUnit] = useState("MT");

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

  function resetForm() {
    setName("");
    setGrade("");
    setPackaging("");
    setUnit("MT");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, grade, packaging, unit });
  }

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Product Catalogue</h1>
            <p className="text-sm text-muted-foreground">
              Define the types, packaging, grades, and units of products offered.
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
                  <DialogDescription>Define product parameters including name, grade (optional), and standard packaging.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g. UltraTech Premium Cement" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="grade" className="text-right">Grade</Label>
                    <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="col-span-3" placeholder="e.g. OPC 53 Grade" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="packaging" className="text-right">Packaging</Label>
                    <Input id="packaging" value={packaging} onChange={(e) => setPackaging(e.target.value)} className="col-span-3" placeholder="e.g. 50kg HDPE Bag" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">Unit *</Label>
                    <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" required />
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
                    <TableHead>Grade</TableHead>
                    <TableHead>Packaging</TableHead>
                    <TableHead>Standard Unit</TableHead>
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
                        <TableCell>{prod.grade || "—"}</TableCell>
                        <TableCell>{prod.packaging || "—"}</TableCell>
                        <TableCell>{prod.unit}</TableCell>
                        <TableCell>
                          <Badge variant={prod.is_active ? "default" : "secondary"}>
                            {prod.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedProduct(prod)}>
                            Details & Rates
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No products configured yet.</TableCell>
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
