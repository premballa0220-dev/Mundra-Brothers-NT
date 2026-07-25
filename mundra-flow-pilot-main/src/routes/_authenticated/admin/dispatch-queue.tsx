import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDispatchRequests,
  updateDispatchRequestStatus,
  getClients,
  getPurchaseOrders,
  getClientDeliveryLocationsAdmin,
  createDispatchRequestAdmin,
  editDispatchRequestAdmin,
} from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Filter,
  Pencil,
  Eye,
} from "lucide-react";

function formatBlockReason(reason: string): string {
  const creditMatch = reason.match(
    /Credit limit exceeded \(Exposure: (₹[\d,\.]+) vs Limit: (₹[\d,\.]+)\)/,
  );
  if (creditMatch) {
    return `Credit limit breached — exposure of ${creditMatch[1]} exceeds limit of ${creditMatch[2]}`;
  }
  return reason;
}

export const Route = createFileRoute("/_authenticated/admin/dispatch-queue")({
  ssr: false,
  component: AdminDispatchQueuePage,
});

function AdminDispatchQueuePage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Dispatch on Behalf states
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split("T")[0]);
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Edit Dispatch states
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEditDr, setSelectedEditDr] = useState<any>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editRequestedDate, setEditRequestedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [editSiteAddress, setEditSiteAddress] = useState("");
  const [editDeliveryContact, setEditDeliveryContact] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");

  // View Details states
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedViewDr, setSelectedViewDr] = useState<any>(null);

  // Approval/Rejection confirm state
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [confirmDrId, setConfirmDrId] = useState<string | null>(null);

  const { data: dispatches, isLoading: dispatchesLoading } = useQuery({
    queryKey: ["admin-dispatch-queue"],
    queryFn: () => getDispatchRequests(),
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const { data: allPOs } = useQuery({
    queryKey: ["admin-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  const { data: deliveryLocations } = useQuery({
    queryKey: ["admin-client-locations", selectedClientId],
    queryFn: () => getClientDeliveryLocationsAdmin({ data: { organizationId: selectedClientId } }),
    enabled: !!selectedClientId,
  });

  const clientApprovedPOs = useMemo(() => {
    if (!allPOs || !selectedClientId) return [];
    return allPOs.filter(
      (po: any) => po.organization_id === selectedClientId && po.status === "approved",
    );
  }, [allPOs, selectedClientId]);

  const selectedPO = clientApprovedPOs.find((p: any) => p.id === purchaseOrderId);
  const poOriginalQty = selectedPO ? Number(selectedPO.original_quantity) : 0;
  const usedQty =
    selectedPO && dispatches
      ? dispatches
          .filter((dr: any) => dr.purchase_order_id === purchaseOrderId && dr.status !== "rejected")
          .reduce((sum: number, dr: any) => sum + Number(dr.quantity), 0)
      : 0;
  const remainingQty = Math.max(0, poOriginalQty - usedQty);

  const editSelectedPO = selectedEditDr
    ? allPOs?.find((p: any) => p.id === selectedEditDr.purchase_order_id)
    : null;
  const editPoOriginalQty = editSelectedPO ? Number(editSelectedPO.original_quantity) : 0;
  const editUsedQty =
    editSelectedPO && dispatches
      ? dispatches
          .filter(
            (dr: any) =>
              dr.purchase_order_id === selectedEditDr.purchase_order_id &&
              dr.status !== "rejected" &&
              dr.id !== selectedEditDr.id,
          )
          .reduce((sum: number, dr: any) => sum + Number(dr.quantity), 0)
      : 0;
  const editRemainingQty = Math.max(0, editPoOriginalQty - editUsedQty);

  // Pre-fill site address logic for Admin Modal
  useEffect(() => {
    if (!createOpen) return;
    if (purchaseOrderId && clientApprovedPOs.length > 0) {
      const selectedPo = clientApprovedPOs.find((p: any) => p.id === purchaseOrderId);
      if (selectedPo) {
        setSiteAddress(selectedPo.site_address);
        setDeliveryContact(selectedPo.delivery_contact ?? "");
        return;
      }
    }

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
  }, [createOpen, purchaseOrderId, clientApprovedPOs, deliveryLocations]);

  // Pre-fill Edit Modal
  useEffect(() => {
    if (editOpen && selectedEditDr) {
      setEditQuantity(selectedEditDr.quantity);
      setEditRequestedDate(selectedEditDr.requested_date.split("T")[0]);
      setEditSiteAddress(selectedEditDr.site_address);
      setEditDeliveryContact(selectedEditDr.delivery_contact || "");
      setEditInvoiceNumber(selectedEditDr.invoice_number || "");
    }
  }, [editOpen, selectedEditDr]);

  const createMutation = useMutation({
    mutationFn: (newDr: any) => createDispatchRequestAdmin({ data: newDr }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-queue"] });
      toast.success("Dispatch request created on behalf of client.");
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to create dispatch request");
    },
  });

  const editMutation = useMutation({
    mutationFn: (updatedDr: any) => editDispatchRequestAdmin({ data: updatedDr }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-queue"] });
      toast.success("Dispatch request updated successfully.");
      setEditOpen(false);
      setSelectedEditDr(null);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update dispatch request");
    },
  });

  const actionMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => updateDispatchRequestStatus({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin-journal-entries"] });
      toast.success(`Dispatch request ${variables.status} successfully.`);
      setConfirmAction(null);
      setConfirmDrId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update dispatch status");
    },
  });

  function resetForm() {
    setSelectedClientId("");
    setPurchaseOrderId("");
    setQuantity(0);
    setRequestedDate(new Date().toISOString().split("T")[0]);
    setSiteAddress("");
    setDeliveryContact("");
    setInvoiceNumber("");
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (quantity > remainingQty) {
      toast.error(
        `Cannot request dispatch. Requested ${quantity} MT exceeds remaining quantity ${remainingQty.toFixed(2)} MT`,
      );
      return;
    }
    const firstItemId = selectedPO?.items?.[0]?.id;
    if (!firstItemId) {
      toast.error("This PO has no line items to dispatch against.");
      return;
    }
    createMutation.mutate({
      organizationId: selectedClientId,
      purchaseOrderId,
      lines: [{ purchaseOrderItemId: firstItemId, quantity, requestedDate }],
      siteAddress,
      deliveryContact,
      invoiceNumber,
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (editQuantity > editRemainingQty) {
      toast.error(
        `Cannot update dispatch. Requested ${editQuantity} MT exceeds remaining quantity ${editRemainingQty.toFixed(2)} MT`,
      );
      return;
    }
    editMutation.mutate({
      id: selectedEditDr.id,
      purchaseOrderId: selectedEditDr.purchase_order_id,
      quantity: editQuantity,
      requestedDate: editRequestedDate,
      siteAddress: editSiteAddress,
      deliveryContact: editDeliveryContact,
      invoiceNumber: editInvoiceNumber,
    });
  }

  const filteredDispatches = useMemo(() => {
    if (!dispatches) return [];
    return dispatches.filter((dr: any) => {
      const matchesStatus = filterStatus === "all" || dr.status === filterStatus;
      const searchStr =
        `${dr.id} ${dr.organization?.trade_name} ${dr.organization?.legal_name} ${dr.purchase_order?.po_number}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [dispatches, filterStatus, searchTerm]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate PO stats for View Details modal
  const poStats = useMemo(() => {
    if (!selectedViewDr || !selectedViewDr.purchase_order || !dispatches) return null;
    const po = selectedViewDr.purchase_order;
    const poDispatches = dispatches.filter(
      (d: any) =>
        d.purchase_order_id === po.id && (d.status === "approved" || d.status === "auto_approved"),
    );
    const consumedQty = poDispatches.reduce((sum: number, d: any) => sum + Number(d.quantity), 0);
    const originalQty = Number(po.original_quantity);
    const lockedRate = Number(po.locked_rate);
    const totalValue = originalQty * lockedRate;
    const spentValue = consumedQty * lockedRate;
    const remainingQty = originalQty - consumedQty;
    const remainingValue = totalValue - spentValue;

    return {
      originalQty,
      consumedQty,
      remainingQty,
      totalValue,
      spentValue,
      remainingValue,
      lockedRate,
    };
  }, [selectedViewDr, dispatches]);

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dispatch Queue</h1>
            <p className="text-sm text-muted-foreground">
              Review eligibility decisions, resolve blocks, and manage dispatch releases.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Request Dispatch On Behalf
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Request Dispatch on Behalf of Client</DialogTitle>
                  <DialogDescription>
                    Create a new dispatch request for a client. Standard eligibility rules will
                    apply.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="client">Client Organization *</Label>
                    <Select
                      value={selectedClientId}
                      onValueChange={(val) => {
                        setSelectedClientId(val);
                        setPurchaseOrderId("");
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Client" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clients || []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.trade_name || c.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="po">Purchase Order Scope *</Label>
                    <Select
                      value={purchaseOrderId}
                      onValueChange={setPurchaseOrderId}
                      required
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Approved PO" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientApprovedPOs.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.po_number} — {p.product?.name ?? "Product"} (
                            {Number(p.original_quantity).toFixed(0)} MT @{" "}
                            {formatCurrency(Number(p.locked_rate))}/MT)
                          </SelectItem>
                        ))}
                        {clientApprovedPOs.length === 0 && (
                          <div className="p-2 text-xs text-muted-foreground">
                            No approved POs found for this client.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-end gap-2">
                        <Label htmlFor="qty" className="shrink-0">
                          Dispatch Qty (MT) *
                        </Label>
                        {selectedPO && (
                          <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded text-right">
                            PO: {poOriginalQty.toFixed(2)} | Used: {usedQty.toFixed(2)} | Rem:{" "}
                            {remainingQty.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <Input
                        id="qty"
                        type="number"
                        min="0.01"
                        max={selectedPO ? remainingQty : undefined}
                        step="0.01"
                        value={quantity || ""}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                        className={
                          quantity > remainingQty
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                      />
                      {quantity > remainingQty && (
                        <p className="text-[10px] text-destructive mt-1 font-medium">
                          Quantity exceeds remaining balance.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="date">Requested Delivery Date *</Label>
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
                      <Select
                        value={siteAddress}
                        onValueChange={(val) => {
                          setSiteAddress(val);
                          const matchedLoc = deliveryLocations.find((l: any) => l.address === val);
                          if (matchedLoc) {
                            setDeliveryContact(
                              matchedLoc.contact_person
                                ? `${matchedLoc.contact_person}${matchedLoc.contact_phone ? ` (${matchedLoc.contact_phone})` : ""}`
                                : "",
                            );
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
                          {purchaseOrderId &&
                            clientApprovedPOs?.find((p: any) => p.id === purchaseOrderId)
                              ?.site_address &&
                            !deliveryLocations.find(
                              (l: any) =>
                                l.address ===
                                clientApprovedPOs?.find((p: any) => p.id === purchaseOrderId)
                                  ?.site_address,
                            ) && (
                              <SelectItem
                                value={
                                  clientApprovedPOs.find((p: any) => p.id === purchaseOrderId)
                                    .site_address
                                }
                              >
                                <span className="font-semibold">PO Address</span> -{" "}
                                <span className="text-muted-foreground">
                                  {clientApprovedPOs
                                    .find((p: any) => p.id === purchaseOrderId)
                                    .site_address.substring(0, 30)}
                                  ...
                                </span>
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
                  <div className="space-y-1">
                    <Label htmlFor="invoice">Invoice Number</Label>
                    <Input
                      id="invoice"
                      placeholder="Optional"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Dispatch
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-base font-semibold">Dispatch Request Registry</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search requests..."
                    className="pl-8 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9 w-full sm:w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="auto_approved">Auto Approved</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dispatchesLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>PO Ref</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDispatches.length > 0 ? (
                    filteredDispatches.map((dr: any) => (
                      <TableRow key={dr.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {dr.invoice_number || "—"}
                        </TableCell>
                        <TableCell className="font-medium truncate max-w-[150px]">
                          {dr.organization?.trade_name || dr.organization?.legal_name}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {dr.purchase_order?.po_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(dr.purchase_order?.locked_rate || 0))}
                        </TableCell>
                        <TableCell>{new Date(dr.requested_date).toLocaleDateString()}</TableCell>
                        <TableCell>{Number(dr.quantity).toFixed(2)} MT</TableCell>
                        <TableCell>
                          {formatCurrency(
                            Number(dr.quantity) * Number(dr.purchase_order?.locked_rate || 0),
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              dr.status === "auto_approved" || dr.status === "approved"
                                ? "default"
                                : dr.status === "blocked" || dr.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="capitalize"
                          >
                            {dr.status.replace("_", " ")}
                          </Badge>
                          {dr.status === "blocked" && dr.eligibility_result?.reasons && (
                            <div
                              className="mt-1 text-[10px] text-destructive max-w-[260px] leading-snug"
                              title={dr.eligibility_result.reasons
                                .map(formatBlockReason)
                                .join(" • ")}
                            >
                              {formatBlockReason(dr.eligibility_result.reasons[0])}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              title="View Details"
                              onClick={() => {
                                setSelectedViewDr(dr);
                                setViewDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Dispatch"
                              onClick={() => {
                                setSelectedEditDr(dr);
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {(dr.status === "submitted" || dr.status === "blocked") && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Approve Dispatch"
                                  onClick={() => {
                                    setConfirmDrId(dr.id);
                                    setConfirmAction("approve");
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Reject Dispatch"
                                  onClick={() => {
                                    setConfirmDrId(dr.id);
                                    setConfirmAction("reject");
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No dispatch requests found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dispatch Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Dispatch Request</DialogTitle>
                <DialogDescription>Modify the details of this dispatch request.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-end gap-2">
                      <Label htmlFor="edit-qty" className="shrink-0">
                        Dispatch Qty (MT) *
                      </Label>
                      {editSelectedPO && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded text-right">
                          PO: {editPoOriginalQty.toFixed(2)} | Used: {editUsedQty.toFixed(2)} | Rem:{" "}
                          {editRemainingQty.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <Input
                      id="edit-qty"
                      type="number"
                      min="0.01"
                      max={editSelectedPO ? editRemainingQty : undefined}
                      step="0.01"
                      value={editQuantity || ""}
                      onChange={(e) => setEditQuantity(Number(e.target.value))}
                      required
                      className={
                        editQuantity > editRemainingQty
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {editQuantity > editRemainingQty && (
                      <p className="text-[10px] text-destructive mt-1 font-medium">
                        Quantity exceeds remaining balance.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-date">Requested Delivery Date *</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editRequestedDate}
                      onChange={(e) => setEditRequestedDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-address">Site Address *</Label>
                  <Input
                    id="edit-address"
                    value={editSiteAddress}
                    onChange={(e) => setEditSiteAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-contact">Site Contact Info</Label>
                  <Input
                    id="edit-contact"
                    value={editDeliveryContact}
                    onChange={(e) => setEditDeliveryContact(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-invoice">Invoice Number</Label>
                  <Input
                    id="edit-invoice"
                    placeholder="Optional"
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Dispatch & PO Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of the dispatch request and the remaining balance on the linked
                Purchase Order.
              </DialogDescription>
            </DialogHeader>
            {selectedViewDr && poStats && (
              <div className="space-y-6 py-4">
                {/* Dispatch Request Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 pb-1 border-b">Dispatch Information</h4>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Invoice Number</span>
                      <span className="font-mono">{selectedViewDr.invoice_number || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Status</span>
                      <Badge variant="outline" className="capitalize mt-0.5">
                        {selectedViewDr.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">
                        Requested Delivery Date
                      </span>
                      <span>{new Date(selectedViewDr.requested_date).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">
                        Quantity Requested
                      </span>
                      <span className="font-semibold">
                        {Number(selectedViewDr.quantity).toFixed(2)} MT
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-xs">Site Address</span>
                      <span>{selectedViewDr.site_address}</span>
                    </div>
                    {selectedViewDr.delivery_contact && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground block text-xs">
                          Delivery Contact
                        </span>
                        <span>{selectedViewDr.delivery_contact}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PO Balance Tracking */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 pb-1 border-b">
                    Purchase Order Balance
                  </h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">PO Number</span>
                      <span className="font-medium">
                        {selectedViewDr.purchase_order?.po_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Locked Rate</span>
                      <span className="font-medium">{formatCurrency(poStats.lockedRate)} / MT</span>
                    </div>

                    <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Total PO Value
                      </span>
                      <div className="font-semibold text-base">
                        {formatCurrency(poStats.totalValue)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {poStats.originalQty.toFixed(2)} MT
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Value Spent (Approved)
                      </span>
                      <div className="font-semibold text-blue-700 text-base">
                        {formatCurrency(poStats.spentValue)}
                      </div>
                      <div className="text-xs text-blue-600/80 mt-0.5">
                        {poStats.consumedQty.toFixed(2)} MT consumed
                      </div>
                    </div>

                    <div className="col-span-2 bg-green-50 p-3 rounded-md border border-green-100">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Remaining Balance
                      </span>
                      <div className="flex justify-between items-end">
                        <div className="font-bold text-green-700 text-lg">
                          {formatCurrency(poStats.remainingValue)}
                        </div>
                        <div className="font-medium text-green-700">
                          {poStats.remainingQty.toFixed(2)} MT left
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewDetailsOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmAction === "approve" ? "Approve Dispatch" : "Reject Dispatch"}
              </DialogTitle>
              <DialogDescription>
                {confirmAction === "approve"
                  ? "Are you sure you want to approve this dispatch? This overrides any existing credit blocks."
                  : "Are you sure you want to reject this dispatch request?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction === "approve" ? "default" : "destructive"}
                disabled={actionMutation.isPending}
                onClick={() => {
                  if (confirmDrId && confirmAction) {
                    actionMutation.mutate({
                      id: confirmDrId,
                      status: confirmAction === "approve" ? "approved" : "rejected",
                    });
                  }
                }}
              >
                {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
