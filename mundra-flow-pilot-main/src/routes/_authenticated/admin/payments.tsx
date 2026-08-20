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
  getRefundLetterReferences,
  getUtclRefundLetters,
  createUtclRefundLetter,
  updateUtclRefundLetterStatus,
  getInvoices,
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
import { Loader2, Plus, Search, CheckCircle2, Trash2, Pencil, ArrowDownLeft, FileText, IndianRupee, Clock } from "lucide-react";
import { useSessionContext } from "@/lib/auth-hooks";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  ssr: false,
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSessionContext();

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedDispatches, setSelectedDispatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFifo, setIsFifo] = useState(false);

  // Payment Form State
  const [openDispatchId, setOpenDispatchId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("RTGS");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [dispatchPaymentOpts, setDispatchPaymentOpts] = useState<Record<string, { type: "full" | "partial" | "advance", amount: number }>>({});

  // Edit Payment State
  const [editPaymentOpen, setEditPaymentOpen] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("RTGS");
  const [editReferenceNumber, setEditReferenceNumber] = useState("");

  // Client to UTCL Payment State
  const [clientUtclModalOpen, setClientUtclModalOpen] = useState(false);
  const [clientSelectedOrgId, setClientSelectedOrgId] = useState<string>("");
  const [clientPaymentDate, setClientPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientPaymentMode, setClientPaymentMode] = useState<string>("");
  const [clientReferenceNumber, setClientReferenceNumber] = useState<string>("");
  const [clientAmount, setClientAmount] = useState<number>(0);
  const [clientPaymentType, setClientPaymentType] = useState<"on_account" | "against_reference">("against_reference");
  const [clientSelectedReferences, setClientSelectedReferences] = useState<string[]>([]);
  const [clientPaymentOpts, setClientPaymentOpts] = useState<Record<string, { isAdvance: boolean, amount: number }>>({});

  // UTCL to Mundra Refund Letters State
  const [utclMundraDialogOpen, setUtclMundraDialogOpen] = useState(false);
  const [utclMundraRefNumber, setUtclMundraRefNumber] = useState("");
  const [utclMundraAmount, setUtclMundraAmount] = useState("");

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

  const { data: invoices } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => getInvoices(),
  });

  // UTCL to Mundra refund letters queries
  const { data: utclRefundLetters, isLoading: utclRefundLoading } = useQuery({
    queryKey: ["utcl-refund-letters"],
    queryFn: () => getUtclRefundLetters(),
  });

  const { data: refundReferences, isLoading: refundReferencesLoading } = useQuery({
    queryKey: ["refund-letter-references"],
    queryFn: () => getRefundLetterReferences(),
  });

  const addUtclRefundMutation = useMutation({
    mutationFn: async (payload: { reference_number: string; amount: number }) => {
      return createUtclRefundLetter({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utcl-refund-letters"] });
      toast.success("Refund letter added successfully");
      setUtclMundraDialogOpen(false);
      setUtclMundraRefNumber("");
      setUtclMundraAmount("");
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast.error("A refund letter with this reference number already exists");
      } else {
        toast.error("Failed to add refund letter");
      }
    },
  });

  const toggleUtclPaidMutation = useMutation({
    mutationFn: async (payload: { id: string; is_paid: boolean }) => {
      return updateUtclRefundLetterStatus({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utcl-refund-letters"] });
    },
    onError: () => {
      toast.error("Failed to update payment status");
    },
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
    setTotalAmount(0);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("RTGS");
    setReferenceNumber("");
    setDispatchPaymentOpts({});
    setClientSelectedOrgId("");
    setClientAmount(0);
    setClientPaymentType("against_reference");
    setClientPaymentDate(new Date().toISOString().split("T")[0]);
    setClientPaymentMode("");
    setClientReferenceNumber("");
    setClientAmount(0);
    setClientPaymentType("against_reference");
    setClientSelectedReferences([]);
    setClientPaymentOpts({});
  }

  async function handleRecordLumpsumPayment(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDispatches.length === 0) return;

    try {
      const validDispatches = selectedDispatches.filter(d => (dispatchPaymentOpts[d.id]?.amount || 0) > 0);
      if (validDispatches.length === 0) return;

      const promises = validDispatches.map((d) => {
        const opt = dispatchPaymentOpts[d.id];
        const isAdvance = opt?.type === "advance";
        const amt = opt?.amount || 0;

        return recordMutation.mutateAsync({
          organizationId: d.organization_id,
          purchaseOrderId: d.purchase_order_id,
          dispatchRequestIds: [d.id],
          amount: amt,
          paymentDate,
          paymentMode,
          referenceNumber,
          isUtclPayment: true,
          isAdvance: isAdvance,
          isClientToUtcl: false,
        });
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleRecordClientUtclPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!clientSelectedOrgId) {
      toast.error("Please select a client");
      return;
    }

    if (clientPaymentType === "against_reference" && clientSelectedReferences.length === 0) {
      toast.error("Please select at least one Dispatch or PO reference");
      return;
    }

    if (clientPaymentType === "against_reference") {
      const promises = clientSelectedReferences.map((ref) => {
        const opt = clientPaymentOpts[ref];
        if (!opt || opt.amount <= 0) return Promise.resolve();

        let dispatchRequestIds: string[] | undefined = undefined;
        let purchaseOrderId: string | undefined = undefined;
        // Without an explicit allocation the RPC falls back to auto-FIFO, which
        // walks the client's oldest invoices and dumps the money on the opening
        // balance — losing the link to the dispatch actually being paid for.
        // Allocate to the selected dispatch's own invoice instead.
        let allocations: Array<{ invoice_id: string; allocated_amount: number; tds_amount: number }> | undefined;

        if (ref.startsWith("dr_")) {
          const drId = ref.replace("dr_", "");
          dispatchRequestIds = [drId];
          const dr = dispatches?.find((d: any) => d.id === drId);
          if (dr && dr.purchase_order_id) {
            purchaseOrderId = dr.purchase_order_id;
          }
          // An advance is deliberately not tied to an invoice yet.
          if (!opt.isAdvance && dr?.invoice?.id) {
            // The RPC rejects an allocation larger than what the invoice still owes.
            const allocatable = Math.min(opt.amount, Number(dr.invoice.outstanding) || 0);
            if (allocatable > 0) {
              allocations = [
                { invoice_id: dr.invoice.id, allocated_amount: allocatable, tds_amount: 0 },
              ];
            }
          }
        } else if (ref.startsWith("po_")) {
          purchaseOrderId = ref.replace("po_", "");
        } else if (ref.startsWith("ob_")) {
          const obId = ref.replace("ob_", "");
          allocations = [
            { invoice_id: obId, allocated_amount: opt.amount, tds_amount: 0 },
          ];
        }

        return recordMutation.mutateAsync({
          organizationId: clientSelectedOrgId,
          purchaseOrderId,
          dispatchRequestIds,
          amount: opt.amount,
          paymentDate: clientPaymentDate,
          paymentMode: clientPaymentMode,
          referenceNumber: clientReferenceNumber,
          isUtclPayment: true,
          isClientToUtcl: true,
          isAdvance: opt.isAdvance,
          allocations,
        });
      });
      await Promise.all(promises);
      setClientUtclModalOpen(false);
      return;
    }

    await recordMutation.mutateAsync({
      organizationId: clientSelectedOrgId,
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

  const derivedClientAmount = clientPaymentType === "against_reference"
    ? clientSelectedReferences.reduce((acc, ref) => acc + (clientPaymentOpts[ref]?.amount || 0), 0)
    : clientAmount;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  // A dispatch draws from one PO line item, so that item's rate is the accurate
  // one. purchase_orders.locked_rate is only a legacy copy of the FIRST line
  // item, so it is wrong for any other product on a multi-product PO — use it
  // only as a fallback for older dispatches that predate line items.
  const rateForDispatch = (d: any): number =>
    Number(
      d?.purchase_order_item?.locked_rate ??
        (d?.purchase_order || d?.purchase_orders)?.locked_rate ??
        0,
    ) || 0;
  const valueOfDispatch = (d: any): number => (Number(d?.quantity) || 0) * rateForDispatch(d);

  // Pre-calculate Total UTCL coverage for dispatches
  const mundraDispatchCoverage = new Map<string, { fullyCovered: boolean; paidAmount: number; remaining: number }>();
  const clientDispatchCoverage = new Map<string, { fullyCovered: boolean; paidAmount: number; remaining: number }>();

  if (dispatches) {
    const explicitMundraPaid = new Map<string, number>();
    const explicitClientPaid = new Map<string, number>();

    const generalMundraPaid = new Map<string, number>();
    const generalClientPaid = new Map<string, number>();

    if (pastPayments) {
      pastPayments.forEach((p: any) => {
        if (p.is_utcl_payment && (p.status === "approved" || p.status === "verified")) {
          const isClient = !!p.is_client_to_utcl;
          const linkedDrs = p.dispatch_requests || [];
          const amt = p.amount || 0;

          if (linkedDrs.length > 0) {
            const amtPerDr = amt / linkedDrs.length;
            linkedDrs.forEach((dr: any) => {
              if (isClient) {
                explicitClientPaid.set(dr.id, (explicitClientPaid.get(dr.id) || 0) + amtPerDr);
              } else {
                explicitMundraPaid.set(dr.id, (explicitMundraPaid.get(dr.id) || 0) + amtPerDr);
              }
            });
          } else if (p.purchase_order_id) {
            if (isClient) {
              generalClientPaid.set(p.purchase_order_id, (generalClientPaid.get(p.purchase_order_id) || 0) + amt);
            } else {
              generalMundraPaid.set(p.purchase_order_id, (generalMundraPaid.get(p.purchase_order_id) || 0) + amt);
            }
          }
        }
      });
    }

    const sortedDispatches = [...dispatches].sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedDispatches.forEach((d: any) => {
      const po = d.purchase_order || d.purchase_orders;
      const dispatchValue = valueOfDispatch(d);

      let clientPaidForThis = explicitClientPaid.get(d.id) || 0;
      let mundraPaidForThis = explicitMundraPaid.get(d.id) || 0;

      if (po && po.id) {
        // Process Client General PO Payments
        const clientGenBalance = generalClientPaid.get(po.id) || 0;
        const clientStillNeeded = Math.max(0, dispatchValue - clientPaidForThis);
        if (clientStillNeeded > 0 && clientGenBalance > 0) {
          const applyGen = Math.min(clientStillNeeded, clientGenBalance);
          clientPaidForThis += applyGen;
          generalClientPaid.set(po.id, clientGenBalance - applyGen);
        }

        // Process Mundra General PO Payments
        const mundraGenBalance = generalMundraPaid.get(po.id) || 0;
        const mundraStillNeeded = Math.max(0, dispatchValue - (clientPaidForThis + mundraPaidForThis));
        if (mundraStillNeeded > 0 && mundraGenBalance > 0) {
          const applyGen = Math.min(mundraStillNeeded, mundraGenBalance);
          mundraPaidForThis += applyGen;
          generalMundraPaid.set(po.id, mundraGenBalance - applyGen);
        }
      }

      const clientRemaining = Math.max(0, dispatchValue - clientPaidForThis);
      clientDispatchCoverage.set(d.id, {
        // A dispatch with no resolvable value (rate missing) is NOT "fully
        // paid" — treating it as such silently hides it from the operator.
        fullyCovered: dispatchValue > 0 && clientRemaining <= 0,
        paidAmount: clientPaidForThis,
        remaining: clientRemaining
      });

      const mundraRemaining = Math.max(0, dispatchValue - (clientPaidForThis + mundraPaidForThis));
      mundraDispatchCoverage.set(d.id, {
        fullyCovered: dispatchValue > 0 && mundraRemaining <= 0,
        paidAmount: clientPaidForThis + mundraPaidForThis,
        remaining: mundraRemaining
      });
    });
  }

  let filteredDispatches =
    dispatches?.filter((d: any) => {
      if (mundraDispatchCoverage.get(d.id)?.fullyCovered) return false;

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
    const remainingBalance =
      mundraDispatchCoverage.get(dispatch.id)?.remaining ?? valueOfDispatch(dispatch);

    let newSelection = [];
    if (exists) {
      newSelection = selectedDispatches.filter((d) => d.id !== dispatch.id);
      setSelectedDispatches(newSelection);
      setDispatchPaymentOpts(prev => {
        const next = { ...prev };
        delete next[dispatch.id];
        return next;
      });
    } else {
      newSelection = [...selectedDispatches, dispatch];
      setSelectedDispatches(newSelection);
      setDispatchPaymentOpts(prev => ({
        ...prev,
        [dispatch.id]: { type: "full", amount: remainingBalance }
      }));
    }

    // Auto-calculate amount for the payment box
    const totalAmountCalc = newSelection.reduce((acc, d) => {
      const drRem = mundraDispatchCoverage.get(d.id)?.remaining ?? valueOfDispatch(d);
      return acc + drRem;
    }, 0);
    setAmount(totalAmountCalc);
    setTotalAmount(totalAmountCalc);

    toast.success(`Dispatch ${exists ? "removed from" : "added to"} staging`);
  };

  const updateDispatchPaymentOpt = (dispatchId: string, key: "type" | "amount", value: any) => {
    setDispatchPaymentOpts(prev => {
      const next = { ...prev };
      if (next[dispatchId]) {
        next[dispatchId] = { ...next[dispatchId], [key]: value };
      }
      return next;
    });
  };

  const updateDispatchOptWrapper = (id: string, type: "advance" | "partial") => {
    setDispatchPaymentOpts(prev => {
      const current = prev[id]?.type;
      const newType = current === type ? "full" : type;
      return {
        ...prev,
        [id]: { ...prev[id], type: newType }
      };
    });
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
          <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
            <TabsTrigger value="mundra-utcl">Mundra to UTCL</TabsTrigger>
            <TabsTrigger value="client-utcl">Client to UTCL</TabsTrigger>
            <TabsTrigger value="utcl-to-mundra">UTCL to Mundra</TabsTrigger>
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
                                  {d.invoice_number && (
                                    <>
                                      <br />
                                      <span className="text-muted-foreground">Inv: {d.invoice_number}</span>
                                    </>
                                  )}
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
                                  <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3">
                                    {isSelected && (
                                      <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground mr-2">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`opt_${d.id}`}
                                            checked={dispatchPaymentOpts[d.id]?.type === "advance"}
                                            onChange={() => updateDispatchOptWrapper(d.id, "advance")}
                                          /> Advance
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`opt_${d.id}`}
                                            checked={dispatchPaymentOpts[d.id]?.type === "partial"}
                                            onChange={() => updateDispatchOptWrapper(d.id, "partial")}
                                          /> Partial
                                        </label>
                                      </div>
                                    )}
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
                                  </div>
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
                        <TableHead>Amount to Pay</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDispatches.map((dispatch) => {
                        const po = dispatch.purchase_order;
                        const dispatchValue = valueOfDispatch(dispatch);
                        const paidToUtcl = mundraDispatchCoverage.get(dispatch.id)?.paidAmount || 0;
                        const remaining = mundraDispatchCoverage.get(dispatch.id)?.remaining ?? Math.max(0, dispatchValue - paidToUtcl);

                        return (
                          <TableRow key={dispatch.id} className="bg-background">
                            <TableCell className="font-semibold">
                              {dispatch.organization?.legal_name || "Unknown Client"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {po?.po_number || "N/A"}
                              {dispatch.invoice_number && (
                                <>
                                  <br />
                                  <span className="text-muted-foreground">Inv: {dispatch.invoice_number}</span>
                                </>
                              )}
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
                            <TableCell>
                              {["partial", "advance"].includes(dispatchPaymentOpts[dispatch.id]?.type || "") ? (
                                <Input
                                  type="number"
                                  value={dispatchPaymentOpts[dispatch.id]?.amount || ""}
                                  onChange={(e) => updateDispatchPaymentOpt(dispatch.id, "amount", Number(e.target.value))}
                                  className="w-24 h-8"
                                />
                              ) : (
                                formatCurrency(dispatchPaymentOpts[dispatch.id]?.amount || 0)
                              )}
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
                            selectedDispatches.reduce((acc, d) => acc + (dispatchPaymentOpts[d.id]?.amount || 0), 0)
                          )}
                        </TableCell>
                        <TableCell colSpan={5}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <div className="p-4 border-t border-primary/10 bg-muted/10">
                    <form onSubmit={handleRecordLumpsumPayment}>
                      <h4 className="font-semibold mb-4 text-primary">Record UTCL Payment for Selected Dispatches</h4>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                        <div className="space-y-1">
                          <Label>Amount Paid to UTCL (₹) *</Label>
                          <Input
                            type="number"
                            value={selectedDispatches.reduce((acc, d) => acc + (dispatchPaymentOpts[d.id]?.amount || 0), 0)}
                            readOnly
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Sum of above staging rows
                          </p>
                        </div>
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
                      <div className="flex justify-end">
                        <Button type="submit" disabled={recordMutation.isPending}>
                          {recordMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Confirm Payment
                        </Button>
                      </div>
                    </form>
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
                                                {d.invoice_number && <span className="text-muted-foreground font-normal ml-1">(Inv: {d.invoice_number})</span>}
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
                                  <>
                                    {poNumber}
                                    {dispatches.length === 1 && dispatches[0].invoice_number && (
                                      <>
                                        <br />
                                        <span className="text-muted-foreground">Inv: {dispatches[0].invoice_number}</span>
                                      </>
                                    )}
                                  </>
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
                              setClientPaymentOpts({});
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

                          const openClientObInvoice = invoices?.find(
                            (inv: any) =>
                              inv.organization_id === clientSelectedOrgId &&
                              inv.is_opening_balance === true &&
                              inv.status !== "paid" &&
                              inv.status !== "cancelled"
                          );

                          // Show every open dispatch for the client. Ones the
                          // client has already fully paid stay visible (so the
                          // invoice number is always available) but are locked.
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
                                      const isFullyPaid = !!clientDispatchCoverage.get(d.id)?.fullyCovered;
                                      return (
                                        <div key={d.id} className="flex flex-col">
                                          <div className="flex items-center space-x-3">
                                            <Checkbox
                                              id={`ref_${d.id}`}
                                              disabled={hasPoSelected || isFullyPaid}
                                              checked={clientSelectedReferences.includes(`dr_${d.id}`)}
                                              onCheckedChange={(checked) => {
                                                let newRefs = [...clientSelectedReferences];
                                                if (checked) {
                                                  newRefs = [...newRefs.filter(r => !r.startsWith('po_')), `dr_${d.id}`];
                                                  const val = valueOfDispatch(d);
                                                  const remaining = clientDispatchCoverage.get(d.id)?.remaining ?? val;
                                                  setClientPaymentOpts(prev => ({
                                                    ...prev,
                                                    [`dr_${d.id}`]: { isAdvance: false, amount: remaining }
                                                  }));
                                                } else {
                                                  newRefs = newRefs.filter(r => r !== `dr_${d.id}`);
                                                  setClientPaymentOpts(prev => {
                                                    const next = { ...prev };
                                                    delete next[`dr_${d.id}`];
                                                    return next;
                                                  });
                                                }
                                                setClientSelectedReferences(newRefs);
                                              }}
                                            />
                                            <Label htmlFor={`ref_${d.id}`} className={`font-normal cursor-pointer text-sm leading-snug ${hasPoSelected || isFullyPaid ? 'opacity-50' : ''}`}>
                                              Dispatch: Qty {d.quantity} MT {(d.invoice?.invoice_number || d.invoice_number) ? `(Inv: ${d.invoice?.invoice_number || d.invoice_number})` : ""} {(d.purchase_order || d.purchase_orders)?.po_number ? `(PO: ${(d.purchase_order || d.purchase_orders).po_number})` : ""}
                                              {` - Bal: ${formatCurrency(clientDispatchCoverage.get(d.id)?.remaining ?? valueOfDispatch(d))}`}
                                              {isFullyPaid && (
                                                <span className="ml-1 text-xs font-medium text-success">— fully paid</span>
                                              )}
                                            </Label>
                                          </div>

                                          {clientSelectedReferences.includes(`dr_${d.id}`) && (
                                            <div className="flex items-center space-x-4 ml-6 mt-2 mb-4 p-2 bg-muted/30 rounded-md">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`adv_dr_${d.id}`}
                                                  checked={clientPaymentOpts[`dr_${d.id}`]?.isAdvance || false}
                                                  onCheckedChange={(c) => {
                                                    setClientPaymentOpts(prev => ({
                                                      ...prev,
                                                      [`dr_${d.id}`]: { ...prev[`dr_${d.id}`], isAdvance: !!c }
                                                    }))
                                                  }}
                                                />
                                                <Label htmlFor={`adv_dr_${d.id}`} className="text-sm font-medium">Advance</Label>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <Label htmlFor={`amt_dr_${d.id}`} className="text-sm text-muted-foreground">Amount (₹):</Label>
                                                <Input
                                                  id={`amt_dr_${d.id}`}
                                                  type="number"
                                                  className="w-32 h-8"
                                                  value={clientPaymentOpts[`dr_${d.id}`]?.amount ?? ""}
                                                  onChange={(e) => {
                                                    setClientPaymentOpts(prev => ({
                                                      ...prev,
                                                      [`dr_${d.id}`]: { ...prev[`dr_${d.id}`], amount: Number(e.target.value) }
                                                    }))
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {openClientPos.length > 0 && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Purchase Orders</h4>
                                    {openClientPos.map((po: any) => {
                                      const hasDrSelected = clientSelectedReferences.some(r => r.startsWith('dr_'));
                                      return (
                                        <div key={po.id} className="flex flex-col">
                                          <div className="flex items-center space-x-3">
                                            <Checkbox
                                              id={`ref_${po.id}`}
                                              disabled={hasDrSelected}
                                              checked={clientSelectedReferences.includes(`po_${po.id}`)}
                                              onCheckedChange={(checked) => {
                                                if (checked) {
                                                  setClientSelectedReferences([`po_${po.id}`]);
                                                  // total_value covers every line item on a
                                                  // multi-product PO; the quantity x rate fallback
                                                  // is only the first item, for older POs.
                                                  const poAmount =
                                                    Number(po.total_value) ||
                                                    (Number(po.original_quantity) || 0) *
                                                      (Number(po.locked_rate) || 0);
                                                  setClientPaymentOpts({
                                                    [`po_${po.id}`]: { isAdvance: false, amount: poAmount }
                                                  });
                                                } else {
                                                  setClientSelectedReferences((prev) => prev.filter(r => r !== `po_${po.id}`));
                                                  setClientPaymentOpts({});
                                                }
                                              }}
                                            />
                                            <Label htmlFor={`ref_${po.id}`} className={`font-normal cursor-pointer text-sm leading-snug ${hasDrSelected ? 'opacity-50' : ''}`}>
                                              PO: {po.po_number || "Unnamed PO"} (Pay against PO)
                                            </Label>
                                          </div>

                                          {clientSelectedReferences.includes(`po_${po.id}`) && (
                                            <div className="flex items-center space-x-4 ml-6 mt-2 mb-4 p-2 bg-muted/30 rounded-md">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`adv_po_${po.id}`}
                                                  checked={clientPaymentOpts[`po_${po.id}`]?.isAdvance || false}
                                                  onCheckedChange={(c) => {
                                                    setClientPaymentOpts(prev => ({
                                                      ...prev,
                                                      [`po_${po.id}`]: { ...prev[`po_${po.id}`], isAdvance: !!c }
                                                    }))
                                                  }}
                                                />
                                                <Label htmlFor={`adv_po_${po.id}`} className="text-sm font-medium">Advance</Label>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <Label htmlFor={`amt_po_${po.id}`} className="text-sm text-muted-foreground">Amount (₹):</Label>
                                                <Input
                                                  id={`amt_po_${po.id}`}
                                                  type="number"
                                                  className="w-32 h-8"
                                                  value={clientPaymentOpts[`po_${po.id}`]?.amount ?? ""}
                                                  onChange={(e) => {
                                                    setClientPaymentOpts(prev => ({
                                                      ...prev,
                                                      [`po_${po.id}`]: { ...prev[`po_${po.id}`], amount: Number(e.target.value) }
                                                    }))
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {openClientObInvoice && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Opening Balance</h4>
                                    <div className="flex flex-col">
                                      <div className="flex items-center space-x-3">
                                        <Checkbox
                                          id={`ref_ob_${openClientObInvoice.id}`}
                                          checked={clientSelectedReferences.includes(`ob_${openClientObInvoice.id}`)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setClientSelectedReferences((prev) => [...prev, `ob_${openClientObInvoice.id}`]);
                                              setClientPaymentOpts((prev) => ({
                                                ...prev,
                                                [`ob_${openClientObInvoice.id}`]: { isAdvance: false, amount: Number(openClientObInvoice.amount) || 0 }
                                              }));
                                            } else {
                                              setClientSelectedReferences((prev) => prev.filter(r => r !== `ob_${openClientObInvoice.id}`));
                                              setClientPaymentOpts((prev) => {
                                                const next = { ...prev };
                                                delete next[`ob_${openClientObInvoice.id}`];
                                                return next;
                                              });
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`ref_ob_${openClientObInvoice.id}`} className="font-normal cursor-pointer text-sm leading-snug">
                                          Opening Balance{openClientObInvoice.invoice_number ? ` (Inv: ${openClientObInvoice.invoice_number})` : ""} - Outstanding: {formatCurrency(Number(openClientObInvoice.amount) || 0)}
                                        </Label>
                                      </div>

                                      {clientSelectedReferences.includes(`ob_${openClientObInvoice.id}`) && (
                                        <div className="flex items-center space-x-4 ml-6 mt-2 mb-4 p-2 bg-muted/30 rounded-md">
                                          <div className="flex items-center space-x-2">
                                            <Label htmlFor={`amt_ob_${openClientObInvoice.id}`} className="text-sm text-muted-foreground">Amount (₹):</Label>
                                            <Input
                                              id={`amt_ob_${openClientObInvoice.id}`}
                                              type="number"
                                              className="w-32 h-8"
                                              value={clientPaymentOpts[`ob_${openClientObInvoice.id}`]?.amount ?? ""}
                                              onChange={(e) => {
                                                setClientPaymentOpts(prev => ({
                                                  ...prev,
                                                  [`ob_${openClientObInvoice.id}`]: { ...prev[`ob_${openClientObInvoice.id}`], amount: Number(e.target.value) }
                                                }))
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
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
                          value={derivedClientAmount || ""}
                          onChange={(e) => {
                            if (clientPaymentType === "on_account") {
                              setClientAmount(Number(e.target.value));
                            }
                          }}
                          readOnly={clientPaymentType === "against_reference"}
                          className={clientPaymentType === "against_reference" ? "bg-muted cursor-not-allowed font-medium" : ""}
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
                        <TableHead>PO Number</TableHead>
                        <TableHead>Dispatch Qty</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Mode & Ref</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientUtclPayments.length > 0 ? (
                        clientUtclPayments.map((p: any) => {
                          let clientName = p.organizations?.legal_name || "Unknown Client";
                          let poNumber = p.purchase_orders?.po_number || (p.is_advance ? "Advance" : "On Account");

                          // Invoice numbers can come from explicit allocations,
                          // from the dispatch linked via utcl_payment_id, or from
                          // the one on payments.dispatch_request_id — which of
                          // these is populated depends on the RPC version, so
                          // gather all of them.
                          const linkedDrs = Array.isArray(p.dispatch_requests)
                            ? p.dispatch_requests
                            : p.dispatch_requests
                              ? [p.dispatch_requests]
                              : [];
                          const directDr = Array.isArray(p.direct_dispatch)
                            ? p.direct_dispatch[0]
                            : p.direct_dispatch;
                          const invNumbers = Array.from(
                            new Set(
                              [
                                ...(p.invoice_allocations || []).map(
                                  (ia: any) => ia.invoices?.invoice_number,
                                ),
                                ...linkedDrs.map((d: any) => d?.invoice_number),
                                directDr?.invoice_number,
                              ].filter(Boolean),
                            )
                          ) as string[];

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {new Date(p.payment_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-semibold">{clientName}</TableCell>
                              <TableCell className="font-mono text-xs">
                                <>
                                  {poNumber}
                                  {invNumbers.length > 0 && (
                                    <>
                                      <br />
                                      <span className="text-muted-foreground">Inv: {invNumbers.join(", ")}</span>
                                    </>
                                  )}
                                </>
                              </TableCell>
                              <TableCell>—</TableCell>
                              <TableCell className="text-success font-bold">
                                {formatCurrency(p.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{p.payment_mode}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.reference_number}
                                </div>
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
                            colSpan={7}
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

          {/* ═══ UTCL to Mundra Tab ═══ */}
          <TabsContent value="utcl-to-mundra" className="space-y-6">
            {/* Summary Cards */}
            {(() => {
              const totalLetters = utclRefundLetters?.length ?? 0;
              const paidCount = utclRefundLetters?.filter((l) => l.is_paid).length ?? 0;
              const unpaidCount = totalLetters - paidCount;
              const totalAmt = utclRefundLetters?.reduce((s, l) => s + Number(l.amount), 0) ?? 0;
              const paidAmt = utclRefundLetters?.filter((l) => l.is_paid).reduce((s, l) => s + Number(l.amount), 0) ?? 0;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Letters</CardTitle>
                      <FileText className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totalLetters}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
                      <IndianRupee className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAmt)}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{paidCount}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(paidAmt)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                      <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{unpaidCount}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(totalAmt - paidAmt)}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* Header + Add Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Refund Letters</h2>
                <p className="text-sm text-muted-foreground">
                  Track refund letter payments from UTCL to Mundra Brothers
                </p>
              </div>
              <Dialog open={utclMundraDialogOpen} onOpenChange={setUtclMundraDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" id="add-utcl-refund-letter-btn">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Refund Letter
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Refund Letter</DialogTitle>
                    <DialogDescription>
                      Record a new UTCL refund letter reference and amount.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="utcl-ref-number">Reference Number</Label>
                      <Select 
                        value={utclMundraRefNumber} 
                        onValueChange={setUtclMundraRefNumber}
                      >
                        <SelectTrigger id="utcl-ref-number">
                          <SelectValue placeholder="Select a reference number" />
                        </SelectTrigger>
                        <SelectContent>
                          {refundReferencesLoading ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                          ) : refundReferences && refundReferences.length > 0 ? (
                            refundReferences.map((ref: string) => (
                              <SelectItem key={ref} value={ref}>{ref}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>No reference numbers available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="utcl-ref-amount">Amount (₹)</Label>
                      <Input
                        id="utcl-ref-amount"
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={utclMundraAmount}
                        onChange={(e) => setUtclMundraAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setUtclMundraDialogOpen(false)}
                      disabled={addUtclRefundMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const trimmedRef = utclMundraRefNumber.trim();
                        const parsedAmount = parseFloat(utclMundraAmount);
                        if (!trimmedRef) { toast.error("Reference number is required"); return; }
                        if (isNaN(parsedAmount) || parsedAmount <= 0) { toast.error("Enter a valid amount greater than zero"); return; }
                        addUtclRefundMutation.mutate({ reference_number: trimmedRef, amount: parsedAmount });
                      }}
                      disabled={addUtclRefundMutation.isPending}
                      id="submit-utcl-refund-letter-btn"
                    >
                      {addUtclRefundMutation.isPending ? "Adding…" : "Add Letter"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {utclRefundLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : utclRefundLetters && utclRefundLetters.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[280px]">Reference Number</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                        <TableHead className="text-center">Paid</TableHead>
                        <TableHead>Paid At</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utclRefundLetters.map((letter) => (
                        <TableRow key={letter.id}>
                          <TableCell>
                            <span className="font-mono text-sm font-medium">
                              {letter.reference_number}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(Number(letter.amount))}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Checkbox
                                id={`utcl-paid-${letter.id}`}
                                checked={letter.is_paid}
                                disabled={toggleUtclPaidMutation.isPending}
                                onCheckedChange={(checked) => {
                                  toggleUtclPaidMutation.mutate({
                                    id: letter.id,
                                    is_paid: checked === true,
                                  });
                                }}
                              />
                              <Badge
                                variant={letter.is_paid ? "default" : "secondary"}
                                className={
                                  letter.is_paid
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15"
                                    : "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25 hover:bg-orange-500/15"
                                }
                              >
                                {letter.is_paid ? "Paid" : "Pending"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {letter.paid_at
                              ? new Date(letter.paid_at).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(letter.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-16 flex flex-col items-center text-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted grid place-items-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">No refund letters yet</p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Click "Add Refund Letter" to record the first UTCL refund letter reference.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
