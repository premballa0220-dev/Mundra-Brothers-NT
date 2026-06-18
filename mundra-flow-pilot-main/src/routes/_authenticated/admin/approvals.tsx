import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingUsers, approveUser, rejectUser } from "@/lib/api/auth.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserCheck, UserX, Loader2, Users, ShieldCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  ssr: false,
  component: AdminUserApprovalsPage,
});

function AdminUserApprovalsPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-pending-users"],
    queryFn: () => getPendingUsers(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ userId, roleType }: { userId: string, roleType: 'admin' | 'client' }) => approveUser({ data: { userId, roleType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-users"] });
      toast.success("User approved successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to approve user");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => rejectUser({ data: { userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-users"] });
      toast.success("User rejected and removed.");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to reject user");
    },
  });

  const pendingUsers = (users ?? []).filter((u: any) => !u.approved);
  const approvedUsers = (users ?? []).filter((u: any) => u.approved);

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">User Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve new user registrations. Approved users gain full administrator access to the platform.
          </p>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <div className="stat-card-label flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Pending Approval
            </div>
            <div className="stat-card-value text-warning">{pendingUsers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Approved
            </div>
            <div className="stat-card-value text-success">{approvedUsers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Total Users
            </div>
            <div className="stat-card-value">{(users ?? []).length}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pending Users */}
            <Card className={pendingUsers.length > 0 ? "border-warning/40" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <CardTitle className="text-base font-semibold">Pending Approval</CardTitle>
                  {pendingUsers.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{pendingUsers.length}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.length > 0 ? (
                      pendingUsers.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.fullName || <span className="text-muted-foreground italic">Not provided</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{user.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate({ userId: user.id, roleType: 'admin' })}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                variant="outline"
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="mr-1 h-3.5 w-3.5" />
                                )}
                                Approve Admin
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate({ userId: user.id, roleType: 'client' })}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="mr-1 h-3.5 w-3.5" />
                                )}
                                Approve Client
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectMutation.mutate(user.id)}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                              >
                                {rejectMutation.isPending ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserX className="mr-1 h-3.5 w-3.5" />
                                )}
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-success" />
                            No pending approvals. All users are approved.
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Approved Users */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <CardTitle className="text-base font-semibold">Approved Users</CardTitle>
                  <Badge variant="secondary" className="ml-1">{approvedUsers.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.length > 0 ? (
                      approvedUsers.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.fullName || <span className="text-muted-foreground italic">Not provided</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize text-[10px]">
                              {Array.isArray(user.roles) ? user.roles.join(", ").replace(/_/g, " ") : "admin"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(user.id)}
                              disabled={rejectMutation.isPending}
                            >
                              {rejectMutation.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserX className="mr-1 h-3.5 w-3.5" />
                              )}
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          No approved users yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
