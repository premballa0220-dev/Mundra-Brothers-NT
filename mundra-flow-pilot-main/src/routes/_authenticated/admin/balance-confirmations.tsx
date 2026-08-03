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
  const { data: eligibleAllocations } = useQuery({ queryKey: ["admin-refund-eligible-allocations"], queryFn: () => getRefundEligibleAllocations() });

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
    { id: crypto.randomUUID(), type1: "RTGS", date: "", amount: "", type2: "none" },
    { id: crypto.randomUUID(), type1: "TDS", date: "", amount: "", type2: "none" },
    { id: crypto.randomUUID(), type1: "ADVANCE", date: "", amount: "", type2: "none" },
    { id: crypto.randomUUID(), type1: "Credit Note", date: "", amount: "", type2: "none" },
  ]);

  const markRefundedMutation = useMutation({
    mutationFn: (paymentIds: string[]) => markPaymentsAsRefunded({ data: { paymentIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-refund-eligible-allocations"] });
      toast.success("Refund letter generated and recorded successfully");
      window.print();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record refund letter");
    }
  });

  const handleSaveAndPrint = () => {
    const paymentIds = invoices.map(inv => inv.paymentId).filter(Boolean);
    if (paymentIds.length === 0) {
      window.print();
      return;
    }
    markRefundedMutation.mutate(paymentIds);
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
    setPayments([...payments, { id: crypto.randomUUID(), type1: "none", date: "", amount: "", type2: "none" }]);
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

      // Auto-calculate remaining for main transfer mode (RTGS/NEFT/Cheque/Other)
      // Usually it's RTGS. Let's find the first one that is a standard transfer mode or just the first entry.
      const mainModes = ["RTGS", "NEFT", "Cheque", "Other"];
      const mainPayment = next.find(p => mainModes.includes(p.type1));
      
      if (mainPayment) {
        // Sum all other deduction amounts
        const otherTotal = next
          .filter(p => p.id !== mainPayment.id && p.type1 !== "none")
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        const remaining = currentTotal > 0 ? Math.max(0, currentTotal - otherTotal) : 0;
        const remainingStr = remaining > 0 ? remaining.toFixed(2) : "";
        
        if (mainPayment.amount !== remainingStr) {
          hasChanges = true;
          next = next.map(p => p.id === mainPayment.id ? { ...p, amount: remainingStr } : p);
        }
      }

      return hasChanges ? next : prev;
    });
  }, [totalAmountPaid, payments.map(p => `${p.id}-${p.type1}-${p.amount}`).join('|')]);

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
                            <Label className="text-xs">Invoice No. / Client Payment</Label>
                            {(() => {
                              const allocations = eligibleAllocations || [];
                              return (
                                <>
                                  {allocations.length > 0 && (
                                    <Select
                                      value={inv.allocationId || inv.invoiceNumber}
                                      onValueChange={(val) => {
                                        const alloc = allocations.find((a: any) => a.id === val);
                                        if (alloc) {
                                          const invoice = alloc.invoices;
                                          const payment = alloc.payments;
                                          const org = invoice.organizations;
                                          
                                          if (org) {
                                            setPartyName(org.trade_name || org.legal_name || "");
                                            setPartyCode(org.party_code || "");
                                            setTpcCode(org.tp_code || "");
                                          }

                                          setInvoices(invoices.map((i) => i.id === inv.id ? {
                                            ...i,
                                            allocationId: alloc.id,
                                            invoiceNumber: invoice.invoice_number,
                                            date: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString().split("T")[0] : "",
                                            amount: invoice.amount ? String(invoice.amount) : "",
                                            paymentDetails: payment.payment_mode || "none",
                                            dateOfPayment: payment.payment_date ? new Date(payment.payment_date).toISOString().split("T")[0] : "",
                                            amountPaid: alloc.allocated_amount ? String(alloc.allocated_amount) : "",
                                            paymentId: payment.id,
                                          } : i));
                                        } else {
                                          updateInvoice(inv.id, "invoiceNumber", val);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Select Invoice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {allocations.map((a: any) => (
                                          <SelectItem key={a.id} value={a.id}>
                                            {a.invoices.invoice_number} - {(a.invoices.organizations?.trade_name || a.invoices.organizations?.legal_name)} (Paid ₹{a.allocated_amount})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  <Input className={`h-8 text-sm ${allocations.length > 0 ? 'mt-2' : ''}`} value={inv.invoiceNumber} onChange={(e) => updateInvoice(inv.id, "invoiceNumber", e.target.value)} placeholder="Or type invoice no" />
                                </>
                              );
                            })()}
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
                            <Label className="text-xs">Type 2</Label>
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
