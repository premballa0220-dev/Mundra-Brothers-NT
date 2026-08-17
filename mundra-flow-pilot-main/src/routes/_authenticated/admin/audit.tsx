import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getJournalEntries, getAdminOverdueReport } from "@/lib/api/business.functions";
import { calculateLedgerBalances } from "@/lib/ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  FileText,
  Truck,
  CreditCard,
  Receipt,
  RotateCcw,
  Users,
  ArrowRight,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditDebitNoteDialog } from "@/components/credit-debit-note-dialog";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  ssr: false,
  component: AuditJournalPage,
});

type JournalType =
  | "all"
  | "mundra_to_utcl"
  | "utcl_to_client"
  | "client_to_utcl"
  | "utcl_to_mundra"
  | "credit_note"
  | "debit_note";

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    dotColor: string;
    badgeVariant: "default" | "secondary" | "outline" | "destructive";
    badgeClass: string;
  }
> = {
  mundra_to_utcl: {
    label: "PO Created",
    icon: FileText,
    dotColor: "bg-blue-500",
    badgeVariant: "outline",
    badgeClass: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  },
  utcl_to_client: {
    label: "Dispatch",
    icon: Truck,
    dotColor: "bg-emerald-500",
    badgeVariant: "outline",
    badgeClass: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  },
  client_to_utcl: {
    label: "Payment (Client)",
    icon: CreditCard,
    dotColor: "bg-violet-500",
    badgeVariant: "outline",
    badgeClass: "border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-950/30",
  },
  utcl_to_mundra: {
    label: "Refund Due",
    icon: RotateCcw,
    dotColor: "bg-amber-500",
    badgeVariant: "outline",
    badgeClass: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  },
  credit_note: {
    label: "Credit Note",
    icon: FileText,
    dotColor: "bg-teal-500",
    badgeVariant: "outline",
    badgeClass: "border-teal-500 text-teal-600 bg-teal-50 dark:bg-teal-950/30",
  },
  debit_note: {
    label: "Debit Note",
    icon: AlertCircle,
    dotColor: "bg-rose-500",
    badgeVariant: "outline",
    badgeClass: "border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/30",
  },
};

