import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Loader2, ShieldAlert, CheckCircle, Clock, UserPlus } from "lucide-react";
import { getOrganizationUsers, createClientUser } from "@/lib/api/auth.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/client/users")({
  ssr: false,
  component: ClientUsersPage,
});

function ClientUsersPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["client_users"],
    queryFn: () => getOrganizationUsers(),
  });

  const users = usersQuery.data || [];
  const approvedUsers = users.filter((u: any) => u.approvalStatus === "approved" && u.isActive);
  const pendingUsers = users.filter((u: any) => u.approvalStatus === "pending");

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Team</h1>
            <p className="text-sm text-muted-foreground">
              Manage your organization's users. New team members require Mundra admin approval.
            </p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <AddUserForm onSuccess={() => setShowForm(false)} />
            </DialogContent>
          </Dialog>
        </header>

        {/* Stats */}
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
              <CheckCircle className="h-3 w-3" />
              Active Members
            </div>
            <div className="stat-card-value text-success">{approvedUsers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Total
            </div>
            <div className="stat-card-value">{users.length}</div>
          </div>
        </div>

        {/* Pending Users */}
        {pendingUsers.length > 0 && (
          <Card className="border-warning/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <CardTitle className="text-base font-semibold">Awaiting Mundra Admin Approval</CardTitle>
                <Badge variant="secondary" className="ml-1">{pendingUsers.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullName || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r: string) => (
                            <Badge key={r} variant="outline" className="text-[10px] capitalize">
                              {formatRole(r)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Active Team Members */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <CardTitle className="text-base font-semibold">Active Team Members</CardTitle>
              <Badge variant="secondary" className="ml-1">{approvedUsers.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {usersQuery.isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.length > 0 ? (
                    approvedUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{user.email}</TableCell>
                        <TableCell>{user.phone || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((r: string) => (
                              <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                                {formatRole(r)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-6 w-6 opacity-40" />
                          No active team members yet. Add your first user above.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function AddUserForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "client_readonly",
  });

  const mutation = useMutation({
    mutationFn: () => createClientUser({ data: formData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_users"] });
      setFormData({ email: "", password: "", fullName: "", phone: "", role: "client_readonly" });
      toast.success("User added! Awaiting Mundra Admin approval.");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create user");
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <DialogHeader>
        <DialogTitle>Add New Team Member</DialogTitle>
        <DialogDescription>
          New users will need Mundra admin approval before they can log in.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="add-email" className="text-right">Email *</Label>
          <Input
            id="add-email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="col-span-3"
            placeholder="user@company.com"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="add-password" className="text-right">Password *</Label>
          <Input
            id="add-password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="col-span-3"
            placeholder="Minimum 8 characters"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="add-name" className="text-right">Full Name *</Label>
          <Input
            id="add-name"
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="col-span-3"
            placeholder="John Doe"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="add-phone" className="text-right">Phone</Label>
          <Input
            id="add-phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="col-span-3"
            placeholder="+91 XXXXX XXXXX"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Role *</Label>
          <div className="col-span-3">
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_admin">Client Organization Admin</SelectItem>
                <SelectItem value="client_po_maker">Client PO Maker</SelectItem>
                <SelectItem value="client_po_approver">Client PO Approver</SelectItem>
                <SelectItem value="client_payment_maker">Client Payment Maker</SelectItem>
                <SelectItem value="client_payment_approver">Client Payment Approver</SelectItem>
                <SelectItem value="client_accounts">Client Accounts / Ledger User</SelectItem>
                <SelectItem value="client_readonly">Client Read Only User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending || !formData.email || !formData.password || !formData.fullName}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add User (Pending Approval)
        </Button>
      </DialogFooter>
    </form>
  );
}

function formatRole(role: string) {
  return role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
