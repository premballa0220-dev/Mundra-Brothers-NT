import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, createProduct } from "@/lib/api/business.functions";
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
import { Package, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/products")({
  ssr: false,
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to create product");
    },
  });

  function resetForm() {
    setName("");
    setGrade("");
    setPackaging("");
    setUnit("MT");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      grade,
      packaging,
      unit,
    });
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
                  <DialogDescription>
                    Define product parameters including name, grade (optional), and standard packaging.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name *
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g. UltraTech Premium Cement"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="grade" className="text-right">
                      Grade
                    </Label>
                    <Input
                      id="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g. OPC 53 Grade"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="packaging" className="text-right">
                      Packaging
                    </Label>
                    <Input
                      id="packaging"
                      value={packaging}
                      onChange={(e) => setPackaging(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g. 50kg HDPE Bag"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">
                      Unit *
                    </Label>
                    <Input
                      id="unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="col-span-3"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Product
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
                        <TableCell>{prod.grade ?? "—"}</TableCell>
                        <TableCell>{prod.packaging ?? "—"}</TableCell>
                        <TableCell>{prod.unit}</TableCell>
                        <TableCell>
                          <Badge variant="success">Active</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No products configured yet. Click "Add Product" to create one.
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
