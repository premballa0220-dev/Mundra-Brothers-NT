import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPayments, getInvoices, submitPayment, editPayment } from "@/lib/api/business.functions";
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
import { CreditCard, Plus, Loader2, Link as LinkIcon, AlertCircle, Edit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/payments")({
  ssr: false,
  component: ClientPaymentsPage,
});

function ClientPaymentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  // Form states
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("RTGS");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  // Track allocations: key = invoiceId, value = { allocatedAmount, tdsAmount }
  const [allocations, setAllocations] = useState<
    Record<string, { allocatedAmount: number; tdsAmount: number }>
  >({});

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["client-payments"],
    queryFn: () => getPayments(),
  });

  const { data: invoices } = useQuery({
    queryKey: ["client-invoices"],
    queryFn: () => getInvoices(),
  });

  const unpaidInvoices = invoices?.filter((inv: any) => inv.status !== "paid") ?? [];

  const createMutation = useMutation({
    mutationFn: (newPayment: any) => submitPayment({ data: newPayment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments"] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
      toast.success("Payment update submitted successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to submit payment update");
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => editPayment({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments"] });
      toast.success("Payment updated successfully!");
      setEditOpen(false);
      setEditingPayment(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update payment");
    },
  });

  function resetForm() {
    setAmount(0);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("RTGS");
    setReferenceNumber("");
    setBankName("");
    setProofUrl("");
    setAllocations({});
  }

  // Calculated unallocated amount
  const totalAllocated = Object.values(allocations).reduce(
    (sum, val) => sum + val.allocatedAmount,
    0
  );
  const unallocatedAmount = amount - totalAllocated;

  function handleAllocationChange(invoiceId: string, field: "allocatedAmount" | "tdsAmount", value: number) {
    setAllocations((prev) => {
      const current = prev[invoiceId] || { allocatedAmount: 0, tdsAmount: 0 };
      const updated = { ...current, [field]: value };
      return { ...prev, [invoiceId]: updated };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unallocatedAmount < 0) {
      toast.error("Allocation total cannot exceed the payment amount!");
      return;
    }

    const formattedAllocations = Object.entries(allocations)
      .map(([invoiceId, val]) => ({
        invoiceId,
        allocatedAmount: val.allocatedAmount,
        tdsAmount: val.tdsAmount,
      }))
      .filter((alloc) => alloc.allocatedAmount > 0 || alloc.tdsAmount > 0);

    createMutation.mutate({
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      bankName,
      proofUrl: proofUrl || "https://example.com/demo-receipt.pdf", // Mock link
      allocations: formattedAllocations,
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  function handleEditOpen(payment: any) {
    setEditingPayment(payment);
    setAmount(payment.amount);
    setPaymentDate(new Date(payment.payment_date).toISOString().split("T")[0]);
    setPaymentMode(payment.payment_mode);
    setReferenceNumber(payment.reference_number);
    setBankName(payment.bank_name || "");
    setProofUrl(payment.proof_url || "");
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;
    editMutation.mutate({
      id: editingPayment.id,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      bankName,
      proofUrl: proofUrl || "https://example.com/demo-receipt.pdf",
    });
  }

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Report Payments</h1>
            <p className="text-sm text-muted-foreground">
              Report bank transfer payments (RTGS/NEFT/IMPS), allocate against outstanding invoices, and submit TDS proof.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Report Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Report Bank Transfer Payment</DialogTitle>
                  <DialogDescription>
                    Provide UTR transaction details and allocate funds to specific outstanding invoices.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="amount">Payment Amount (₹) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="date">Payment Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="mode">Payment Mode *</Label>
                      <Input
                        id="mode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        placeholder="RTGS / NEFT"
                        required
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="ref">Reference / UTR Number *</Label>
                      <Input
                        id="ref"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Unique UTR receipt code"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="bank">Remitting Bank Name</Label>
                      <Input
                        id="bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="proof">Proof receipt link</Label>
                      <Input
                        id="proof"
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                        placeholder="Paste URL or link"
                      />
                    </div>
                  </div>

                  <hr className="my-2 border-border" />

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-base font-semibold">Allocate Against Outstanding Invoices</Label>
                      <span className={`text-xs font-bold ${unallocatedAmount < 0 ? "text-destructive" : "text-success"}`}>
                        Unallocated On Account: {formatCurrency(unallocatedAmount)}
                      </span>
                    </div>

                    {unpaidInvoices.length > 0 ? (
                      <div className="border rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead>Invoice No</TableHead>
                              <TableHead>Inv Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Allocate (₹)</TableHead>
                              <TableHead>TDS (₹)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unpaidInvoices.map((inv: any) => {
                              const alloc = allocations[inv.id] || { allocatedAmount: 0, tdsAmount: 0 };
                              return (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-semibold text-xs">{inv.invoice_number}</TableCell>
                                  <TableCell className="text-xs">{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                                  <TableCell className="font-bold text-xs">{formatCurrency(inv.amount)}</TableCell>
                                  <TableCell className="p-1">
                                    <Input
                                      type="number"
                                      className="h-7 text-xs w-28"
                                      value={alloc.allocatedAmount || ""}
                                      placeholder="0"
                                      onChange={(e) => handleAllocationChange(inv.id, "allocatedAmount", Number(e.target.value))}
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Input
                                      type="number"
                                      className="h-7 text-xs w-24"
                                      value={alloc.tdsAmount || ""}
                                      placeholder="0"
                                      onChange={(e) => handleAllocationChange(inv.id, "tdsAmount", Number(e.target.value))}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/40 text-center rounded border border-dashed text-xs text-muted-foreground">
                        No outstanding unpaid invoices found. This payment will default entirely "On Account".
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || unallocatedAmount < 0}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Payment
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Payment Dialog */}
          <Dialog open={editOpen} onOpenChange={(isOpen) => {
            setEditOpen(isOpen);
            if (!isOpen) {
              setEditingPayment(null);
              resetForm();
            }
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleEditSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Payment Details</DialogTitle>
                  <DialogDescription>
                    Update the UTR or other details of this payment.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-amount">Payment Amount (₹) *</Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-date">Payment Date *</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-mode">Mode *</Label>
                      <Input
                        id="edit-mode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="edit-ref">Reference / UTR Number *</Label>
                      <Input
                        id="edit-ref"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-bank">Bank Name</Label>
                      <Input
                        id="edit-bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-proof">Proof URL</Label>
                      <Input
                        id="edit-proof"
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={editMutation.isPending}>
                    {editMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {paymentsLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>UTR / Reference No</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verification Link</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments && payments.length > 0 ? (
                    payments.map((pm: any) => (
                      <TableRow key={pm.id}>
                        <TableCell>{new Date(pm.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold">{pm.reference_number}</TableCell>
                        <TableCell>{pm.payment_mode}</TableCell>
                        <TableCell>{pm.bank_name ?? "—"}</TableCell>
                        <TableCell className="font-bold text-success">{formatCurrency(pm.amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              pm.status === "approved"
                                  ? "default"
                                  : pm.status === "submitted" || pm.status === "under_verification"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="capitalize"
                          >
                            {pm.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pm.proof_url ? (
                            <a
                              href={pm.proof_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              <LinkIcon className="h-3 w-3" /> View Receipt
                            </a>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditOpen(pm)}>
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No payments reported yet. Click "Report Payment" to upload transfer details.
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
