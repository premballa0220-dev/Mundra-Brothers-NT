import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminUTCLPayments,
  getDispatchRequests,
  getPurchaseOrders,
  recordPaymentAdmin,
  updatePaymentAdmin,
  deletePaymentAdmin,
  getClients,
} from "@/lib/api/business.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, CheckCircle2, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  ssr: false,
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const queryClient = useQueryClient();

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedDispatches, setSelectedDispatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFifo, setIsFifo] = useState(false);

  // Payment Form State
  const [openDispatchId, setOpenDispatchId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("RTGS");
  const [referenceNumber, setReferenceNumber] = useState("");

  // Edit Payment State
  const [editPaymentOpen, setEditPaymentOpen] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("RTGS");
  const [editReferenceNumber, setEditReferenceNumber] = useState("");

  // Client to UTCL Payment State
  const [clientUtclModalOpen, setClientUtclModalOpen] = useState(false);
  const [clientSelectedOrgId, setClientSelectedOrgId] = useState("");
  const [clientAmount, setClientAmount] = useState<number>(0);
  const [clientPaymentType, setClientPaymentType] = useState<"on_account" | "against_reference">(
    "against_reference",
  );
  const [clientPaymentDate, setClientPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [clientPaymentMode, setClientPaymentMode] = useState("RTGS");
  const [clientReferenceNumber, setClientReferenceNumber] = useState("");
  const [clientSelectedReferences, setClientSelectedReferences] = useState<string[]>([]);

  const { data: pastPayments, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-utcl-payments"],
    queryFn: () => getAdminUTCLPayments(),
  });

  const { data: dispatches, isLoading: dispatchesLoading } = useQuery({
    queryKey: ["admin-dispatch-requests"],
    queryFn: () => getDispatchRequests(),
  });

  const { data: purchaseOrders } = useQuery({
    queryKey: ["admin-pos"],
    queryFn: () => getPurchaseOrders(),
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const recordMutation = useMutation({
    mutationFn: (newPayment: any) => recordPaymentAdmin({ data: newPayment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-utcl-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dispatch-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-journal-entries"] });
      toast.success("Payment recorded successfully!");

      // Remove from selected staging array
      if (openDispatchId === "lumpsum") {
        setSelectedDispatches([]);
      } else {
        setSelectedDispatches((prev) => prev.filter((d) => d.id !== openDispatchId));
      }

      setOpenDispatchId(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record payment");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updatedPayment: any) => updatePaymentAdmin({ data: updatedPayment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-utcl-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-journal-entries"] });
      toast.success("Payment updated successfully!");
      setEditPaymentOpen(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update payment"),
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => deletePaymentAdmin({ data: { id: paymentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-utcl-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-journal-entries"] });
      toast.success("Payment deleted successfully!");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete payment"),
  });

  function resetForm() {
    setAmount(0);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("RTGS");
    setReferenceNumber("");
    setClientSelectedOrgId("");
    setClientAmount(0);
    setClientPaymentType("against_reference");
    setClientPaymentDate(new Date().toISOString().split("T")[0]);
    setClientPaymentMode("RTGS");
    setClientReferenceNumber("");
    setClientSelectedReferences([]);
  }

  function handleRecordLumpsumPayment(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDispatches.length === 0) return;

    recordMutation.mutate({
      organizationId: selectedDispatches[0].organization_id, // Primary org for reference
      dispatchRequestIds: selectedDispatches.map((d) => d.id),
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      isUtclPayment: true,
      isAdvance: false,
    });
  }

  function handleRecordClientUtclPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!clientSelectedOrgId) {
      toast.error("Please select a client");
      return;
    }

    if (clientPaymentType === "against_reference" && clientSelectedReferences.length === 0) {
      toast.error("Please select at least one Dispatch or PO reference");
      return;
    }

    let dispatchRequestIds: string[] | undefined = undefined;
    let purchaseOrderId: string | undefined = undefined;

    const selectedDrs = clientSelectedReferences.filter(r => r.startsWith("dr_")).map(r => r.replace("dr_", ""));
    const selectedPos = clientSelectedReferences.filter(r => r.startsWith("po_")).map(r => r.replace("po_", ""));

    if (selectedDrs.length > 0) {
      dispatchRequestIds = selectedDrs;
      const dr = dispatches?.find((d: any) => d.id === selectedDrs[0]);
      if (dr && dr.purchase_order_id) {
        purchaseOrderId = dr.purchase_order_id;
      }
    } else if (selectedPos.length > 0) {
      purchaseOrderId = selectedPos[0];
    }

    recordMutation.mutate({
      organizationId: clientSelectedOrgId,
      purchaseOrderId,
      dispatchRequestIds,
      amount: clientAmount,
      paymentDate: clientPaymentDate,
      paymentMode: clientPaymentMode,
      referenceNumber: clientReferenceNumber,
      isUtclPayment: true,
      isClientToUtcl: true,
      isAdvance: false,
    });
    setClientUtclModalOpen(false);
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  let filteredDispatches =
    dispatches?.filter((d: any) => {
      if (d.utcl_payment_id) return false; // Already paid

      const search = searchQuery.toLowerCase();
      return (
        d.organization?.legal_name?.toLowerCase().includes(search) ||
        (d.purchase_order || d.purchase_orders)?.po_number?.toLowerCase().includes(search) ||
        d.id.toLowerCase().includes(search)
      );
    }) || [];

  filteredDispatches.sort((a: any, b: any) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return isFifo ? timeA - timeB : timeB - timeA;
  });

  const toggleDispatchSelection = (dispatch: any) => {
    const exists = selectedDispatches.find((d) => d.id === dispatch.id);
    if (exists) {
      setSelectedDispatches((prev) => prev.filter((d) => d.id !== dispatch.id));
    } else {
      setSelectedDispatches((prev) => [...prev, dispatch]);
    }
    toast.success(`Dispatch ${exists ? "removed from" : "added to"} staging`);
  };

  const mundraUtclPayments = pastPayments?.filter((p: any) => !p.is_client_to_utcl) || [];
  const clientUtclPayments = pastPayments?.filter((p: any) => p.is_client_to_utcl) || [];

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">UTCL Payments</h1>
            <p className="text-sm text-muted-foreground">
              Record and monitor payments sent to UTCL.
            </p>
          </div>
        </header>

        <Tabs defaultValue="mundra-utcl" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="mundra-utcl">Mundra to UTCL</TabsTrigger>
            <TabsTrigger value="client-utcl">Client to UTCL</TabsTrigger>
          </TabsList>

          <TabsContent value="mundra-utcl" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setDispatchModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Record payment to UTCL
              </Button>
            </div>

            {/* Dispatch Selection Modal */}
            <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
              <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Select Dispatches for Payment</DialogTitle>
                  <DialogDescription>
                    Choose one or more dispatches to record a payment against.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto py-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search client or PO number..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button
                      variant={isFifo ? "default" : "outline"}
                      onClick={() => setIsFifo(!isFifo)}
                      type="button"
                    >
                      FIFO Policy
                    </Button>
                  </div>

                  {dispatchesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>PO Number</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDispatches.length > 0 ? (
                          filteredDispatches.map((d: any) => {
                            const isSelected = selectedDispatches.some((sd) => sd.id === d.id);
                            return (
                              <TableRow key={d.id} className={isSelected ? "bg-primary/5" : ""}>
                                <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="font-semibold">
                                  {d.organization?.legal_name || "Unknown Client"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {(d.purchase_order || d.purchase_orders)?.po_number || "N/A"}
                                </TableCell>
                                <TableCell>{d.quantity} MT</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {d.status
                                      ? d.status.charAt(0).toUpperCase() +
                                        d.status.slice(1).replace("_", " ")
                                      : ""}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant={isSelected ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => toggleDispatchSelection(d)}
                                  >
                                    {isSelected ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Selected
                                      </>
                                    ) : (
                                      "Select"
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-6 text-muted-foreground"
                            >
                              No dispatches found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <DialogFooter className="mt-auto pt-4">
                  <Button onClick={() => setDispatchModalOpen(false)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Staging Area for Selected Dispatches */}
            {selectedDispatches.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3 border-b border-primary/10">
                  <CardTitle className="text-base font-semibold text-primary">
                    Pending UTCL Payments (Staging)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Dispatch Qty</TableHead>
                        <TableHead>Dispatch Value</TableHead>
                        <TableHead>Paid to UTCL</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Requested Delivery Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDispatches.map((dispatch) => {
                        const po = dispatch.purchase_order;
                        const dispatchValue = dispatch.quantity * (po?.locked_rate || 0);
                        const utclPayments =
                          po?.payments?.filter(
                            (p: any) =>
                              p.is_utcl_payment &&
                              (p.status === "approved" || p.status === "verified"),
                          ) || [];
                        const paidToUtcl = utclPayments.reduce(
                          (acc: number, curr: any) => acc + (curr.amount || 0),
                          0,
                        );
                        const remaining = Math.max(0, dispatchValue - paidToUtcl); // In reality this logic might be flawed if multiple dispatches are paid separately, but we'll adapt to dispatchValue.

                        return (
                          <TableRow key={dispatch.id} className="bg-background">
                            <TableCell className="font-semibold">
                              {dispatch.organization?.legal_name || "Unknown Client"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {po?.po_number || "N/A"}
                            </TableCell>
                            <TableCell>{dispatch.quantity} MT</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(dispatchValue)}
                            </TableCell>
                            <TableCell className="text-success font-medium">
                              {formatCurrency(paidToUtcl)}
                            </TableCell>
                            <TableCell className="text-destructive font-medium">
                              {formatCurrency(remaining)}
                            </TableCell>
                            <TableCell>
                              {new Date(dispatch.requested_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                onClick={() => toggleDispatchSelection(dispatch)}
                                title="Remove from Staging"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={3} className="text-right">
                          Total:
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            selectedDispatches.reduce(
                              (acc, d) => acc + d.quantity * (d.purchase_order?.locked_rate || 0),
                              0,
                            ),
                          )}
                        </TableCell>
                        <TableCell colSpan={4}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <div className="p-4 flex justify-end border-t border-primary/10">
                    <Dialog
                      open={openDispatchId === "lumpsum"}
                      onOpenChange={(isOpen) => {
                        if (!isOpen) {
                          setOpenDispatchId(null);
                          resetForm();
                        } else {
                          setOpenDispatchId("lumpsum");
                          const totalAmount = selectedDispatches.reduce(
                            (acc, d) => acc + d.quantity * (d.purchase_order?.locked_rate || 0),
                            0,
                          );
                          setAmount(totalAmount);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button>Record Lumpsum Payment</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleRecordLumpsumPayment}>
                          <DialogHeader>
                            <DialogTitle>Record UTCL Lumpsum Payment</DialogTitle>
                            <DialogDescription>
                              Record a single payment sent to UTCL covering{" "}
                              {selectedDispatches.length} dispatch(es).
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-1">
                              <Label>Lumpsum Amount Paid to UTCL (₹) *</Label>
                              <Input
                                type="number"
                                value={amount || ""}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                placeholder="0"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label>Payment Date *</Label>
                                <Input
                                  type="date"
                                  value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Mode *</Label>
                                <Select value={paymentMode} onValueChange={setPaymentMode} required>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select mode" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="RTGS">RTGS</SelectItem>
                                    <SelectItem value="NEFT">NEFT</SelectItem>
                                    <SelectItem value="IMPS">IMPS</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label>Reference / UTR Number *</Label>
                              <Input
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="Unique UTR Code"
                                required
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={recordMutation.isPending}>
                              {recordMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Confirm Payment
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* UTCL Payment History */}
            <Card>
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold">UTCL Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Dispatch Qty</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Mode & Ref</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mundraUtclPayments.length > 0 ? (
                        mundraUtclPayments.map((p: any) => {
                          const dispatches = p.dispatch_requests || [];

                          let clientName = p.organizations?.legal_name || "Unknown Client";
                          let poNumber = p.purchase_orders?.po_number || (p.is_advance ? "Advance" : "On Account");
                          let dispatchQtyText = p.is_advance ? "Advance" : (dispatches.length > 0 ? "—" : "—");

                          if (dispatches.length === 1) {
                            const d = dispatches[0];
                            clientName =
                              clientName !== "Unknown Client" ? clientName : (d.purchase_orders?.organizations?.legal_name || "Unknown Client");
                            poNumber = d.purchase_orders?.po_number || poNumber;
                            dispatchQtyText = d.quantity ? `${d.quantity} MT` : dispatchQtyText;
                          } else if (dispatches.length > 1) {
                            clientName = "Multiple Clients";

                            // Check if all dispatches belong to the same client
                            const clientNames = Array.from(
                              new Set(
                                dispatches
                                  .map((d: any) => d.purchase_orders?.organizations?.legal_name)
                                  .filter(Boolean),
                              ),
                            );
                            if (clientNames.length === 1) {
                              clientName = clientNames[0] as string;
                            }

                            poNumber = "Multiple";
                            const totalQty = dispatches.reduce(
                              (acc: number, curr: any) => acc + (curr.quantity || 0),
                              0,
                            );
                            dispatchQtyText = `${totalQty} MT (Total)`;
                          }

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {new Date(p.payment_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-semibold">{clientName}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {poNumber === "Multiple" ? (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="link"
                                        className="h-auto p-0 font-mono text-xs"
                                      >
                                        Multiple (View Details)
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Dispatches in this Payment</DialogTitle>
                                        <DialogDescription>
                                          Details of all {dispatches.length} dispatch(es) covered by
                                          this payment.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="py-4 space-y-3">
                                        {dispatches.map((d: any) => (
                                          <div
                                            key={d.id}
                                            className="flex justify-between items-center text-sm border-b pb-2 last:border-0"
                                          >
                                            <div>
                                              <div className="font-medium">
                                                {(d.purchase_order || d.purchase_orders)?.po_number || "N/A"}
                                              </div>
                                              <div className="text-muted-foreground text-xs">
                                                {(d.purchase_order || d.purchase_orders)?.organizations?.legal_name}
                                              </div>
                                            </div>
                                            <div className="font-mono">{d.quantity} MT</div>
                                          </div>
                                        ))}
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                ) : (
                                  poNumber
                                )}
                              </TableCell>
                              <TableCell>{dispatchQtyText}</TableCell>
                              <TableCell className="text-success font-bold">
                                {formatCurrency(p.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{p.payment_mode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.reference_number}
                                </div>
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Dialog
                                  open={editPaymentOpen === p.id}
                                  onOpenChange={(isOpen) => {
                                    if (!isOpen) setEditPaymentOpen(null);
                                    else {
                                      setEditAmount(p.amount);
                                      setEditPaymentDate(p.payment_date);
                                      setEditPaymentMode(p.payment_mode);
                                      setEditReferenceNumber(p.reference_number);
                                      setEditPaymentOpen(p.id);
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-primary"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        updateMutation.mutate({
                                          id: p.id,
                                          amount: editAmount,
                                          paymentDate: editPaymentDate,
                                          paymentMode: editPaymentMode,
                                          referenceNumber: editReferenceNumber,
                                        });
                                      }}
                                    >
                                      <DialogHeader>
                                        <DialogTitle>Edit Payment</DialogTitle>
                                      </DialogHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="space-y-1">
                                          <Label>Amount Paid to UTCL (₹) *</Label>
                                          <Input
                                            type="number"
                                            value={editAmount || ""}
                                            onChange={(e) => setEditAmount(Number(e.target.value))}
                                            required
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1">
                                            <Label>Payment Date *</Label>
                                            <Input
                                              type="date"
                                              value={editPaymentDate}
                                              onChange={(e) => setEditPaymentDate(e.target.value)}
                                              required
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label>Mode *</Label>
                                            <Select
                                              value={editPaymentMode}
                                              onValueChange={setEditPaymentMode}
                                              required
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select mode" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="RTGS">RTGS</SelectItem>
                                                <SelectItem value="NEFT">NEFT</SelectItem>
                                                <SelectItem value="IMPS">IMPS</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label>Reference / UTR Number *</Label>
                                          <Input
                                            value={editReferenceNumber}
                                            onChange={(e) => setEditReferenceNumber(e.target.value)}
                                            required
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          onClick={() => {
                                            if (
                                              window.confirm(
                                                "Are you sure you want to delete this payment? This cannot be undone.",
                                              )
                                            ) {
                                              deleteMutation.mutate(p.id);
                                            }
                                          }}
                                          disabled={deleteMutation.isPending}
                                        >
                                          Delete Entry
                                        </Button>
                                        <Button type="submit" disabled={updateMutation.isPending}>
                                          {updateMutation.isPending && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          )}{" "}
                                          Save Changes
                                        </Button>
                                      </DialogFooter>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Are you sure you want to delete this payment? This cannot be undone.",
                                      )
                                    ) {
                                      deleteMutation.mutate(p.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No UTCL payments recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="client-utcl" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={clientUtclModalOpen} onOpenChange={setClientUtclModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" /> Record Client Payment to UTCL
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleRecordClientUtclPayment}>
                    <DialogHeader>
                      <DialogTitle>Record Client Payment to UTCL</DialogTitle>
                      <DialogDescription>
                        Manually enter a payment made by a client directly to UTCL.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-1">
                        <Label>Client *</Label>
                        <Select
                          value={clientSelectedOrgId}
                          onValueChange={setClientSelectedOrgId}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client: any) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.legal_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Payment Type *</Label>
                        <Select
                          value={clientPaymentType}
                          onValueChange={(val: any) => {
                            setClientPaymentType(val);
                            if (val === "on_account") {
                              setClientSelectedReferences([]);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_account">
                              On Account (No specific reference)
                            </SelectItem>
                            <SelectItem value="against_reference">
                              Against Reference (PO or Dispatch)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {clientPaymentType === "against_reference" &&
                        clientSelectedOrgId &&
                        (() => {
                          const openClientPos =
                            purchaseOrders?.filter(
                              (po: any) =>
                                po.organization_id === clientSelectedOrgId &&
                                po.status !== "completed" &&
                                po.status !== "cancelled",
                            ) || [];

                          let openClientDispatches =
                            dispatches?.filter(
                              (d: any) =>
                                d.organization_id === clientSelectedOrgId &&
                                [
                                  "approved",
                                  "auto_approved",
                                  "pending_mundra",
                                  "submitted",
                                ].includes(d.status),
                            ) || [];

                          return (
                            <div className="space-y-3">
                              <Label>Select Dispatches or PO *</Label>
                              <div className="border rounded-md p-4 space-y-4 max-h-60 overflow-y-auto bg-muted/10">
                                {openClientDispatches.length > 0 && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Dispatches (Preferred)</h4>
                                    {openClientDispatches.map((d: any) => {
                                      const hasPoSelected = clientSelectedReferences.some(r => r.startsWith('po_'));
                                      return (
                                      <div key={d.id} className="flex items-center space-x-3">
                                        <Checkbox
                                          id={`ref_${d.id}`}
                                          disabled={hasPoSelected}
                                          checked={clientSelectedReferences.includes(`dr_${d.id}`)}
                                          onCheckedChange={(checked) => {
                                            let newRefs = [...clientSelectedReferences];
                                            if (checked) {
                                              newRefs = [...newRefs.filter(r => !r.startsWith('po_')), `dr_${d.id}`];
                                            } else {
                                              newRefs = newRefs.filter(r => r !== `dr_${d.id}`);
                                            }
                                            setClientSelectedReferences(newRefs);

                                            // Calculate total amount for selected dispatches
                                            const totalAmount = newRefs.reduce((acc, ref) => {
                                              if (ref.startsWith('dr_')) {
                                                const drId = ref.replace('dr_', '');
                                                const dr = openClientDispatches.find((od: any) => od.id === drId);
                                                if (dr) {
                                                  return acc + (dr.quantity || 0) * ((dr.purchase_order || dr.purchase_orders)?.locked_rate || 0);
                                                }
                                              }
                                              return acc;
                                            }, 0);
                                            if (totalAmount > 0 || newRefs.length === 0) {
                                              setClientAmount(totalAmount);
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`ref_${d.id}`} className={`font-normal cursor-pointer text-sm leading-snug ${hasPoSelected ? 'opacity-50' : ''}`}>
                                          Dispatch: Qty {d.quantity} MT {d.invoice_number ? `(Inv: ${d.invoice_number})` : ""} {(d.purchase_order || d.purchase_orders)?.po_number ? `(PO: ${(d.purchase_order || d.purchase_orders).po_number})` : ""}
                                        </Label>
                                      </div>
                                    )})}
                                  </div>
                                )}
                                
                                {openClientPos.length > 0 && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Purchase Orders</h4>
                                    {openClientPos.map((po: any) => {
                                      const hasDrSelected = clientSelectedReferences.some(r => r.startsWith('dr_'));
                                      return (
                                      <div key={po.id} className="flex items-center space-x-3">
                                        <Checkbox
                                          id={`ref_${po.id}`}
                                          disabled={hasDrSelected}
                                          checked={clientSelectedReferences.includes(`po_${po.id}`)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setClientSelectedReferences([`po_${po.id}`]);
                                              const poAmount = (po.original_quantity || 0) * (po.locked_rate || 0);
                                              setClientAmount(poAmount);
                                            } else {
                                              setClientSelectedReferences((prev) => prev.filter(r => r !== `po_${po.id}`));
                                              setClientAmount(0);
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`ref_${po.id}`} className={`font-normal cursor-pointer text-sm leading-snug ${hasDrSelected ? 'opacity-50' : ''}`}>
                                          PO: {po.po_number || "Unnamed PO"} (Pay against PO)
                                        </Label>
                                      </div>
                                    )})}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                      <div className="space-y-1">
                        <Label>Amount Paid to UTCL (₹) *</Label>
                        <Input
                          type="number"
                          value={clientAmount || ""}
                          onChange={(e) => setClientAmount(Number(e.target.value))}
                          placeholder="0"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label>Payment Date *</Label>
                          <Input
                            type="date"
                            value={clientPaymentDate}
                            onChange={(e) => setClientPaymentDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Mode *</Label>
                          <Select
                            value={clientPaymentMode}
                            onValueChange={setClientPaymentMode}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RTGS">RTGS</SelectItem>
                              <SelectItem value="NEFT">NEFT</SelectItem>
                              <SelectItem value="IMPS">IMPS</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Reference / UTR Number *</Label>
                        <Input
                          value={clientReferenceNumber}
                          onChange={(e) => setClientReferenceNumber(e.target.value)}
                          placeholder="Unique UTR Code"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={recordMutation.isPending}>
                        {recordMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Confirm Payment
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold">
                  Client to UTCL Payment History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Mode & Ref</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientUtclPayments.length > 0 ? (
                        clientUtclPayments.map((p: any) => {
                          const clientName =
                            clients?.find((c: any) => c.id === p.organization_id)?.legal_name ||
                            "Unknown Client";

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {new Date(p.payment_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-semibold">{clientName}</TableCell>
                              <TableCell className="text-success font-bold">
                                {formatCurrency(p.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{p.payment_mode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.reference_number}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const linkedDispatches =
                                    dispatches?.filter((d: any) => d.utcl_payment_id === p.id) ||
                                    [];
                                  const linkedPo = purchaseOrders?.find(
                                    (po: any) => po.id === p.purchase_order_id,
                                  );

                                  if (linkedDispatches.length > 0) {
                                    return (
                                      <Badge variant="outline">
                                        Dispatches ({linkedDispatches.length})
                                      </Badge>
                                    );
                                  }
                                  if (linkedPo) {
                                    return (
                                      <Badge variant="secondary">PO: {linkedPo.po_number}</Badge>
                                    );
                                  }
                                  return <Badge variant="default">On Account</Badge>;
                                })()}
                              </TableCell>
                              <TableCell className="text-right flex items-center justify-end space-x-2">
                                <Dialog
                                  open={editPaymentOpen === p.id}
                                  onOpenChange={(isOpen) => {
                                    if (!isOpen) setEditPaymentOpen(null);
                                    else {
                                      setEditAmount(p.amount);
                                      setEditPaymentDate(p.payment_date);
                                      setEditPaymentMode(p.payment_mode);
                                      setEditReferenceNumber(p.reference_number);
                                      setEditPaymentOpen(p.id);
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-primary"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        updateMutation.mutate({
                                          id: p.id,
                                          amount: editAmount,
                                          paymentDate: editPaymentDate,
                                          paymentMode: editPaymentMode,
                                          referenceNumber: editReferenceNumber,
                                        });
                                      }}
                                    >
                                      <DialogHeader>
                                        <DialogTitle>Edit Payment</DialogTitle>
                                      </DialogHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="space-y-1">
                                          <Label>Amount Paid to UTCL (₹) *</Label>
                                          <Input
                                            type="number"
                                            value={editAmount || ""}
                                            onChange={(e) => setEditAmount(Number(e.target.value))}
                                            required
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1">
                                            <Label>Payment Date *</Label>
                                            <Input
                                              type="date"
                                              value={editPaymentDate}
                                              onChange={(e) => setEditPaymentDate(e.target.value)}
                                              required
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label>Mode *</Label>
                                            <Select
                                              value={editPaymentMode}
                                              onValueChange={setEditPaymentMode}
                                              required
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select mode" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="RTGS">RTGS</SelectItem>
                                                <SelectItem value="NEFT">NEFT</SelectItem>
                                                <SelectItem value="IMPS">IMPS</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label>Reference / UTR Number *</Label>
                                          <Input
                                            value={editReferenceNumber}
                                            onChange={(e) => setEditReferenceNumber(e.target.value)}
                                            required
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          onClick={() => {
                                            if (
                                              window.confirm(
                                                "Are you sure you want to delete this payment? This cannot be undone.",
                                              )
                                            ) {
                                              deleteMutation.mutate(p.id);
                                            }
                                          }}
                                          disabled={deleteMutation.isPending}
                                        >
                                          Delete Entry
                                        </Button>
                                        <Button type="submit" disabled={updateMutation.isPending}>
                                          {updateMutation.isPending && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          )}{" "}
                                          Save Changes
                                        </Button>
                                      </DialogFooter>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Are you sure you want to delete this payment? This cannot be undone.",
                                      )
                                    ) {
                                      deleteMutation.mutate(p.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No Client to UTCL payments recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
