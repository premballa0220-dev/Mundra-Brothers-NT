import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getJournalEntries } from "@/lib/api/business.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowRight, FileText, Truck, CreditCard, Receipt, RotateCcw } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  ssr: false,
  component: AuditJournalPage,
});

type JournalType = "all" | "mundra_to_utcl" | "utcl_to_client" | "client_to_utcl" | "utcl_to_mundra";

const TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  dotColor: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  badgeClass: string;
}> = {
  mundra_to_utcl: {
    label: "Mundra → UTCL",
    icon: FileText,
    dotColor: "bg-blue-500",
    badgeVariant: "outline",
    badgeClass: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  },
  utcl_to_client: {
    label: "UTCL → Client",
    icon: Truck,
    dotColor: "bg-emerald-500",
    badgeVariant: "outline",
    badgeClass: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  },
  client_to_utcl: {
    label: "Client → UTCL",
    icon: CreditCard,
    dotColor: "bg-violet-500",
    badgeVariant: "outline",
    badgeClass: "border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-950/30",
  },
  utcl_to_mundra: {
    label: "UTCL → Mundra",
    icon: RotateCcw,
    dotColor: "bg-amber-500",
    badgeVariant: "outline",
    badgeClass: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  },
};

function formatCurrency(val: number) {
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

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function JournalEntryCard({ entry, onSendRefund }: { entry: any; onSendRefund: () => void }) {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.mundra_to_utcl;
  const Icon = config.icon;
  const m = entry.meta;

  return (
    <div className="flex gap-4 group">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center gap-0 flex-shrink-0">
        <div className={`w-9 h-9 rounded-full ${config.dotColor} flex items-center justify-center shadow-md ring-4 ring-background flex-shrink-0`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="w-px flex-1 bg-border/60 mt-1" />
      </div>

      {/* Card */}
      <Card className="mb-4 flex-1 hover:shadow-md transition-shadow duration-200 border-l-2" style={{ borderLeftColor: config.dotColor.replace("bg-", "").includes("-") ? undefined : undefined }}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Header row */}
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

              {/* Title */}
              <p className="font-semibold text-sm text-foreground mb-2">{entry.title}</p>

              {/* Details grid */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {m.po_number && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">PO:</span> {m.po_number}
                  </span>
                )}
                {m.total_value !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Value:</span>
                    <span className="text-foreground font-semibold">{formatCurrency(m.total_value)}</span>
                  </span>
                )}
                {m.amount !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Amount:</span>
                    <span className="text-foreground font-semibold">{formatCurrency(m.amount)}</span>
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
                {m.site_address && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Site:</span>
                    <span className="truncate max-w-[180px]">{m.site_address}</span>
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

            {/* Right column: timestamp + action */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0 min-w-[120px]">
              <div className="text-right">
                <div className="text-xs font-semibold text-foreground">{formatDate(entry.timestamp)}</div>
                <div className="text-xs text-muted-foreground">{formatTime(entry.timestamp)}</div>
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

function AuditJournalPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<JournalType>("all");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-journal-entries"],
    queryFn: () => getJournalEntries(),
  });

  const filtered = filter === "all" ? (entries || []) : (entries || []).filter((e: any) => e.type === filter);

  // Group entries by date label
  const grouped: { dateLabel: string; entries: any[] }[] = [];
  let lastDate = "";
  for (const entry of filtered) {
    const dateLabel = new Date(entry.timestamp).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (dateLabel !== lastDate) {
      grouped.push({ dateLabel, entries: [] });
      lastDate = dateLabel;
    }
    grouped[grouped.length - 1].entries.push(entry);
  }

  const handleSendRefund = () => {
    navigate({ to: "/admin/refund-letters" });
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-4xl mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trial — Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological feed of every transaction event across all parties.
          </p>
        </header>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as JournalType)}>
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs">All Events</TabsTrigger>
            <TabsTrigger value="mundra_to_utcl" className="text-xs">Mundra → UTCL</TabsTrigger>
            <TabsTrigger value="utcl_to_client" className="text-xs">UTCL → Client</TabsTrigger>
            <TabsTrigger value="client_to_utcl" className="text-xs">Client → UTCL</TabsTrigger>
            <TabsTrigger value="utcl_to_mundra" className="text-xs">UTCL → Mundra</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Journal Feed */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No journal entries found for the selected filter.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.dateLabel}>
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {group.dateLabel}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Entries for this date */}
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
    </AppShell>
  );
}
