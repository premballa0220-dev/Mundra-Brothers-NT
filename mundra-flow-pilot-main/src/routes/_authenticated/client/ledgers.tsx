import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBalanceConfirmations,
  uploadBalanceConfirmation,
  getInvoices,
  getClientStatement,
  getInterestSummary
} from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import React, { useState } from "react";
import { toast } from "sonner";
import { FileSignature, UploadCloud, AlertCircle, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/ledgers")({
  ssr: false,
  component: ClientLedgersPage,
});

function ClientLedgersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedConfId, setSelectedConfId] = useState("");
  const [signedPdfUrl, setSignedPdfUrl] = useState("");

  const [expandedStatementIds, setExpandedStatementIds] = useState<Record<string, boolean>>({});
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  const toggleStatementExpanded = (id: string) => {
    setExpandedStatementIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleInvoiceExpanded = (id: string) => {
    setExpandedInvoiceIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { data: confirmations, isLoading: confsLoading } = useQuery({
    queryKey: ["client-confirmations"],
    queryFn: () => getBalanceConfirmations(),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-invoices"],
    queryFn: () => getInvoices(),
  });

  const [statementStart, setStatementStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // default to last 1 month for demo
    return d.toISOString().split("T")[0];
  });
  
  const [statementEnd, setStatementEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { data: statementData, isLoading: statementLoading } = useQuery({
    queryKey: ["client-statement", statementStart, statementEnd],
    queryFn: () => getClientStatement({ data: { startDate: statementStart, endDate: statementEnd } }),
  });

  const { data: interestSummary, isLoading: interestLoading } = useQuery({
    queryKey: ["client-interest-summary"],
    queryFn: () => getInterestSummary(),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { id: string; signedPdfUrl: string }) => uploadBalanceConfirmation({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-confirmations"] });
      toast.success("Signed balance confirmation uploaded for audit verification!");
      setOpen(false);
      setSignedPdfUrl("");
      setSelectedConfId("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to upload confirmation");
    },
  });

  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConfId) return;
    uploadMutation.mutate({
      id: selectedConfId,
      signedPdfUrl: signedPdfUrl || "https://example.com/demo-signed-conf.pdf", // Mock link
    });
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0 || isNaN(amount)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const pendingConfirmation = confirmations?.find(
    (c: any) => c.status === "pending_upload" || c.status === "rejected",
  );

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Ledgers & Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Monitor outstanding invoices, track quarterly statements, and upload signed balance
            confirmation audits.
          </p>
        </header>

        {pendingConfirmation && (
          <Alert variant="default" className="border-warning/50 bg-warning/5">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold">
              Action Required: Quarterly Statement Pending
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p className="text-sm">
                Your statement for quarter ending{" "}
                <span className="font-bold">
                  {new Date(pendingConfirmation.quarter_end_date).toLocaleDateString()}
                </span>{" "}
                must be signed and returned by{" "}
                <span className="font-bold">
                  {new Date(pendingConfirmation.due_date).toLocaleDateString()}
                </span>
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Critical: Material dispatch will be automatically suspended if unsubmitted past the
                block date:{" "}
                <span className="font-bold text-destructive">
                  {new Date(pendingConfirmation.block_date).toLocaleDateString()}
                </span>
                .
              </p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSelectedConfId(pendingConfirmation.id);
                      setOpen(true);
                    }}
                  >
                    <UploadCloud className="h-4 w-4 mr-2" /> Upload Signed Confirmation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleUploadSubmit}>
                    <DialogHeader>
                      <DialogTitle>Upload Signed Confirmation</DialogTitle>
                      <DialogDescription>
                        Attach the signed and stamped balance confirmation document.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-1">
                        <Label htmlFor="pdfUrl">Signed PDF URL *</Label>
                        <Input
                          id="pdfUrl"
                          value={signedPdfUrl}
                          onChange={(e) => setSignedPdfUrl(e.target.value)}
                          placeholder="Paste document link or URL"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={uploadMutation.isPending}>
                        {uploadMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Confirm Upload
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Balance Confirmation Status</CardTitle>
              <CardDescription>Statements assigned for verification.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations && confirmations.length > 0 ? (
                    confirmations.map((conf: any) => (
                      <TableRow key={conf.id}>
                        <TableCell className="font-semibold text-xs">
                          {new Date(conf.quarter_end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              conf.status === "approved"
                                ? "default"
                                : conf.status === "under_review" || conf.status === "pending_upload"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="capitalize"
                          >
                            {conf.status === "pending_upload" ? "Pending Upload" : conf.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {conf.source_pdf_url && (
                            <a
                              href={conf.source_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              <FileText className="h-3 w-3" /> Source
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-6 text-muted-foreground text-xs"
                      >
                        No confirmations requested.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <Tabs defaultValue="statement" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="statement">Statement of Account</TabsTrigger>
                  <TabsTrigger value="outstanding">Outstanding Invoices</TabsTrigger>
                  <TabsTrigger value="interest">Interest Summary</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="statement">
                <Card>
                  <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Statement of Account</CardTitle>
                      <CardDescription>Chronological ledger of your account balance.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="h-8 w-36 text-xs"
                        value={statementStart}
                        onChange={(e) => setStatementStart(e.target.value)}
                      />
                      <span className="text-muted-foreground text-xs">to</span>
                      <Input
                        type="date"
                        className="h-8 w-36 text-xs"
                        value={statementEnd}
                        onChange={(e) => setStatementEnd(e.target.value)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {statementLoading ? (
                      <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Particulars</TableHead>
                            <TableHead>Ref No.</TableHead>
                            <TableHead className="text-right text-destructive">Debit (₹)</TableHead>
                            <TableHead className="text-right text-success">Credit (₹)</TableHead>
                            <TableHead className="text-right font-bold">Balance (₹)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={5} className="font-semibold text-right">
                              Opening Balance as of {new Date(statementStart).toLocaleDateString()}:
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">
                              {formatCurrency(statementData?.historicalBalance || 0)}
                            </TableCell>
                          </TableRow>
                          
                          {statementData?.statement && statementData.statement.length > 0 ? (
                            statementData.statement.map((entry: any) => (
                              <React.Fragment key={entry.id}>
                                <TableRow>
                                  <TableCell className="text-xs">
                                    {new Date(entry.date).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-2">
                                      {entry.particulars}
                                      {entry.type === "opening_balance" && entry.meta?.historical_invoices && entry.meta.historical_invoices.length > 0 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 ml-1"
                                          onClick={() => toggleStatementExpanded(entry.id)}
                                        >
                                          {expandedStatementIds[entry.id] ? (
                                            <ChevronUp className="h-3 w-3" />
                                          ) : (
                                            <ChevronDown className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{entry.reference}</TableCell>
                                  <TableCell className="text-right text-xs text-destructive">
                                    {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-success">
                                    {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-xs font-semibold">
                                    {formatCurrency(entry.runningBalance)}
                                  </TableCell>
                                </TableRow>
                                {expandedStatementIds[entry.id] && entry.meta?.historical_invoices && entry.meta.historical_invoices.length > 0 && (
                                  <TableRow className="bg-muted/10">
                                    <TableCell colSpan={6} className="p-0">
                                      <div className="p-4 pl-12 border-l-2 border-primary/50">
                                        <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Historical Invoices Breakdown</h5>
                                        <Table className="w-auto border bg-background rounded-md">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="h-8">Invoice / Ref No</TableHead>
                                              <TableHead className="h-8">Date</TableHead>
                                              <TableHead className="h-8 text-right">Amount</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {entry.meta.historical_invoices.map((hInv: any, i: number) => (
                                              <TableRow key={i}>
                                                <TableCell className="py-2 font-mono text-xs">
                                                  {hInv.invoiceNumber || hInv.invoiceNo || (hInv.type === "debit_note" ? "Debit Note" : hInv.type === "CR" ? "Credit" : "—")}
                                                  {hInv.type === "CR" && <span className="ml-1 text-[10px] text-rose-600 font-semibold">(Cr)</span>}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs">{hInv.date || (hInv.fromDate && hInv.toDate ? `${hInv.fromDate} - ${hInv.toDate}` : "—")}</TableCell>
                                                <TableCell className="py-2 text-xs text-right font-semibold">{formatCurrency(Number(hInv.amount))}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                                No transactions found in this period.
                              </TableCell>
                            </TableRow>
                          )}

                          <TableRow className="bg-muted/50 border-t-2">
                            <TableCell colSpan={5} className="font-bold text-right text-sm">
                              Closing Balance as of {new Date(statementEnd).toLocaleDateString()}:
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm text-primary">
                              {formatCurrency(statementData?.closingBalance || 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="outstanding">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Outstanding Invoices Ledger</CardTitle>
                    <CardDescription>Open items pending payment.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Invoice Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices && invoices.length > 0 ? (
                          invoices.map((inv: any) => (
                            <React.Fragment key={inv.id}>
                              <TableRow>
                                <TableCell className="font-mono text-xs font-semibold">
                                  {inv.is_opening_balance ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-primary italic">Opening Balance</span>
                                      {inv.historical_invoices && inv.historical_invoices.length > 0 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 ml-1"
                                          onClick={() => toggleInvoiceExpanded(inv.id)}
                                        >
                                          {expandedInvoiceIds[inv.id] ? (
                                            <ChevronUp className="h-3 w-3" />
                                          ) : (
                                            <ChevronDown className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    inv.invoice_number
                                  )}
                                </TableCell>
                                <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-bold text-success">
                                  {formatCurrency(inv.amount)}
                                </TableCell>
                                <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      inv.status === "paid"
                                        ? "default"
                                        : inv.status === "partially_paid"
                                          ? "secondary"
                                          : "destructive"
                                    }
                                    className="capitalize"
                                  >
                                    {inv.status === "partially_paid" ? "Partially Paid" : inv.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                              {expandedInvoiceIds[inv.id] && inv.historical_invoices && inv.historical_invoices.length > 0 && (
                                <TableRow className="bg-muted/10">
                                  <TableCell colSpan={5} className="p-0">
                                    <div className="p-4 pl-12 border-l-2 border-primary/50">
                                      <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Historical Invoices Breakdown</h5>
                                      <Table className="w-auto border bg-background rounded-md">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="h-8">Invoice No</TableHead>
                                            <TableHead className="h-8">Date</TableHead>
                                            <TableHead className="h-8 text-right">Amount</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {inv.historical_invoices.map((hInv: any, i: number) => (
                                            <TableRow key={i}>
                                              <TableCell className="py-2 font-mono text-xs">{hInv.invoiceNumber || (hInv.type === "debit_note" ? "Debit Note" : "—")}</TableCell>
                                              <TableCell className="py-2 text-xs">{hInv.date || (hInv.fromDate && hInv.toDate ? `${hInv.fromDate} - ${hInv.toDate}` : "—")}</TableCell>
                                              <TableCell className="py-2 text-xs text-right font-semibold">{formatCurrency(Number(hInv.amount))}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                              No outstanding invoices found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="interest">
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Interest Accrued</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {formatCurrency(interestSummary?.reduce((sum: number, item: any) => sum + item.interest, 0) || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding Interest</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">
                        {formatCurrency(interestSummary?.filter((i: any) => i.status === "Pending").reduce((sum: number, item: any) => sum + item.interest, 0) || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Detailed Overdue Interest Breakdown</CardTitle>
                    <CardDescription>Itemized calculation of late payment penalties per dispatch/invoice.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice / Date</TableHead>
                          <TableHead>Principal</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Overdue Days</TableHead>
                          <TableHead>Rate (%)</TableHead>
                          <TableHead className="text-right">Interest Accrued</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interestLoading ? (
                           <TableRow>
                              <TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell>
                           </TableRow>
                        ) : interestSummary && interestSummary.length > 0 ? (
                          interestSummary.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">
                                <div>{item.reference}</div>
                                <div className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString()}</div>
                              </TableCell>
                              <TableCell className="font-medium text-xs">{formatCurrency(item.principal)}</TableCell>
                              <TableCell className="text-xs">{new Date(item.dueDate).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs">{item.actualPaymentDate}</TableCell>
                              <TableCell className="text-xs text-destructive font-bold">{item.overdueDays}</TableCell>
                              <TableCell className="text-xs">{item.rate}%</TableCell>
                              <TableCell className="text-right font-bold text-destructive text-xs">
                                {formatCurrency(item.interest)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === "Settled" ? "default" : "destructive"} className="capitalize text-[10px]">
                                  {item.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                              No overdue interest accrued.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
