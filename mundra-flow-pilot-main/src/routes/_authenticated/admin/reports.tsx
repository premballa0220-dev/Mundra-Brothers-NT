import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getExcelExportData } from "@/lib/api/business.functions";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import {
  Download,
  Loader2,
  FileCode2,
  Users,
  FileText,
  Wallet,
  TrendingDown,
  TrendingUp,
  CalendarRange,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  ssr: false,
  component: AdminReportsPage,
});

// ─── Excel Generator ────────────────────────────────────────────────────────

function formatExcelDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function generateExcelWorkbook(exportData: any, label: string) {
  const { clients, invoices, payments, pos, dispatches, creditNotes, debitNotes } = exportData;
  const wb = XLSX.utils.book_new();

  // 1. Clients
  const wsClients = XLSX.utils.json_to_sheet(
    (clients || []).map((c: any) => ({
      ID: c.id,
      Name: c.legal_name,
      "Trade Name": c.trade_name || "",
      GSTIN: c.gst_number || "",
      PAN: c.pan_number || "",
      "Billing Address": c.billing_address || "",
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsClients, "Clients");

  // 2. Invoices
  const wsInvoices = XLSX.utils.json_to_sheet(
    (invoices || []).map((inv: any) => ({
      "Invoice Number": inv.invoice_number,
      Date: formatExcelDate(inv.invoice_date),
      Client: inv.organizations?.trade_name || inv.organizations?.legal_name || "",
      Amount: inv.amount,
      "Due Date": formatExcelDate(inv.due_date),
      Status: inv.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoices");

  // 3. Payments
  const wsPayments = XLSX.utils.json_to_sheet(
    (payments || []).map((p: any) => ({
      Reference: p.reference_number || p.id,
      Date: formatExcelDate(p.payment_date),
      Client: p.organizations?.trade_name || p.organizations?.legal_name || "",
      Amount: p.amount,
      Mode: p.payment_mode || "",
      "Bank Name": p.bank_name || "",
      Status: p.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");

  // 3a. Purchase Orders
  const wsPOs = XLSX.utils.json_to_sheet(
    (pos || []).map((po: any) => ({
      "PO Number": po.po_number,
      Date: formatExcelDate(po.created_at),
      Client: po.organizations?.trade_name || po.organizations?.legal_name || "",
      Quantity: po.original_quantity,
      "Locked Rate": po.locked_rate,
      "Total Value": po.total_value,
      Status: po.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsPOs, "Purchase Orders");

  // 3b. Dispatch Requests
  const wsDispatches = XLSX.utils.json_to_sheet(
    (dispatches || []).map((dr: any) => ({
      "Dispatch ID": dr.id,
      "PO Number": dr.purchase_orders?.po_number || "",
      Date: formatExcelDate(dr.created_at),
      Client: dr.organizations?.trade_name || dr.organizations?.legal_name || "",
      Quantity: dr.quantity,
      "Requested Date": dr.requested_date,
      Status: dr.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsDispatches, "Dispatches");

  // 4. Credit Notes
  const wsCreditNotes = XLSX.utils.json_to_sheet(
    (creditNotes || []).map((cn: any) => ({
      "Credit Note Number": cn.credit_note_number,
      Date: formatExcelDate(cn.issue_date),
      Client: cn.issued_to?.trade_name || cn.issued_to?.legal_name || "",
      Amount: cn.amount,
      Reason: cn.reason || "",
      Remarks: cn.remarks || "",
      Status: cn.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsCreditNotes, "Credit Notes");

  // 5. Debit Notes
  const wsDebitNotes = XLSX.utils.json_to_sheet(
    (debitNotes || []).map((dn: any) => ({
      "Debit Note Number": dn.debit_note_number,
      Date: formatExcelDate(dn.issue_date),
      Client: dn.issued_to?.trade_name || dn.issued_to?.legal_name || "",
      Amount: dn.amount,
      Reason: dn.reason || "",
      Remarks: dn.remarks || "",
      Status: dn.status,
    })),
  );
  XLSX.utils.book_append_sheet(wb, wsDebitNotes, "Debit Notes");

  XLSX.writeFile(wb, `mundra_export_${label}.xlsx`);
}

// ─── Page Component ───────────────────────────────────────────────────────────

function AdminReportsPage() {
  const currentYear = new Date().getFullYear();
  // FY starts April 1 — if we're past March, use current year; else use last year
  const fyStartYear = new Date().getMonth() >= 3 ? currentYear : currentYear - 1;

  const [fromDate, setFromDate] = useState(`${fyStartYear}-04-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [queryParams, setQueryParams] = useState<{ fromDate?: string; toDate?: string }>({
    fromDate: `${fyStartYear}-04-01`,
    toDate: new Date().toISOString().split("T")[0],
  });

  const {
    data: exportData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["excel-export", queryParams.fromDate, queryParams.toDate],
    queryFn: () =>
      getExcelExportData({
        data: {
          fromDate: queryParams.fromDate || undefined,
          toDate: queryParams.toDate || undefined,
        },
      }),
    staleTime: 60_000,
  });

  const handleApplyFilter = () => {
    setQueryParams({ fromDate: fromDate || undefined, toDate: toDate || undefined });
  };

  const handleSetFY = (year: number) => {
    const from = `${year}-04-01`;
    const to = `${year + 1}-03-31`;
    setFromDate(from);
    setToDate(to);
    setQueryParams({ fromDate: from, toDate: to });
  };

  const handleDownload = useCallback(() => {
    if (!exportData) return;
    try {
      const label =
        queryParams.fromDate && queryParams.toDate
          ? `${queryParams.fromDate}_to_${queryParams.toDate}`
          : "all_time";
      generateExcelWorkbook(exportData, label);
      toast.success("Excel downloaded!");
    } catch {
      toast.error("Failed to generate Excel. Please try again.");
    }
  }, [exportData, queryParams]);

  const summaryCards = [
    {
      label: "Clients",
      value: exportData?.clients?.length ?? "—",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      desc: "Sundry Debtors",
    },
    {
      label: "Invoices",
      value: exportData?.invoices?.length ?? "—",
      icon: FileText,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      desc: "Sales Vouchers",
    },
    {
      label: "Purchase Orders",
      value: exportData?.pos?.length ?? "—",
      icon: FileText,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      desc: "PO Generations",
    },
    {
      label: "Dispatches",
      value: exportData?.dispatches?.length ?? "—",
      icon: TrendingUp, // fallback icon since Truck might not be imported
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      desc: "Dispatch Requests",
    },
    {
      label: "Payments",
      value: exportData?.payments?.length ?? "—",
      icon: Wallet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      desc: "Receipt Vouchers",
    },
    {
      label: "Credit Notes",
      value: exportData?.creditNotes?.length ?? "—",
      icon: TrendingDown,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      desc: "Rate / quality adj.",
    },
    {
      label: "Debit Notes",
      value: exportData?.debitNotes?.length ?? "—",
      icon: TrendingUp,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      desc: "Penalties / escalations",
    },
  ];

  return (
    <AppShell variant="admin">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileCode2 className="h-6 w-6 text-primary" />
              Reports &amp; Excel Export
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate an Excel file with detailed records across clients, invoices, payments, and
              notes.
            </p>
          </div>
          <Button
            id="btn-download-excel"
            size="lg"
            disabled={isLoading || !exportData}
            onClick={handleDownload}
            className="gap-2 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Excel Report
          </Button>
        </div>

        {/* Filter Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              Date Range Filter
            </CardTitle>
            <CardDescription>
              Filter data by date range. Use "All Time" to export everything.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Quick select:</span>
              {[fyStartYear - 1, fyStartYear].map((yr) => (
                <Button
                  key={yr}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleSetFY(yr)}
                >
                  FY {yr}–{String(yr + 1).slice(2)}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setQueryParams({});
                }}
              >
                All Time
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <Label htmlFor="from-date" className="text-xs">
                  From Date
                </Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <Label htmlFor="to-date" className="text-xs">
                  To Date
                </Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                id="btn-apply-filter"
                variant="secondary"
                className="h-9"
                onClick={handleApplyFilter}
              >
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {error ? (
          <Card className="border-destructive/50">
            <CardContent className="py-8 flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Failed to load export data</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(error as Error)?.message || "Unknown error occurred."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="relative overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className={`h-8 w-8 rounded-md grid place-items-center ${card.bg}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {isLoading ? (
                          <span className="inline-block h-7 w-10 rounded bg-muted animate-pulse" />
                        ) : (
                          card.value
                        )}
                      </div>
                      <div className="text-xs font-medium">{card.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{card.desc}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Data Preview */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Available Records Preview
            </CardTitle>
            <CardDescription>
              A preview of the data that will be included in your Excel export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                Loading preview...
              </div>
            ) : !exportData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              <Tabs defaultValue="invoices" className="w-full">
                <TabsList className="mb-4 flex-wrap">
                  <TabsTrigger value="clients">Clients ({exportData?.clients?.length || 0})</TabsTrigger>
                  <TabsTrigger value="pos">Purchase Orders ({exportData?.pos?.length || 0})</TabsTrigger>
                  <TabsTrigger value="dispatches">Dispatches ({exportData?.dispatches?.length || 0})</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices ({exportData?.invoices?.length || 0})</TabsTrigger>
                  <TabsTrigger value="payments">Payments ({exportData?.payments?.length || 0})</TabsTrigger>
                  <TabsTrigger value="notes">
                    Notes ({(exportData?.creditNotes?.length || 0) + (exportData?.debitNotes?.length || 0)})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="clients">
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client Name</TableHead>
                          <TableHead>Trade Name</TableHead>
                          <TableHead>GSTIN</TableHead>
                          <TableHead>PAN</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportData.clients?.length ? (
                          exportData.clients.map((client: any) => (
                            <TableRow key={client.id}>
                              <TableCell className="font-medium">{client.legal_name}</TableCell>
                              <TableCell>{client.trade_name || "—"}</TableCell>
                              <TableCell>{client.gst_number || "—"}</TableCell>
                              <TableCell>{client.pan_number || "—"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">
                              No clients found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="pos" className="mt-0">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          ) : (
                            exportData?.pos?.length ? (
                              exportData.pos.map((po: any) => (
                                <TableRow key={po.id}>
                                  <TableCell className="font-medium">{po.po_number || "—"}</TableCell>
                                  <TableCell>{formatExcelDate(po.created_at)}</TableCell>
                                  <TableCell>
                                    {po.organizations?.trade_name || po.organizations?.legal_name || "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    ₹{Number(po.total_value || 0).toLocaleString("en-IN")}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="capitalize">{po.status}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No purchase orders found
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="dispatches" className="mt-0">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Req. Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          ) : (
                            exportData?.dispatches?.length ? (
                              exportData.dispatches.map((dr: any) => (
                                <TableRow key={dr.id}>
                                  <TableCell className="font-medium">{dr.purchase_orders?.po_number || "—"}</TableCell>
                                  <TableCell>{formatExcelDate(dr.requested_date)}</TableCell>
                                  <TableCell>
                                    {dr.organizations?.trade_name || dr.organizations?.legal_name || "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {dr.quantity}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="capitalize">{dr.status}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No dispatch requests found
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="invoices">
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportData.invoices?.length ? (
                          exportData.invoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                              <TableCell>{formatExcelDate(inv.invoice_date)}</TableCell>
                              <TableCell>
                                {inv.organizations?.trade_name || inv.organizations?.legal_name || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{Number(inv.amount || 0).toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{inv.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                              No invoices found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="payments">
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Mode</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportData.payments?.length ? (
                          exportData.payments.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {p.reference_number || "—"}
                              </TableCell>
                              <TableCell>{formatExcelDate(p.payment_date)}</TableCell>
                              <TableCell>
                                {p.organizations?.trade_name || p.organizations?.legal_name || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell>{p.payment_mode || "—"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                              No payments found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportData.creditNotes?.map((cn: any) => (
                          <TableRow key={cn.id}>
                            <TableCell>
                              <Badge variant="secondary">Credit Note</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                            <TableCell>{formatExcelDate(cn.issue_date)}</TableCell>
                            <TableCell>
                              {cn.issued_to?.trade_name || cn.issued_to?.legal_name || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{Number(cn.amount || 0).toLocaleString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))}
                        {exportData.debitNotes?.map((dn: any) => (
                          <TableRow key={dn.id}>
                            <TableCell>
                              <Badge variant="outline">Debit Note</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{dn.debit_note_number}</TableCell>
                            <TableCell>{formatExcelDate(dn.issue_date)}</TableCell>
                            <TableCell>
                              {dn.issued_to?.trade_name || dn.issued_to?.legal_name || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{Number(dn.amount || 0).toLocaleString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!exportData.creditNotes?.length && !exportData.debitNotes?.length && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                              No notes found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Footer timestamp */}
        {exportData && (
          <p className="text-[11px] text-muted-foreground text-right mt-4">
            Data fetched at {new Date(exportData.exportedAt).toLocaleString("en-IN")}
            {" · "}
            {exportData.fromDate && exportData.toDate
              ? `Period: ${exportData.fromDate} to ${exportData.toDate}`
              : "All available data"}
          </p>
        )}
      </div>
    </AppShell>
  );
}
