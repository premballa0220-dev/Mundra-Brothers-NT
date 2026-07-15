import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/api/business.functions";
import { Loader2 } from "lucide-react";
import {
  AlertTriangle,
  FileText,
  Truck,
  Wallet,
  Upload,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/")({
  ssr: false,
  component: ClientDashboard,
});

const INR = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

// Financials, operations, and blocks will be loaded dynamically

function ClientDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["client-dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  if (isLoading) {
    return (
      <AppShell variant="client">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const FIN = data?.financials || {
    creditLimit: 0,
    utilizedExposure: 0,
    outstanding: 0,
    overdue: 0,
    oldestOverdueDays: 0,
  };

  const OPS = data?.operations || {
    activePOs: 0,
    pendingPoQty: 0,
    dispatchedQty: 0,
    pendingPaymentApprovals: 0,
    pendingBalanceConfirmations: 0,
  };

  const BLOCKS = data?.blockedDispatches || [];

  const available = FIN.creditLimit - FIN.utilizedExposure;
  const creditLimitPct = FIN.creditLimit > 0 ? Math.round((available / FIN.creditLimit) * 100) : 0;

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Operations dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Live view of credit, dispatches and compliance actions awaiting you.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/client/payments">
                <Wallet className="h-4 w-4 mr-2" /> Report Payment
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/client/dispatches">
                <Truck className="h-4 w-4 mr-2" /> Request Dispatch
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/client/purchase-orders">
                <FileText className="h-4 w-4 mr-2" /> New PO
              </Link>
            </Button>
          </div>
        </header>

        {/* Financial row */}
        <section>
          <SectionTitle>Credit & Exposure</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat
              label="Approved Credit Limit"
              value={`₹${INR(FIN.creditLimit)}`}
              meta="Sanctioned"
            />
            <Stat
              label="Utilized Exposure"
              value={`₹${INR(FIN.utilizedExposure)}`}
              meta="Recognised"
            />
            <Stat
              label="Available Credit"
              value={`₹${INR(available)}`}
              tone={available < FIN.creditLimit * 0.15 ? "warning" : "success"}
              meta={`${creditLimitPct}% of limit`}
            />
            <Stat
              label="Outstanding"
              value={`₹${INR(FIN.outstanding)}`}
              meta="Per approved ledger"
            />
            <Stat
              label="Overdue"
              value={`₹${INR(FIN.overdue)}`}
              tone={FIN.overdue > 0 ? "danger" : "default"}
              meta={`Oldest ${FIN.oldestOverdueDays} days`}
            />
          </div>
        </section>

        {/* Operations row */}
        <section>
          <SectionTitle>POs & Dispatch</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Active POs" value={OPS.activePOs.toString()} meta="Open commercially" />
            <Stat label="Dispatched Qty" value={`${INR(OPS.dispatchedQty)} MT`} meta="MTD" />
            <Stat
              label="Pending PO Qty"
              value={`${INR(OPS.pendingPoQty)} MT`}
              meta="Undelivered balance"
            />
            <Stat
              label="Payment Approvals"
              value={OPS.pendingPaymentApprovals.toString()}
              meta="Awaiting verification"
              tone={OPS.pendingPaymentApprovals > 0 ? "warning" : "default"}
            />
            <Stat
              label="Balance Confirmations"
              value={OPS.pendingBalanceConfirmations.toString()}
              meta="Pending upload"
              tone={OPS.pendingBalanceConfirmations > 0 ? "warning" : "default"}
            />
          </div>
        </section>

        {/* Blocks + Quick actions */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <CardTitle className="text-base">Blocked dispatches</CardTitle>
                <Badge variant="destructive" className="ml-1">
                  {BLOCKS.length}
                </Badge>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/client/dispatches">
                  View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {BLOCKS.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{b.id.slice(0, 8)}
                        </span>
                        <span className="text-sm font-medium">{b.po}</span>
                        <Badge variant="outline" className="text-[10px] truncate max-w-[150px]">
                          {b.site}
                        </Badge>
                      </div>
                      <div className="text-sm text-destructive mt-0.5">{b.reason}</div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/client/dispatches">Resolve</Link>
                    </Button>
                  </div>
                ))}
                {BLOCKS.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    No dispatches are blocked.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction icon={FileText} title="Create new PO" href="/client/purchase-orders" />
              <QuickAction icon={Truck} title="Request dispatch" href="/client/dispatches" />
              <QuickAction icon={Wallet} title="Report payment" href="/client/payments" />
              <QuickAction
                icon={Upload}
                title="Upload signed balance confirmation"
                href="/client/ledgers"
              />
              <QuickAction
                icon={ShieldAlert}
                title="Request special approval"
                href="/client/purchase-orders"
              />
            </CardContent>
          </Card>
        </div>

        {/* Compliance reminder */}
        {OPS.pendingBalanceConfirmations > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Clock className="h-4 w-4 text-warning" />
              <div className="text-sm">
                <span className="font-medium">Quarterly balance confirmation is due</span> — please
                upload the signed PDF to avoid automated dispatch blockages.
              </div>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to="/client/ledgers">Open Ledgers</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  meta,
  tone = "default",
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "";
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className={`stat-card-value ${toneClass}`}>{value}</div>
      {meta && <div className="stat-card-meta">{meta}</div>}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof FileText;
  title: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="flex-1">{title}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