function formatCurrency(val: number) {
  if (val === 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function JournalEntryCard({ entry, onSendRefund }: { entry: any; onSendRefund: () => void }) {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.mundra_to_utcl;
  const Icon = config.icon;
  const m = entry.meta;

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center gap-0 flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-full ${config.dotColor} flex items-center justify-center shadow-md ring-4 ring-background flex-shrink-0`}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="w-px flex-1 bg-border/60 mt-1" />
      </div>

      <Card
        className="mb-4 flex-1 hover:shadow-md transition-shadow duration-200 border-l-2"
        style={{
          borderLeftColor: config.dotColor.replace("bg-", "").includes("-") ? undefined : undefined,
        }}
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={`text-xs font-medium ${config.badgeClass}`} variant="outline">
                  {config.label}
                </Badge>
                {m.client_name && (
                  <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
                    {m.client_name}
                  </span>
                )}
              </div>

              <p className="font-semibold text-sm text-foreground mb-2">{entry.title}</p>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {m.po_number && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">PO:</span> {m.po_number}
                  </span>
                )}
                {m.total_value !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Value:</span>
                    <span className="text-foreground font-semibold">
                      {formatCurrency(m.total_value)}
                    </span>
                  </span>
                )}
                {m.amount !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Amount:</span>
                    <span className="text-foreground font-semibold">
                      {formatCurrency(m.amount)}
                    </span>
                  </span>
                )}
                {m.quantity !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Qty:</span> {m.quantity} MT
                  </span>
                )}
                {m.payment_mode && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Mode:</span> {m.payment_mode}
                  </span>
                )}
                {m.reference_number && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Ref:</span>
                    <span className="font-mono">{m.reference_number}</span>
                  </span>
                )}
                {m.requested_date && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Delivery Date:</span>
                    <span>{formatDate(m.requested_date)}</span>
                  </span>
                )}
                {m.site_address && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Site:</span>
                    <span className="truncate max-w-[180px]">{m.site_address}</span>
                  </span>
                )}
                {m.reason && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Reason:</span>
                    <span className="capitalize">{m.reason}</span>
                  </span>
                )}
                {m.origin_reference && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Adjusts:</span>
                    <span>
                      {m.origin_type} - {m.origin_reference}
                    </span>
                  </span>
                )}
                {m.status && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Status:</span>
                    <span className="capitalize">{m.status}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0 min-w-[120px]">
              <div className="text-right">
                <div className="text-xs font-semibold text-foreground">
                  {formatDate(entry.timestamp)}
                </div>
              </div>
              {entry.type === "utcl_to_mundra" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={onSendRefund}
                >
                  <Receipt className="h-3 w-3 mr-1" />
                  Send Refund Letter
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpandableLedgerRow({ row, clientFilter }: { row: any; clientFilter: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOpeningBalance = row.type === "opening_balance";
  const hasInvoices = isOpeningBalance && row.meta?.historical_invoices && row.meta.historical_invoices.length > 0;

  return (
    <>
      <TableRow
        className={
          !row.isPosting
            ? "bg-muted/20 text-muted-foreground hover:bg-muted/30"
            : ""
        }
      >
        <TableCell className="font-medium text-xs whitespace-nowrap pl-4">
          <div className="flex items-center gap-2">
            {hasInvoices ? (
              <button onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-muted p-0.5 rounded focus:outline-none">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            {formatDate(row.timestamp)}
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={
              !row.isPosting ? "opacity-60 text-[10px]" : "text-[10px]"
            }
          >
            {TYPE_CONFIG[row.type]?.label || row.type}
          </Badge>
          {!row.isPosting && (
            <span className="ml-2 text-[10px] italic">(Memo)</span>
          )}
        </TableCell>
        {clientFilter === "all" && (
          <TableCell className="text-xs font-medium truncate max-w-[150px]">
            {row.meta?.client_name || "—"}
          </TableCell>
        )}
        <TableCell className="font-mono text-xs">
          {row.meta?.invoice_number || 
            row.meta?.reference_number ||
            row.meta?.po_number ||
            (row.meta?.dispatch_id
              ? `DR-${row.meta.dispatch_id.substring(0, 6)}`
              : "—")}
        </TableCell>
        <TableCell className="text-right text-xs">
          {row.meta?.quantity ? `${row.meta.quantity} MT` : "—"}
        </TableCell>
        <TableCell className="text-right text-xs">
          {row.meta?.locked_rate
            ? formatCurrency(row.meta.locked_rate)
            : "—"}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive">
          {row.debit > 0 ? formatCurrency(row.debit) : "—"}
        </TableCell>
        <TableCell className="text-right text-xs text-emerald-600">
          {row.credit > 0 ? formatCurrency(row.credit) : "—"}
        </TableCell>
        <TableCell className="text-right text-xs font-bold pr-4">
          {formatCurrency(Math.abs(row.runningBalance))}{" "}
          {row.runningBalance > 0
            ? "Dr"
            : row.runningBalance < 0
              ? "Cr"
              : ""}
        </TableCell>
      </TableRow>
      {isExpanded && hasInvoices && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={clientFilter === "all" ? 9 : 8} className="p-0 border-b">
            <div className="px-12 py-4">
              <div className="text-xs font-semibold mb-2">Historical Invoices</div>
              <Table className="bg-background border rounded-md">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Invoice No</TableHead>
                    <TableHead className="text-xs h-8">Date</TableHead>
                    <TableHead className="text-xs h-8 text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.meta.historical_invoices.map((inv: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs py-2">{inv.invoiceNo || inv.invoiceNumber || (inv.type === "debit_note" ? "Debit Note" : "—")}</TableCell>
                      <TableCell className="text-xs py-2">{inv.date ? formatDate(inv.date) : (inv.fromDate && inv.toDate ? `${formatDate(inv.fromDate)} - ${formatDate(inv.toDate)}` : "—")}</TableCell>
                      <TableCell className="text-xs text-right pr-4 py-2 font-medium">{formatCurrency(Number(inv.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function AuditJournalPage() {
  const navigate = useNavigate();
  const [viewTab, setViewTab] = useState<"journal" | "ledger">("journal");
  const [filter, setFilter] = useState<JournalType>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [showNonPosting, setShowNonPosting] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-journal-entries"],
    queryFn: () => getJournalEntries(),
  });

  const { data: overdueReport, isLoading: overdueLoading } = useQuery({
    queryKey: ["admin-overdue-report", clientFilter],
    queryFn: () => getAdminOverdueReport({ data: { clientId: clientFilter } }),
  });

  const clientNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries || []) {
      if ((e as any).meta?.client_name) names.add((e as any).meta.client_name);
    }
    return Array.from(names).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries || [];
    if (filter !== "all") result = result.filter((e: any) => e.type === filter);
    if (clientFilter !== "all")
      result = result.filter((e: any) => e.meta?.client_name === clientFilter);
    return result;
  }, [entries, filter, clientFilter]);

  const groupedJournal: { dateLabel: string; entries: any[] }[] = [];
  let lastDate = "";
  for (const entry of filtered) {
    const dateLabel = new Date(entry.timestamp).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (dateLabel !== lastDate) {
      groupedJournal.push({ dateLabel, entries: [] });
      lastDate = dateLabel;
    }
    groupedJournal[groupedJournal.length - 1].entries.push(entry);
  }

  // --- LEDGER LOGIC ---
  const calculatedAllRows = useMemo(() => {
    if (!entries) return [];
    return calculateLedgerBalances(entries);
  }, [entries]);

  const clientSummaries = useMemo(() => {
    if (calculatedAllRows.length === 0) return [];
    
    const map = new Map<string, { debits: number; credits: number; balance: number }>();
    
    for (const e of calculatedAllRows) {
      if (!e.meta?.client_name) continue;
      const clientName = e.meta.client_name;
      
      if (!map.has(clientName)) {
        map.set(clientName, { debits: 0, credits: 0, balance: 0 });
      }
      const acct = map.get(clientName)!;
      acct.debits += e.debit;
      acct.credits += e.credit;
      if (e.isPosting) {
        acct.balance = e.runningBalance;
      }
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [calculatedAllRows]);

  const clientLedgerRows = useMemo(() => {
    const rows = calculatedAllRows.filter(e => {
      if (clientFilter !== "all" && e.meta?.client_name !== clientFilter) return false;
      if (e.type === "utcl_to_mundra") return false;
      if (!e.isPosting && !showNonPosting) return false;
      return true;
    });

    // Reverse only the copied array for latest-first admin display.
    return [...rows].reverse();
  }, [calculatedAllRows, clientFilter, showNonPosting]);

  const hasLateOpeningBalance = useMemo(() => {
    if (!entries) return false;
    const clientFirstPostings = new Map<string, number>();
    
    for (const e of entries) {
       if (e.type !== "opening_balance" && ["utcl_to_client", "client_to_utcl", "debit_note", "credit_note"].includes(e.type)) {
         const date = new Date(e.timestamp).getTime();
         const clientName = e.meta?.client_name || "Unknown";
         const current = clientFirstPostings.get(clientName);
         if (!current || date < current) {
           clientFirstPostings.set(clientName, date);
         }
       }
    }

    for (const e of entries) {
      if (e.type === "opening_balance") {
        const clientName = e.meta?.client_name || "Unknown";
        const firstPosting = clientFirstPostings.get(clientName);
        if (firstPosting && new Date(e.timestamp).getTime() > firstPosting) {
           return true;
        }
      }
    }
    return false;
  }, [entries]);

  const selectedClientSummary = useMemo(() => {
    if (clientFilter === "all") {
      let debits = 0;
      let credits = 0;
      for (const c of clientSummaries) {
        debits += c.debits;
        credits += c.credits;
      }
      return { debits, credits, balance: debits - credits };
    }
    return (
      clientSummaries.find((c) => c.name === clientFilter) || { debits: 0, credits: 0, balance: 0 }
    );
  }, [clientSummaries, clientFilter]);

  const handleSendRefund = () => {
    navigate({ to: "/admin/refund-letters" });
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-6xl mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trail & Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological feed of transaction events and client-wise accounting ledgers.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={viewTab} onValueChange={(v: any) => setViewTab(v)} className="w-[450px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="journal">Journal Feed</TabsTrigger>
              <TabsTrigger value="ledger">Ledger Statements</TabsTrigger>
              <TabsTrigger value="overdue">Aging & Overdue</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={() => setIsNoteDialogOpen(true)} className="ml-auto">
            Issue Adjustment Note
          </Button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Client Account:
            </span>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[220px] h-8 text-sm">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients (Consolidated)</SelectItem>
                {clientNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {viewTab === "journal" && (
              <div className="max-w-4xl space-y-6 mt-4">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as JournalType)}>
                  <TabsList className="flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="all" className="text-xs">
                      All Events
                    </TabsTrigger>
                    <TabsTrigger value="mundra_to_utcl" className="text-xs">
                      Mundra → UTCL
                    </TabsTrigger>
                    <TabsTrigger value="utcl_to_client" className="text-xs">
                      UTCL → Client
                    </TabsTrigger>
                    <TabsTrigger value="client_to_utcl" className="text-xs">
                      Client → UTCL
                    </TabsTrigger>
                    <TabsTrigger value="utcl_to_mundra" className="text-xs">
                      UTCL → Mundra
                    </TabsTrigger>
                    <TabsTrigger value="credit_note" className="text-xs">
                      Credit Notes
                    </TabsTrigger>
                    <TabsTrigger value="debit_note" className="text-xs">
                      Debit Notes
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      No journal entries found for the selected filter.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {groupedJournal.map((group) => (
                      <div key={group.dateLabel}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {group.dateLabel}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div>
                          {group.entries.map((entry: any) => (
                            <JournalEntryCard
                              key={entry.id}
                              entry={entry}
                              onSendRefund={handleSendRefund}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewTab === "ledger" && (
              <div className="space-y-4">
                {hasLateOpeningBalance && (
                  <Alert variant="default" className="border-warning/50 bg-warning/5 mb-4">
                    <AlertTitle className="font-semibold text-warning">Warning: Late Opening Balances Detected</AlertTitle>
                    <AlertDescription>
                      One or more Opening Balances have an effective date later than existing posting transactions. 
                      This may cause historical running balances to appear incorrectly during the period prior to the Opening Balance.
                    </AlertDescription>
                  </Alert>
                )}
                {clientFilter === "all" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">
                        Client Account Balances Summary
                      </CardTitle>
                      <CardDescription>
                        Consolidated view of all active client ledger balances based on journal
                        postings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Client Name</TableHead>
                            <TableHead className="text-right">Total Debits</TableHead>
                            <TableHead className="text-right">Total Credits</TableHead>
                            <TableHead className="text-right">Running Balance</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientSummaries.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-10 text-muted-foreground"
                              >
                                No ledger data available.
                              </TableCell>
                            </TableRow>
                          ) : (
                            clientSummaries.map((summary) => (
                              <TableRow key={summary.name}>
                                <TableCell className="font-semibold text-sm pl-6">
                                  {summary.name}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency(summary.debits)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency(summary.credits)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-bold ${summary.balance > 0 ? "text-destructive" : summary.balance < 0 ? "text-emerald-600" : ""}`}
                                >
                                  {formatCurrency(Math.abs(summary.balance))}{" "}
                                  {summary.balance > 0 ? "Dr" : summary.balance < 0 ? "Cr" : ""}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => {
                                      setClientFilter(summary.name);
                                    }}
                                  >
                                    View Ledger <ArrowRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {clientFilter === "all"
                        ? "Master Consolidated Ledger"
                        : `${clientFilter} — Ledger Statement`}
                    </h2>
                    {clientFilter !== "all" && (
                      <Button variant="outline" size="sm" onClick={() => setClientFilter("all")}>
                        Back to All Accounts
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-muted/30">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Debits
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                          {formatCurrency(selectedClientSummary.debits)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Credits (Paid)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(selectedClientSummary.credits)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className={
                        selectedClientSummary.balance > 0
                          ? "border-destructive/50 bg-destructive/5"
                          : selectedClientSummary.balance < 0
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : "bg-muted/30"
                      }
                    >
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-2">
                          <div className="text-2xl font-bold">
                            {formatCurrency(Math.abs(selectedClientSummary.balance))}
                          </div>
                          <span className="text-sm font-medium mb-1">
                            {selectedClientSummary.balance > 0
                              ? "Dr (Receivable)"
                              : selectedClientSummary.balance < 0
                                ? "Cr (Advance)"
                                : ""}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                      <div>
                        <CardTitle className="text-base font-semibold">Ledger Entries</CardTitle>
                        <CardDescription>
                          Chronological posting of all transactions
                          {clientFilter !== "all" ? " for this account" : ""}.
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="non-posting"
                          checked={showNonPosting}
                          onCheckedChange={setShowNonPosting}
                        />
                        <Label htmlFor="non-posting" className="text-xs font-medium cursor-pointer">
                          Show non-posting entries (POs)
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Date</TableHead>
                            <TableHead>Transaction</TableHead>
                            {clientFilter === "all" && <TableHead>Client</TableHead>}
                            <TableHead>Reference</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right text-destructive">
                              Debit (Bills & Debit Notes)
                            </TableHead>
                            <TableHead className="text-right text-emerald-600">
                              Credit (Payments & Credit Notes)
                            </TableHead>
                            <TableHead className="text-right font-bold pr-4">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientLedgerRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={clientFilter === "all" ? 9 : 8}
                                className="text-center py-10 text-muted-foreground"
                              >
                                No transactions recorded.
                              </TableCell>
                            </TableRow>
                          ) : (
                            clientLedgerRows.map((row) => (
                              <ExpandableLedgerRow key={row.id} row={row} clientFilter={clientFilter} />
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Alert className="mt-8 bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold text-sm">
                    Audit Compliance Notice (Rule 11.4)
                  </AlertTitle>
                  <AlertDescription className="text-blue-700/80 dark:text-blue-400/80 text-xs mt-1">
                    The ledger serves as the master book of final entry. All running balances are
                    derived dynamically from immutable journal postings. Direct editing of ledger
                    entries is strictly prohibited. Corrections must be made through explicit
                    adjustment or reversal journal entries to maintain a complete and compliant
                    audit trail.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </>
        )}
      </div>

      {viewTab === "overdue" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Aging & Overdue Invoices</CardTitle>
            <CardDescription>
              {clientFilter === "all" ? "Global view" : `${clientFilter}'s`} unpaid invoices and overdue days.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  {clientFilter === "all" && <TableHead>Client Name</TableHead>}
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Unpaid Amount</TableHead>
                  <TableHead className="text-right">Overdue Days</TableHead>
                  <TableHead className="text-right">Accrued Interest</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueLoading ? (
                  <TableRow>
                    <TableCell colSpan={clientFilter === "all" ? 8 : 7} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : overdueReport && overdueReport.length > 0 ? (
                  overdueReport.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                      {clientFilter === "all" && <TableCell>{inv.client_name}</TableCell>}
                      <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(inv.unpaid_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.overdue_days > 0 ? (
                          <span className={`font-bold ${inv.is_in_grace_period ? "text-amber-500" : "text-destructive"}`}>
                            {inv.overdue_days} Days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not Overdue</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-semibold">
                        {inv.accrued_interest > 0 ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(inv.accrued_interest) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.overdue_days > 0 ? (inv.is_in_grace_period ? "outline" : "destructive") : "secondary"} className="text-[10px] capitalize">
                          {inv.status === "partially_paid" ? "Partial" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={clientFilter === "all" ? 7 : 6} className="text-center py-10 text-muted-foreground">
                      No unpaid invoices found for the selected criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreditDebitNoteDialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen} />
    </AppShell>
  );
}
