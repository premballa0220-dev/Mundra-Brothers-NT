import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminPaymentMonitoring, recordPaymentAdmin, editPayment } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertCircle, Plus, History, Search, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  ssr: false,
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [openPOId, setOpenPOId] = useState<string | null>(null);

  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("RTGS");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("RTGS");
  const [editReferenceNumber, setEditReferenceNumber] = useState("");

  const { data: pos, isLoading } = useQuery({
    queryKey: ["admin-payment-monitoring"],
    queryFn: () => getAdminPaymentMonitoring(),
  });

  const recordMutation = useMutation({
    mutationFn: (newPayment: any) => recordPaymentAdmin({ data: newPayment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Payment recorded successfully!");
      setOpenPOId(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record payment");
    },
  });

  function resetForm() {
    setAmount(0);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("RTGS");
    setReferenceNumber("");
  }

  const editMutation = useMutation({
    mutationFn: (data: any) => editPayment({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Payment updated successfully!");
      setEditOpen(false);
      setEditingPayment(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update payment");
    },
  });

  function handleEditOpen(payment: any) {
    setEditingPayment(payment);
    setEditAmount(payment.amount);
    setEditPaymentDate(new Date(payment.payment_date).toISOString().split("T")[0]);
    setEditPaymentMode(payment.payment_mode);
    setEditReferenceNumber(payment.reference_number || "");
    setEditOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;
    editMutation.mutate({
      id: editingPayment.id,
      amount: editAmount,
      paymentDate: editPaymentDate,
      paymentMode: editPaymentMode,
      referenceNumber: editReferenceNumber,
    });
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  function handleRecordPayment(po: any, e: React.FormEvent) {
    e.preventDefault();
    
    recordMutation.mutate({
      organizationId: po.organization_id,
      purchaseOrderId: po.id,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
    });
  }

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Payments & Dispatch Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Track Purchase Orders, dispatches against them, and record payments. If a client's credit limit is insufficient or 0, record advance payments here before dispatching.
          </p>
        </header>

        {/* Edit Payment Dialog */}
        <Dialog open={editOpen} onOpenChange={(isOpen) => {
          setEditOpen(isOpen);
          if (!isOpen) setEditingPayment(null);
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Payment Details</DialogTitle>
                <DialogDescription>
                  Update the transaction details for this payment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label>Amount Received (₹) *</Label>
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
                    <Select value={editPaymentMode} onValueChange={setEditPaymentMode} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RTGS">RTGS</SelectItem>
                        <SelectItem value="NEFT">NEFT</SelectItem>
                        <SelectItem value="IMPS">IMPS</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
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
              <DialogFooter>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (() => {
          const filteredPOs = pos?.filter((po: any) => {
            const search = searchQuery.toLowerCase();
            return (
              po.client_name.toLowerCase().includes(search) ||
              po.po_number.toLowerCase().includes(search) ||
              (po.organizations?.legal_name || "").toLowerCase().includes(search)
            );
          }) || [];

          return (
            <Card>
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold">Active Purchase Orders</CardTitle>
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search client or PO number..."
                    className="pl-8 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Client</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>PO Value</TableHead>
                    <TableHead>Dispatched Qty</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Remaining Balance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs && filteredPOs.length > 0 ? (
                    filteredPOs.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell>
                          <div className="font-semibold">{po.client_name}</div>
                          {po.wallet_balance > 0 && (
                            <div className="text-xs text-success font-medium mt-1">
                              Wallet: {formatCurrency(po.wallet_balance)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                        <TableCell>
                          <span className={po.credit_limit <= 0 ? "text-destructive font-semibold flex items-center gap-1" : "text-muted-foreground"}>
                            {po.credit_limit <= 0 && <AlertCircle className="h-3 w-3" />}
                            {formatCurrency(po.credit_limit)}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(po.total_value)}</TableCell>
                        <TableCell>{po.dispatched_quantity} MT</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-success font-bold">{formatCurrency(po.amount_paid)}</span>
                            {po.payments_history && po.payments_history.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3">
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm leading-none">Payment History</h4>
                                    <div className="text-sm text-muted-foreground max-h-[200px] overflow-y-auto space-y-2">
                                      {po.payments_history.map((ph: any) => (
                                        <div key={ph.id} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                          <div>
                                            <div className="font-medium text-foreground">{new Date(ph.payment_date).toLocaleDateString()}</div>
                                            <div className="text-xs">{ph.payment_mode} {ph.reference_number ? `(${ph.reference_number})` : ""}</div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="font-semibold text-success">{formatCurrency(ph.amount)}</div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditOpen(ph)}>
                                              <Edit className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={po.remaining_balance > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                          {formatCurrency(po.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={openPOId === po.id} onOpenChange={(isOpen) => {
                            if (!isOpen) { setOpenPOId(null); resetForm(); }
                            else { setOpenPOId(po.id); }
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Plus className="h-3 w-3 mr-1" /> Record Payment
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <form onSubmit={(e) => handleRecordPayment(po, e)}>
                                <DialogHeader>
                                  <DialogTitle>Record Payment for {po.client_name}</DialogTitle>
                                  <DialogDescription>
                                    Log an incoming bank transfer for PO: <strong className="font-mono">{po.po_number}</strong>. This PO has a remaining balance of <strong>{formatCurrency(po.remaining_balance)}</strong>.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="space-y-1">
                                    <Label>Amount Received (₹) *</Label>
                                    <Input
                                      type="number"
                                      value={amount || ""}
                                      onChange={(e) => setAmount(Number(e.target.value))}
                                      placeholder="0"
                                      required
                                    />
                                    {amount > po.remaining_balance && (
                                      <p className="text-xs text-warning flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Payment amount is greater than the remaining balance. The excess amount will be added to the client's wallet.
                                      </p>
                                    )}
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
                                          <SelectItem value="Cash">Cash</SelectItem>
                                          <SelectItem value="Cheque">Cheque</SelectItem>
                                          <SelectItem value="UPI">UPI</SelectItem>
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
                                    {recordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirm Payment
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        {searchQuery ? "No purchase orders found matching your search." : "No active purchase orders found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          );
        })()}
      </div>
    </AppShell>
  );
}
