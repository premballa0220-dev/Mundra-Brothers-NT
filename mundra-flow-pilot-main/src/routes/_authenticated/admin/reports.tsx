import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getTallyExportData } from "@/lib/api/business.functions";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ─── Tally XML Generator ─────────────────────────────────────────────────────

function formatTallyDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmt(n: number | string | null | undefined): string {
  return Number(n || 0).toFixed(2);
}

function generateTallyXML(exportData: any): string {
  const { clients, invoices, payments, creditNotes, debitNotes } = exportData;
  const companyName = "Mundra Brothers";

  // ── Ledger Masters (Clients as Sundry Debtors) ──
  const ledgerMasters = clients
    .map(
      (c: any) => `
    <LEDGER NAME="${escapeXml(c.trade_name || c.name)}" RESERVEDNAME="">
      <NAME>${escapeXml(c.trade_name || c.name)}</NAME>
      <PARENT>Sundry Debtors</PARENT>
      <ISBILLWISEON>Yes</ISBILLWISEON>
      <AFFECTSSTOCK>No</AFFECTSSTOCK>
      <OPENINGBALANCE>0</OPENINGBALANCE>
      ${c.gstin ? `<TAXREGISTRATIONNUMBER>${escapeXml(c.gstin)}</TAXREGISTRATIONNUMBER>` : ""}
      ${c.pan ? `<INCOMETAXNUMBER>${escapeXml(c.pan)}</INCOMETAXNUMBER>` : ""}
      ${c.billing_address ? `<MAILINGNAME>${escapeXml(c.trade_name || c.name)}</MAILINGNAME><ADDRESS.LIST TYPE="String"><ADDRESS>${escapeXml(c.billing_address)}</ADDRESS></ADDRESS.LIST>` : ""}
    </LEDGER>`
    )
    .join("\n");

  // ── Sales Vouchers (Invoices) ──
  const salesVouchers = invoices
    .map((inv: any) => {
      const clientName = escapeXml(inv.organizations?.trade_name || inv.organizations?.name || "Unknown");
      const amount = fmt(inv.amount);
      const tallyDate = formatTallyDate(inv.invoice_date);
      return `
    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
      <DATE>${tallyDate}</DATE>
      <GUID>INV-${escapeXml(inv.id)}</GUID>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(inv.invoice_number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${clientName}</PARTYLEDGERNAME>
      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
      <NARRATION>Invoice ${escapeXml(inv.invoice_number)} | Due: ${formatTallyDate(inv.due_date)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${clientName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount}</AMOUNT>
        <BILLALLOCATIONS.LIST>
          <NAME>${escapeXml(inv.invoice_number)}</NAME>
          <BILLTYPE>New Ref</BILLTYPE>
          <AMOUNT>-${amount}</AMOUNT>
        </BILLALLOCATIONS.LIST>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Sales</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join("\n");

  // ── Receipt Vouchers (Payments) ──
  const receiptVouchers = payments
    .map((p: any) => {
      const clientName = escapeXml(p.organizations?.trade_name || p.organizations?.name || "Unknown");
      const amount = fmt(p.amount);
      const tallyDate = formatTallyDate(p.payment_date);
      const narration = `Payment | ${escapeXml(p.payment_mode || "")} | Ref: ${escapeXml(p.reference_number || "")}${p.bank_name ? ` | Bank: ${escapeXml(p.bank_name)}` : ""}`;
      return `
    <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${tallyDate}</DATE>
      <GUID>PMT-${escapeXml(p.id)}</GUID>
      <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(p.reference_number || p.id)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${clientName}</PARTYLEDGERNAME>
      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
      <NARRATION>${narration}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Bank Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${clientName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join("\n");

  // ── Credit Note Vouchers ──
  const creditVouchers = (creditNotes || [])
    .map((cn: any) => {
      const clientName = escapeXml(cn.issued_to?.trade_name || cn.issued_to?.name || "Unknown");
      const amount = fmt(cn.amount);
      const tallyDate = formatTallyDate(cn.issue_date);
      return `
    <VOUCHER VCHTYPE="Credit Note" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${tallyDate}</DATE>
      <GUID>CN-${escapeXml(cn.id)}</GUID>
      <VOUCHERTYPENAME>Credit Note</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(cn.credit_note_number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${clientName}</PARTYLEDGERNAME>
      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
      <NARRATION>${escapeXml(cn.reason)}${cn.remarks ? ` - ${escapeXml(cn.remarks)}` : ""}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${clientName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Sales</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join("\n");

  // ── Debit Note Vouchers ──
  const debitVouchers = (debitNotes || [])
    .map((dn: any) => {
      const clientName = escapeXml(dn.issued_to?.trade_name || dn.issued_to?.name || "Unknown");
      const amount = fmt(dn.amount);
      const tallyDate = formatTallyDate(dn.issue_date);
      return `
    <VOUCHER VCHTYPE="Debit Note" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${tallyDate}</DATE>
      <GUID>DN-${escapeXml(dn.id)}</GUID>
      <VOUCHERTYPENAME>Debit Note</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(dn.debit_note_number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${clientName}</PARTYLEDGERNAME>
      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
      <NARRATION>${escapeXml(dn.reason)}${dn.remarks ? ` - ${escapeXml(dn.remarks)}` : ""}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${clientName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Sales</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  TallyPrime Import File
  Company    : ${companyName}
  Generated  : ${new Date().toLocaleString("en-IN")}
  Period     : ${exportData.fromDate || "All time"} to ${exportData.toDate || "All time"}
  Records    : ${clients.length} ledgers, ${invoices.length} sales, ${payments.length} receipts, ${(creditNotes || []).length} credit notes, ${(debitNotes || []).length} debit notes
-->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${ledgerMasters}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${salesVouchers}
          ${receiptVouchers}
          ${creditVouchers}
          ${debitVouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
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

  const { data: exportData, isLoading, error } = useQuery({
    queryKey: ["tally-export", queryParams.fromDate, queryParams.toDate],
    queryFn: () =>
      getTallyExportData({
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
      const xml = generateTallyXML(exportData);
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const label =
        queryParams.fromDate && queryParams.toDate
          ? `${queryParams.fromDate}_to_${queryParams.toDate}`
          : "all_time";
      a.href = url;
      a.download = `mundra_tally_export_${label}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Tally XML downloaded!", {
        description: "Import this file in TallyPrime via Gateway of Tally → Import → Masters, then → Import → Vouchers.",
      });
    } catch {
      toast.error("Failed to generate XML. Please try again.");
    }
  }, [exportData, queryParams]);

  const totalVouchers =
    (exportData?.invoices?.length || 0) +
    (exportData?.payments?.length || 0) +
    (exportData?.creditNotes?.length || 0) +
    (exportData?.debitNotes?.length || 0);

  const summaryCards = [
    {
      label: "Client Ledgers",
      value: exportData?.clients?.length ?? "—",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      desc: "Sundry Debtors",
    },
    {
      label: "Sales Vouchers",
      value: exportData?.invoices?.length ?? "—",
      icon: FileText,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      desc: "Invoices",
    },
    {
      label: "Receipt Vouchers",
      value: exportData?.payments?.length ?? "—",
      icon: Wallet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      desc: "Verified payments",
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
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileCode2 className="h-6 w-6 text-primary" />
              Reports &amp; Tally Export
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a TallyPrime-compatible XML file to import ledger masters and vouchers into your accounting software.
            </p>
          </div>
          <Button
            id="btn-download-tally-xml"
            size="lg"
            disabled={isLoading || !exportData || totalVouchers === 0}
            onClick={handleDownload}
            className="gap-2 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Tally XML
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
                <Label htmlFor="from-date" className="text-xs">From Date</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <Label htmlFor="to-date" className="text-xs">To Date</Label>
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

        {/* What's included */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What Gets Exported</CardTitle>
            <CardDescription>
              The XML follows TallyPrime's import envelope format — import Masters first, then Vouchers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                {
                  title: "Ledger Masters",
                  subtitle: "Active clients as Sundry Debtors with GSTIN/PAN/address.",
                  ok: true,
                },
                {
                  title: "Sales Vouchers",
                  subtitle: "All invoices in the period with bill-by-bill references.",
                  ok: true,
                },
                {
                  title: "Receipt Vouchers",
                  subtitle: "Verified payments with mode & reference number.",
                  ok: true,
                },
                {
                  title: "Credit Notes",
                  subtitle: "Rate corrections, shortages, quality claims and more.",
                  ok: true,
                },
                {
                  title: "Debit Notes",
                  subtitle: "Rate escalations, penalties, under-billing corrections.",
                  ok: true,
                },
                {
                  title: "Dispatch / Workflow Data",
                  subtitle: "Not exported — operational data with no Tally equivalent.",
                  ok: false,
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2.5">
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className={`font-medium ${!item.ok ? "text-muted-foreground" : ""}`}>
                      {item.title}
                    </span>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Import Instructions */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to Import in TallyPrime</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5 text-sm text-muted-foreground list-decimal list-inside">
              <li>Download the XML file using the <strong className="text-foreground">Download Tally XML</strong> button above.</li>
              <li>Open TallyPrime and select your company.</li>
              <li>
                Go to{" "}
                <Badge variant="secondary" className="text-[11px]">Gateway of Tally</Badge>
                {" → "}
                <Badge variant="secondary" className="text-[11px]">Import</Badge>
                {" → "}
                <Badge variant="secondary" className="text-[11px]">Masters</Badge>
                {" "}and import the XML file <strong className="text-foreground">first</strong> (creates client ledgers).
              </li>
              <li>
                Then go to{" "}
                <Badge variant="secondary" className="text-[11px]">Import</Badge>
                {" → "}
                <Badge variant="secondary" className="text-[11px]">Vouchers</Badge>
                {" "}and import the same XML file again (creates sales, receipts, notes).
              </li>
              <li>Verify the imported entries in <strong className="text-foreground">Day Book</strong> before closing.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Footer timestamp */}
        {exportData && (
          <p className="text-[11px] text-muted-foreground text-right">
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
