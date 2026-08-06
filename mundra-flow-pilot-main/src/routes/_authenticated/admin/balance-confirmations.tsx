import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRefundEligibleAllocations, markPaymentsAsRefunded } from "@/lib/api/business.functions";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/admin/balance-confirmations")({
  ssr: false,
  component: RefundLetterPage,
});

function RefundLetterPage() {
  const queryClient = useQueryClient();
  const { data: queryData } = useQuery({ queryKey: ["admin-refund-eligible-allocations"], queryFn: () => getRefundEligibleAllocations() });
  const eligibleAllocations = queryData?.eligibleItems || [];
  const pendingInvoices = queryData?.pendingInvoices || [];

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState("Refund\\25-26\\0059");
  const [toName, setToName] = useState("M/s Ultratech Cement Ltd.");
  const [subject, setSubject] = useState("Finance Scheme Refund Claim");
  const [tpcCode, setTpcCode] = useState("630101M163");
  const [partyCode, setPartyCode] = useState("630101S9");
  const [partyName, setPartyName] = useState("DHARIWAL THIRANI CONSTRUCTIONS LLP");

  const [invoices, setInvoices] = useState<any[]>([
    {
      id: crypto.randomUUID(),
      date: "",
      invoiceNumber: "",
      amount: "",
      paymentDetails: "none",
      dateOfPayment: "",
      amountPaid: "",
      paymentId: "",
      allocationId: "",
    },
  ]);

  const [payments, setPayments] = useState<any[]>([
    { id: crypto.randomUUID(), type1: "RTGS", date: "", amount: "", type2: "none", dbPaymentId: "", invoiceId: "" },
    { id: crypto.randomUUID(), type1: "TDS", date: "", amount: "", type2: "none", dbPaymentId: "", invoiceId: "" },
    { id: crypto.randomUUID(), type1: "ADVANCE", date: "", amount: "", type2: "none", dbPaymentId: "", invoiceId: "" },
    { id: crypto.randomUUID(), type1: "Credit Note", date: "", amount: "", type2: "none", dbPaymentId: "", invoiceId: "" },
  ]);

  const markRefundedMutation = useMutation({
    mutationFn: (payload: any) => markPaymentsAsRefunded({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-refund-eligible-allocations"] });
      toast.success("Refund letter generated and recorded successfully");
      window.print();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record refund letter");
    }
  });

  const [pendingAllocations, setPendingAllocations] = useState<any[]>([]);

  const handleSaveAndPrint = () => {
    // pendingAllocations is computed by the FIFO effect
    const allocations = pendingAllocations.map(pa => ({
      paymentId: pa.paymentId,
      invoiceId: pa.invoiceId,
      amount: pa.amount,
      isNewAllocation: pa.isNewAllocation
    }));
      
    if (allocations.length === 0) {
      window.print();
      return;
    }
    markRefundedMutation.mutate({ allocations });
  };

  const addInvoice = () => {
    setInvoices([
      ...invoices,
      {
        id: crypto.randomUUID(),
        date: "",
        invoiceNumber: "",
        amount: "",
        paymentDetails: "none",
        dateOfPayment: "",
        amountPaid: "",
        paymentId: "",
        allocationId: "",
      },
    ]);
  };

  const removeInvoice = (id: string) => {
    setInvoices(invoices.filter((inv) => inv.id !== id));
  };

  const updateInvoice = (id: string, field: string, value: string) => {
    setInvoices(invoices.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const addPayment = () => {
    setPayments([...payments, { id: crypto.randomUUID(), type1: "none", date: "", amount: "", type2: "none", dbPaymentId: "", invoiceId: "" }]);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const updatePayment = (id: string, field: string, value: string) => {
    setPayments(
      payments.map((p) => {
        if (p.id === id) {
          const updated = { ...p, [field]: value };
          if (field === "type1" && value === "TDS") {
            const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
            updated.amount = (totalPaid * 0.008).toFixed(2);
          }
          return updated;
        }
        return p;
      })
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  };

  const formatAmount = (val: string) => {
    const num = Number(val);
    if (isNaN(num) || !val) return "";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const totalInvoiceAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [invoices]);

  const totalAmountPaid = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
  }, [invoices]);

  useEffect(() => {
    setPayments((prev) => {
      let next = [...prev];
      let hasChanges = false;
      const currentTotal = totalAmountPaid;

      // Auto-calculate TDS (0.8% of total)
      next = next.map(p => {
        if (p.type1 === "TDS") {
          const newAmount = currentTotal > 0 ? (currentTotal * 0.008).toFixed(2) : "";
          if (p.amount !== newAmount) {
            hasChanges = true;
            return { ...p, amount: newAmount };
          }
        }
        return p;
      });

      // Auto-calculate remaining for main transfer mode is disabled 
      // because in the new flow, payments dictate invoices, not the other way around.

      return hasChanges ? next : prev;
    });
  }, [totalAmountPaid, payments.map(p => `${p.id}-${p.type1}-${p.amount}`).join('|')]);

  // FIFO Auto-allocation Effect
  useEffect(() => {
    if (!eligibleAllocations.length) return;

    // We only process payments that have a dbPaymentId (meaning the user selected them from the dropdown)
    const activePayments = payments.filter(p => p.dbPaymentId && Number(p.amount) > 0);
    if (activePayments.length === 0) {
      setInvoices([]);
      setPartyName("");
      setPartyCode("");
      setTpcCode("");
      return;
    }

    const newInvoicesMap = new Map<string, any>();
    const newPendingAllocations: any[] = [];
    let unallocatedPayments: { id: string, remaining: number }[] = [];

    // The "Payment Details" column must always show the real Mundra-to-UTCL
    // mode (RTGS/NEFT/...), never ADVANCE or TDS, and "Date of Payment" is the
    // current payment's date — not the advance's. An advance is only ever
    // folded into the invoice's Amount Paid.
    const primaryPayments = activePayments.filter(
      (p) => p.type1 !== "ADVANCE" && p.type1 !== "TDS" && p.type1 !== "none",
    );
    const displayMode =
      Array.from(new Set(primaryPayments.map((p) => p.type1))).join(", ") || "RTGS";
    const displayPayDate =
      primaryPayments.find((p) => p.date)?.date || new Date().toISOString().split("T")[0];

    for (const ap of activePayments) {
      const dbPayment = eligibleAllocations.find((ea: any) => ea.payment_id === ap.dbPaymentId);
      if (!dbPayment) continue;
      
      const org = dbPayment.invoices?.organizations || dbPayment.payments?.organizations;
      if (org) {
        setPartyName(org.trade_name || org.legal_name || "");
        setPartyCode(org.party_code || "");
        setTpcCode(org.tp_code || "");
      }

      const allocationsForThisPayment = eligibleAllocations.filter((ea: any) => ea.payment_id === ap.dbPaymentId && ea.invoice_id);

      if (allocationsForThisPayment.length > 0) {
        let remainingToAllocate = Number(ap.amount);
        for (const alloc of allocationsForThisPayment) {
          if (remainingToAllocate <= 0) break;

          const invId = alloc.invoice_id;
          const invoiceTotal = Number(alloc.invoices.amount) || 0;

          if (!newInvoicesMap.has(invId)) {
            newInvoicesMap.set(invId, {
              id: crypto.randomUUID(),
              date: alloc.invoices.invoice_date ? new Date(alloc.invoices.invoice_date).toISOString().split("T")[0] : "",
              invoiceNumber: alloc.invoices.invoice_number,
              amount: invoiceTotal,
              paymentDetails: displayMode,
              dateOfPayment: displayPayDate,
              amountPaid: 0,
              paymentId: ap.dbPaymentId,
              invoiceId: invId
            });
          }

          // Amount Paid can never exceed the invoice value, even when a current
          // payment and an advance both land on the same invoice.
          const room = Math.max(0, invoiceTotal - newInvoicesMap.get(invId).amountPaid);
          const allocAmount = Math.min(Number(alloc.allocated_amount), remainingToAllocate, room);
          if (allocAmount <= 0) continue;

          remainingToAllocate -= allocAmount;
          newInvoicesMap.get(invId).amountPaid += allocAmount;

          newPendingAllocations.push({
            paymentId: ap.dbPaymentId,
            invoiceId: invId,
            amount: allocAmount,
            isNewAllocation: false // Already in DB
          });
        }
      } else {
        unallocatedPayments.push({ id: ap.dbPaymentId, remaining: Number(ap.amount) });
      }
    }

    if (unallocatedPayments.length > 0 && pendingInvoices.length > 0) {
      for (const pending of pendingInvoices) {
        if (unallocatedPayments.length === 0) break;
        let outstanding = Number(pending.outstanding_amount);
        if (outstanding <= 0) continue;

        const invoiceTotal = Number(pending.amount) || 0;

        while (outstanding > 0 && unallocatedPayments.length > 0) {
          const currentPay = unallocatedPayments[0];

          if (!newInvoicesMap.has(pending.id)) {
            newInvoicesMap.set(pending.id, {
              id: crypto.randomUUID(),
              date: pending.invoice_date ? new Date(pending.invoice_date).toISOString().split("T")[0] : "",
              invoiceNumber: pending.invoice_number,
              amount: invoiceTotal,
              paymentDetails: displayMode,
              dateOfPayment: displayPayDate,
              amountPaid: 0,
              paymentId: "",
              invoiceId: pending.id
            });
          }

          // Never let Amount Paid exceed the invoice value.
          const room = Math.max(0, invoiceTotal - newInvoicesMap.get(pending.id).amountPaid);
          const allocateAmt = Math.min(currentPay.remaining, outstanding, room);
          if (allocateAmt <= 0) break;

          currentPay.remaining -= allocateAmt;
          outstanding -= allocateAmt;
          newInvoicesMap.get(pending.id).amountPaid += allocateAmt;

          newPendingAllocations.push({
            paymentId: currentPay.id,
            invoiceId: pending.id,
            amount: allocateAmt,
            isNewAllocation: true
          });

          if (currentPay.remaining <= 0) {
            unallocatedPayments.shift(); // Remove depleted payment
          }
        }
      }
      
      // If there's still unallocated amounts but no invoices left, just save them as unallocated
      for (const unalloc of unallocatedPayments) {
        if (unalloc.remaining > 0) {
          newPendingAllocations.push({
            paymentId: unalloc.id,
            invoiceId: null,
            amount: unalloc.remaining,
            isNewAllocation: false
          });
        }
      }
    } else if (unallocatedPayments.length > 0) {
      for (const unalloc of unallocatedPayments) {
        newPendingAllocations.push({
          paymentId: unalloc.id,
          invoiceId: null,
          amount: unalloc.remaining,
          isNewAllocation: false
        });
      }
    }

    setPendingAllocations(newPendingAllocations);
    
    setInvoices(Array.from(newInvoicesMap.values()).map(inv => ({
      ...inv,
      amount: String(inv.amount),
      amountPaid: String(inv.amountPaid)
    })));

  }, [payments.map(p => `${p.dbPaymentId}-${p.amount}`).join('|'), eligibleAllocations, pendingInvoices]);

  const totalPaymentAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const paymentTypes = ["RTGS", "TDS", "ADVANCE", "Credit Note", "Debit Note", "NEFT", "Cheque", "Other"];

  return (
    <AppShell variant="admin">
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
        <header className="mb-6 print:hidden shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Refund Letters</h1>
              <p className="text-sm text-muted-foreground">
                Generate a Finance Scheme Refund Claim
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Only
              </Button>
              <Button 
                onClick={handleSaveAndPrint} 
                disabled={markRefundedMutation.isPending}
                className="gap-2"
              >
                {markRefundedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & Print
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-h-0 overflow-hidden">
          {/* Form Section */}
          <div className="lg:col-span-4 h-full overflow-hidden flex flex-col space-y-4 print:hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-8">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">General Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Reference No.</Label>
                        <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg">Invoices</CardTitle>
                    <Button variant="outline" size="sm" onClick={addInvoice} className="h-8 gap-1">
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {invoices.map((inv, index) => (
                      <div key={inv.id} className="relative border rounded-md p-3 space-y-3 bg-slate-50/50">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeInvoice(inv.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Invoice {index + 1}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" className="h-8 text-sm" value={inv.date} onChange={(e) => updateInvoice(inv.id, "date", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Invoice No.</Label>
                            <Input className="h-8 text-sm" value={inv.invoiceNumber} onChange={(e) => updateInvoice(inv.id, "invoiceNumber", e.target.value)} placeholder="Type invoice no" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Amount</Label>
                            <Input type="number" className="h-8 text-sm" value={inv.amount} onChange={(e) => updateInvoice(inv.id, "amount", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Payment Details</Label>
                            <Select value={inv.paymentDetails} onValueChange={(val) => updateInvoice(inv.id, "paymentDetails", val)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentTypes.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Date of Payment</Label>
                            <Input type="date" className="h-8 text-sm" value={inv.dateOfPayment} onChange={(e) => updateInvoice(inv.id, "dateOfPayment", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Amount Paid</Label>
                            <Input type="number" className="h-8 text-sm" value={inv.amountPaid} onChange={(e) => updateInvoice(inv.id, "amountPaid", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg">Payment Details</CardTitle>
                    <Button variant="outline" size="sm" onClick={addPayment} className="h-8 gap-1">
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* The printed letter shows one figure for the main table
                        subtotal, the party total and the refund box. Warn here
                        (on screen only) if the rows below don't add up to it. */}
                    {Math.abs(totalPaymentAmount - totalAmountPaid) > 0.01 && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                        <span className="font-semibold">Totals don't match.</span> These payment rows
                        add up to {formatAmount(String(totalPaymentAmount))}, but the invoice table
                        shows {formatAmount(String(totalAmountPaid))}. The letter will print{" "}
                        {formatAmount(String(totalAmountPaid))} — adjust the rows so they agree.
                      </div>
                    )}
                    {payments.map((p, index) => (
                      <div key={p.id} className="relative border rounded-md p-3 space-y-3 bg-slate-50/50">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removePayment(p.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Type 1</Label>
                            <Select value={p.type1} onValueChange={(val) => updatePayment(p.id, "type1", val)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {paymentTypes.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" className="h-8 text-sm" value={p.date} onChange={(e) => updatePayment(p.id, "date", e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Amount</Label>
                            <Input type="number" className="h-8 text-sm" value={p.amount} onChange={(e) => updatePayment(p.id, "amount", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Client Payment Reference</Label>
                            {(() => {
                              // Deduplicate by payment_id
                              const uniquePayments = Array.from(new Map(eligibleAllocations.map((ea: any) => [ea.payment_id, ea])).values());

                              // A payment can cover several invoices, so gather
                              // every invoice number behind each payment for the
                              // dropdown label.
                              const invoiceNumbersByPayment = new Map<string, string[]>();
                              for (const ea of eligibleAllocations as any[]) {
                                const num = ea.invoices?.invoice_number;
                                if (!num) continue;
                                const list = invoiceNumbersByPayment.get(ea.payment_id) || [];
                                if (!list.includes(num)) list.push(num);
                                invoiceNumbersByPayment.set(ea.payment_id, list);
                              }
                              
                              return (
                                <Select 
                                  value={p.dbPaymentId || "none"} 
                                  onValueChange={(val) => {
                                    if (val === "none") {
                                      updatePayment(p.id, "dbPaymentId", "");
                                      return;
                                    }
                                    const selected = uniquePayments.find((ea: any) => ea.payment_id === val);
                                    if (selected) {
                                      setPayments(payments.map(px => {
                                        if (px.id === p.id) {
                                          return {
                                            ...px,
                                            dbPaymentId: selected.payment_id,
                                            date: selected.payments.payment_date ? new Date(selected.payments.payment_date).toISOString().split("T")[0] : "",
                                            amount: String(selected.payments.remaining_amount || selected.payments.amount),
                                          };
                                        }
                                        return px;
                                      }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select Payment" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Manual Entry</SelectItem>
                                    {uniquePayments.filter((ea: any) => {
                                      if (p.type1 === "ADVANCE") return ea.payments.is_advance;
                                      return !ea.payments.is_advance; // RTGS/NEFT/etc. should filter out advances
                                    }).map((ea: any) => {
                                      const invNums = invoiceNumbersByPayment.get(ea.payment_id) || [];
                                      const invLabel =
                                        invNums.length > 0 ? invNums.join(", ") : "Unlinked";
                                      return (
                                        <SelectItem key={ea.payment_id} value={ea.payment_id}>
                                          {ea.payments.payment_mode} — ₹
                                          {ea.payments.remaining_amount || ea.payments.amount} ·{" "}
                                          {ea.invoices?.organizations?.trade_name || "Unknown client"} ·
                                          Inv: {invLabel}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">With SRK (Type 2)</Label>
                            <Select value={p.type2} onValueChange={(val) => updatePayment(p.id, "type2", val)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {paymentTypes.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>

          {/* Print Layout Section */}
          <div className="lg:col-span-8 h-full print:col-span-12 overflow-auto print:overflow-visible">
            <div className="bg-white text-black font-sans text-[13px] leading-tight w-full max-w-[900px] mx-auto border shadow-sm print:shadow-none print:border-none p-8 print:p-0">
              
              {/* Top Header Table */}
              <table className="w-full border-collapse border border-black mb-4">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-[150px] text-center align-middle">
                      <img 
                        src="/logo.png" 
                        alt="Mundra Brothers Logo" 
                        className="w-24 h-auto mx-auto object-contain" 
                      />
                    </td>
                    <td className="border border-black p-2 align-middle text-center" colSpan={3}>
                      <h1 className="text-4xl font-normal text-red-600 m-0">Mundra Brothers</h1>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 align-top" colSpan={2} rowSpan={2}>
                      <div className="whitespace-pre-wrap">501, Sunil Enclave, Plot No.<br/>307, Pareira Hill Road, Opp<br/>Gurunanak Petrol Pump,<br/>Andheri East (E)<br/><br/>Mumbai - 400099<br/>Mobile - 9702367111<br/><span className="text-red-600 underline">sanjay.mundra@lnsmundra.com</span></div>
                    </td>
                    <td className="border border-black p-2 align-middle font-bold w-[120px]">
                      Reference<br/>Number
                    </td>
                    <td className="border border-black p-2 align-middle text-center">
                      {refNo}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Detail Rows */}
              <table className="w-full border-collapse border border-black mb-4">
                <tbody>
                  <tr>
                    <td className="border border-black p-1.5 font-bold w-[150px] bg-[#fdfdfd]">Date</td>
                    <td className="border border-black p-1.5 text-center">{formatDate(date)}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 font-bold bg-[#fdfdfd]">Name</td>
                    <td className="border border-black p-1.5">{toName}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 font-bold bg-[#fdfdfd]">Subject</td>
                    <td className="border border-black p-1.5">{subject}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fdfdfd]" colSpan={2}>
                      Dear Sir,<br/><br/>
                      We have made payment on behalf of direct parties and now we have collected payment from<br/>
                      Customer as per details given below .Hence we request you to refund our payments
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TPC & Party Code Table */}
              <table className="w-full border-collapse border border-black mb-4 text-white">
                <tbody>
                  <tr>
                    <td className="border border-black p-1.5 font-bold w-[150px] bg-[#a85a49]">TPC Code</td>
                    <td className="border border-black p-1.5 font-bold w-[150px] bg-[#a85a49]">{tpcCode}</td>
                    <td className="border border-black w-8 bg-white text-black"></td>
                    <td className="border border-black p-1.5 font-bold w-[150px] bg-[#a85a49]">TPC Name</td>
                    <td className="border border-black p-1.5 font-bold text-center bg-[#a85a49]">Mundra Brothers</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 font-bold bg-[#a85a49]">Party Code</td>
                    <td className="border border-black p-1.5 font-bold bg-[#a85a49]">{partyCode}</td>
                    <td className="border border-black bg-white text-black"></td>
                    <td className="border border-black p-1.5 font-bold bg-[#a85a49]">Party Name</td>
                    <td className="border border-black p-1.5 text-center bg-[#a85a49]">{partyName}</td>
                  </tr>
                </tbody>
              </table>

              {/* Invoices Table */}
              <table className="w-full border-collapse border border-black mb-4">
                <thead>
                  <tr className="bg-[#e74c3c] text-white">
                    <td className="border border-black p-1.5 font-bold text-center">Date</td>
                    <td className="border border-black p-1.5 font-bold text-center">Invoice Number</td>
                    <td className="border border-black p-1.5 font-bold text-center">Amount</td>
                    <td className="border border-black p-1.5 font-bold text-center">Payment<br/>Details</td>
                    <td className="border border-black p-1.5 font-bold text-center">Date of<br/>Payment</td>
                    <td className="border border-black p-1.5 font-bold text-center">Amount Paid</td>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id} className={i % 2 === 0 ? "bg-[#f5eeed]" : "bg-white"}>
                      <td className="border border-black p-1.5 text-center">{formatDate(inv.date)}</td>
                      <td className="border border-black p-1.5 text-center">{inv.invoiceNumber}</td>
                      <td className="border border-black p-1.5 text-right">{formatAmount(inv.amount)}</td>
                      <td className="border border-black p-1.5 text-center">{inv.paymentDetails === "none" ? "" : inv.paymentDetails}</td>
                      <td className="border border-black p-1.5 text-center">{formatDate(inv.dateOfPayment)}</td>
                      <td className="border border-black p-1.5 text-right">{formatAmount(inv.amountPaid)}</td>
                    </tr>
                  ))}
                  {/* Empty rows to mimic the screenshot's empty cells */}
                  {[...Array(Math.max(0, 5 - invoices.length))].map((_, i) => (
                    <tr key={`empty-${i}`} className={(invoices.length + i) % 2 === 0 ? "bg-[#e5ddd3]" : "bg-[#fdf4e8]"}>
                      <td className="border border-black p-1.5 h-6"></td>
                      <td className="border border-black p-1.5"></td>
                      <td className="border border-black p-1.5"></td>
                      <td className="border border-black p-1.5"></td>
                      <td className="border border-black p-1.5"></td>
                      <td className="border border-black p-1.5"></td>
                    </tr>
                  ))}
                  <tr className="bg-[#dfd3c3]">
                    <td className="border border-black p-1.5" colSpan={2}>Subtotal</td>
                    <td className="border border-black p-1.5 text-right font-bold">{formatAmount(totalInvoiceAmount.toString())}</td>
                    <td className="border border-black p-1.5" colSpan={2}></td>
                    <td className="border border-black p-1.5 text-right font-bold">{formatAmount(totalAmountPaid.toString())}</td>
                  </tr>
                </tbody>
              </table>

              {/* Payment Details Table */}
              <table className="w-full border-collapse border border-black mb-4">
                <thead>
                  <tr className="bg-[#dfd3c3]">
                    <td className="border border-black p-1.5 font-bold text-center" colSpan={4}>Party Payment Details</td>
                  </tr>
                  <tr className="bg-[#dfd3c3]">
                    <td className="border border-black p-1.5 text-center w-1/4">RTGS</td>
                    <td className="border border-black p-1.5 text-center w-1/4">Date</td>
                    <td className="border border-black p-1.5 text-center w-1/4">Amount</td>
                    <td className="border border-black p-1.5 text-center w-1/4">With SRK</td>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="bg-white">
                      <td className="border border-black p-1.5 text-right">{p.type1 === "none" ? "" : p.type1}</td>
                      <td className="border border-black p-1.5 text-center">{formatDate(p.date)}</td>
                      <td className="border border-black p-1.5 text-right">{formatAmount(p.amount)}</td>
                      <td className="border border-black p-1.5 text-right pr-4">{p.type2 === "none" ? "" : p.type2}</td>
                    </tr>
                  ))}
                  <tr className="bg-white">
                    <td className="border border-black p-1.5" colSpan={2}></td>
                    <td className="border border-black p-1.5 text-right font-bold">{formatAmount(totalAmountPaid.toString())}</td>
                    <td className="border border-black p-1.5"></td>
                  </tr>
                </tbody>
              </table>

              {/* Footer Box */}
              <div className="w-[300px] border-2 border-black bg-[#f4ebb1] p-3 text-center mb-8">
                <p className="mb-2 text-[14px]">Kindly refund the amount<br/>mentioned below</p>
                <p className="font-bold text-[15px] mb-3">{formatAmount(totalAmountPaid.toString())}</p>
                <p className="font-bold text-[14px]">Happy doing business with<br/>you!</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
