import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/api/business.functions";
import { Loader2 } from "lucide-react";
import {
  Building2,
  FileText,
  Truck,
  Wallet,
  BookOpenCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Activity,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminDashboard,
});

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

// PORTFOLIO and QUEUES will be loaded dynamically
const ALERTS = [
  { type: "danger", text: "3 special approvals expire in <48h", href: "/admin/approvals" },
  { type: "warning", text: "Reliance Cement Co. — Q1 balance confirmation cutoff in 2 days", href: "/admin/balance-confirmations" },
  { type: "warning", text: "Payment verification SLA breach: 4 items >24h", href: "/admin/payments" },
];function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  if (isLoading) {
    return (
      <AppShell variant="admin">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const PORTFOLIO = data?.portfolio || {
    activeClients: 0,
    sanctionedCredit: 0,
    recognizedExposure: 0,
    availableCredit: 0,
    overdueClients: 0,
    overdue90Plus: 0,
  };

  const QUEUES = data?.queues || {
    posPending: 0,
    posBlocked: 0,
    dispatchPending: 0,
    paymentsUnderVerification: 0,
    refundLettersPending: 0,
    balanceConfPending: 0,
    specialApprovalsActive: 0,
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Operations control</h1>
            <p className="text-sm text-muted-foreground">
              Portfolio health, open task queues and exceptions across all client organisations.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-success" />
            All systems operational
          </div>
        </header>

        {/* Portfolio */}
        <section>
          <SectionTitle>Portfolio</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Stat label="Active Clients" value={PORTFOLIO.activeClients.toString()} icon={Building2} />
            <Stat label="Sanctioned Credit" value={`₹${INR(PORTFOLIO.sanctionedCredit)}`} />
            <Stat label="Recognised Exposure" value={`₹${INR(PORTFOLIO.recognizedExposure)}`} />
            <Stat label="Available Credit" value={`₹${INR(PORTFOLIO.availableCredit)}`} tone="success" />
            <Stat
              label="Clients with Overdue"
              value={PORTFOLIO.overdueClients.toString()}
              tone={PORTFOLIO.overdueClients > 0 ? "warning" : "default"}
            />
            <Stat
              label="Overdue Outstanding"
              value={`₹${INR(PORTFOLIO.overdue90Plus)}`}
              tone="danger"
            />
          </div>
        </section>

        {/* Queues */}
        <section>
          <SectionTitle>Task queues</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QueueCard
              icon={FileText}
              label="POs"
              metrics={[
                { l: "Pending", v: QUEUES.posPending },
                { l: "Blocked", v: QUEUES.posBlocked, tone: "danger" },
              ]}
              href="/admin/po-queue"
            />
            <QueueCard
              icon={Truck}
              label="Dispatches"
              metrics={[{ l: "Awaiting review", v: QUEUES.dispatchPending, tone: "warning" }]}
              href="/admin/dispatch-queue"
            />
            <QueueCard
              icon={Wallet}
              label="Payments & refunds"
              metrics={[
                { l: "Under verification", v: QUEUES.paymentsUnderVerification, tone: "warning" },
                { l: "Refund letters", v: QUEUES.refundLettersPending },
              ]}
              href="/admin/payments"
            />
            <QueueCard
              icon={BookOpenCheck}
              label="Balance confirmations"
              metrics={[{ l: "Pending/overdue", v: QUEUES.balanceConfPending, tone: "warning" }]}
              href="/admin/balance-confirmations"
            />
          </div>
        </section>

        {/* Alerts + exceptions */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <CardTitle className="text-base">Audit & SLA alerts</CardTitle>
                <Badge variant="secondary" className="ml-1">{ALERTS.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ALERTS.map((a, i) => (
                  <Link
                    key={i}
                    to={a.href}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-accent text-sm"
                  >
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (a.type === "danger" ? "bg-destructive" : "bg-warning")
                      }
                    />
                    <span className="flex-1">{a.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
                {ALERTS.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    No active alerts.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Special approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-semibold tabular-nums">
                  {QUEUES.specialApprovalsActive}
                </span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Scoped exceptions in force. Review before they exhaust or expire.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/admin/approvals">Open register</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
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
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: typeof FileText;
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
      <div className="stat-card-label flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`stat-card-value ${toneClass}`}>{value}</div>
    </div>
  );
}

function QueueCard({
  icon: Icon,
  label,
  metrics,
  href,
}: {
  icon: typeof FileText;
  label: string;
  metrics: { l: string; v: number; tone?: "warning" | "danger" }[];
  href: string;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </div>
          <Link to={href} className="text-xs text-muted-foreground hover:text-foreground">
            View
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m, i) => {
            const toneClass =
              m.tone === "danger"
                ? "text-destructive"
                : m.tone === "warning"
                  ? "text-warning"
                  : "";
            return (
              <div key={i}>
                <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{m.v}</div>
                <div className="text-[11px] text-muted-foreground">{m.l}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
