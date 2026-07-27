import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { clearAccessToken } from "@/integrations/auth/client";
import { signOut } from "@/lib/api/auth.functions";
import { useSessionContext, ROLE_LABELS, type SessionContext } from "@/lib/auth-hooks";
import {
  LayoutDashboard,
  FileText,
  Truck,
  Wallet,
  BookOpenCheck,
  Building2,
  Boxes,
  Tags,
  ShieldAlert,
  Bell,
  History,
  Files,
  Users,
  BarChart3,
  LogOut,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  deleteNotification,
} from "@/lib/api/business.functions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const CLIENT_NAV: NavItem[] = [
  { to: "/client", label: "Dashboard", icon: LayoutDashboard },
  { to: "/client/purchase-orders", label: "Purchase Orders", icon: FileText },
  { to: "/client/dispatches", label: "Dispatches", icon: Truck },
  { to: "/client/payments", label: "Payments", icon: Wallet },
  { to: "/client/ledgers", label: "Ledgers & Compliance", icon: BookOpenCheck },
  { to: "/client/balance-confirmations", label: "Balance Confirmations", icon: FileText },
  { to: "/client/documents", label: "Documents", icon: Files },
  { to: "/client/users", label: "My Team", icon: Users },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/clients", label: "Client Master", icon: Building2 },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/rates", label: "Rate Master", icon: Tags },
  { to: "/admin/po-queue", label: "PO Queue", icon: FileText },
  { to: "/admin/po-formats", label: "PO Formats", icon: FileText },
  { to: "/admin/dispatch-queue", label: "Dispatch Queue", icon: Truck },
  { to: "/admin/payments", label: "Payments & Refunds", icon: Wallet },
  { to: "/admin/refund-letters", label: "Balance Confirmations", icon: Files },
  { to: "/admin/balance-confirmations", label: "Refund Letters", icon: BookOpenCheck },
  { to: "/admin/approvals", label: "User Approvals", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/audit", label: "Audit Trail", icon: History },
  { to: "/admin/settings", label: "Platform Settings", icon: Settings2 },
];

export function AppShell({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "client" | "admin";
}) {
  const nav = variant === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const { data: session, isLoading } = useSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    enabled: !!session,
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      await signOut();
    } catch {
      // ignore sign out failure and clear client state anyway
    }
    clearAccessToken();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
            M
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Mundra Brothers</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
              {variant === "admin" ? "Admin Console" : "Client Portal"}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to ||
              (item.to !== `/${variant}` && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/55">
          v0.1 · Build foundation
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {isLoading || !session ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <>
                <span className="text-sm font-medium truncate">{session.organizationName}</span>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {session.orgType === "mundra" ? "Operator" : "Client Org"}
                </Badge>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {session && <NotificationsMenu notifications={notifications || []} />}
            {session && <UserMenu session={session} onSignOut={handleSignOut} />}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ session, onSignOut }: { session: SessionContext; onSignOut: () => void }) {
  const initials = (session.fullName ?? session.email)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md hover:bg-accent px-2 py-1.5">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium">{session.fullName ?? session.email}</span>
          <span className="text-[11px] text-muted-foreground">
            {session.roles[0] ? ROLE_LABELS[session.roles[0]] : "No role assigned"}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="font-medium">{session.fullName ?? session.email}</div>
          <div className="text-xs text-muted-foreground">{session.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Roles
        </DropdownMenuLabel>
        {session.roles.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No roles. Contact your administrator.
          </div>
        ) : (
          session.roles.map((r) => (
            <div key={r} className="px-2 py-1 text-xs">
              {ROLE_LABELS[r]}
            </div>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsMenu({ notifications }: { notifications: any[] }) {
  const queryClient = useQueryClient();
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <span className="text-xs text-muted-foreground font-normal">{unreadCount} unread</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No notifications in the last 40 days.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 border-b last:border-0 relative ${notif.is_read ? "opacity-70" : "bg-primary/5"}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    if (!notif.is_read) markReadMutation.mutate(notif.id);
                  }}
                >
                  <h4 className="text-sm font-semibold">{notif.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground block mt-2">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(notif.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                  title="Remove notification permanently"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
