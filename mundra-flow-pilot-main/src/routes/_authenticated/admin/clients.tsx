import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  createClient,
  updateClientStatus,
  updateClientCommercials,
  updateClient,
} from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Building2, Plus, Loader2, MoreVertical, Ban, CheckCircle2, X } from "lucide-react";

function DeliveryLocationsBuilder({
  locations,
  setLocations,
}: {
  locations: any[];
  setLocations: any;
}) {
  const addLocation = () =>
    setLocations([
      ...locations,
      {
        label: "",
        address: "",
        isDefault: locations.length === 0,
        contactPerson: "",
        contactPhone: "",
      },
    ]);
  const updateLocation = (index: number, key: string, value: any) => {
    const newLocs = [...locations];
    if (key === "isDefault" && value === true) {
      newLocs.forEach((l) => (l.isDefault = false));
    }
    newLocs[index][key] = value;
    setLocations(newLocs);
  };
  const removeLocation = (index: number) => {
    const newLocs = locations.filter((_, i) => i !== index);
    if (locations[index].isDefault && newLocs.length > 0) {
      newLocs[0].isDefault = true;
    }
    setLocations(newLocs);
  };

  return (
    <div className="col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-sm">Delivery Locations</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLocation}>
          <Plus className="h-3 w-3 mr-1" /> Add More Location
        </Button>
      </div>
      {locations.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No delivery locations added. Add at least one if required.
        </p>
      )}
      {locations.map((loc, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border rounded-md relative bg-muted/20">
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Location Label (e.g. Site A) *</Label>
                <Input
                  value={loc.label}
                  onChange={(e) => updateLocation(i, "label", e.target.value)}
                  required
                  placeholder="e.g. Main Warehouse"
                />
              </div>
              <div className="flex items-end pb-2">
                <Label className="flex items-center gap-2 cursor-pointer text-xs bg-background border px-3 py-2 rounded-md">
                  <input
                    type="radio"
                    name="defaultLocationNew"
                    checked={loc.isDefault}
                    onChange={() => updateLocation(i, "isDefault", true)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  Set as Default
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full Address *</Label>
              <Textarea
                value={loc.address}
                onChange={(e) => updateLocation(i, "address", e.target.value)}
                required
                rows={2}
                placeholder="Enter full shipping address..."
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Contact Person *</Label>
                <Input
                  value={loc.contactPerson || ""}
                  onChange={(e) => updateLocation(i, "contactPerson", e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Contact Phone *</Label>
                <Input
                  value={loc.contactPhone || ""}
                  onChange={(e) =>
                    updateLocation(i, "contactPhone", e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="10-digit number"
                  maxLength={10}
                  required
                />
                {loc.contactPhone &&
                  loc.contactPhone.length > 0 &&
                  loc.contactPhone.length < 10 && (
                    <span className="text-[10px] text-destructive block">
                      Must be exactly 10 digits
                    </span>
                  )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive h-8 w-8 mt-5"
            onClick={() => removeLocation(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/clients")({
  ssr: false,
  component: AdminClientsPage,
});

function AdminClientsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [clientToUpdateStatus, setClientToUpdateStatus] = useState<any | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [targetStatus, setTargetStatus] = useState<"active" | "suspended">("active");

  // Form states for onboarding
  const [legalName, setLegalName] = useState("");
  const [shortName, setShortName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");

  const [creditLimit, setCreditLimit] = useState<number | "">("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | "">("");
  const [gracePeriodDays, setGracePeriodDays] = useState<number | "">("");
  const [includeUndispatched, setIncludeUndispatched] = useState(false);
  const [includeDispatched, setIncludeDispatched] = useState(true);
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [restrictions, setRestrictions] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState<number | "">("");
  const [deliveryLocations, setDeliveryLocations] = useState<
    {
      id?: string;
      label: string;
      address: string;
      isDefault: boolean;
      contactPerson?: string;
      contactPhone?: string;
    }[]
  >([{ label: "", address: "", isDefault: true, contactPerson: "", contactPhone: "" }]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const createMutation = useMutation({
    mutationFn: (newClient: any) => createClient({ data: newClient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Client organization onboarded successfully!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to onboard client");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (data: any) => updateClientStatus({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Client status updated!");
      setStatusModalOpen(false);
      setStatusReason("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update status");
    },
  });

  const commercialsMutation = useMutation({
    mutationFn: (data: any) => updateClientCommercials({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Commercial terms updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update terms");
    },
  });

  const updateMasterMutation = useMutation({
    mutationFn: (data: any) => updateClient({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client details updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update client");
    },
  });

  function resetForm() {
    setLegalName("");
    setShortName("");
    setTradeName("");
    setGstNumber("");
    setPanNumber("");
    setBillingAddress("");
    setPrimaryContactName("");
    setPrimaryContactEmail("");
    setPrimaryContactPhone("");
    setCreditLimit(0);
    setPaymentTermsDays(30);
    setGracePeriodDays(0);
    setIncludeUndispatched(false);
    setIncludeDispatched(true);
    setIncludeInvoices(true);
    setRestrictions("");
    setCommissionPercentage("");
    setDeliveryLocations([
      { label: "", address: "", isDefault: true, contactPerson: "", contactPhone: "" },
    ]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      legalName,
      shortName,
      tradeName,
      gstNumber,
      panNumber,
      billingAddress,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      creditLimit: creditLimit === "" ? 0 : creditLimit,
      paymentTermsDays: paymentTermsDays === "" ? 30 : paymentTermsDays,
      gracePeriodDays: gracePeriodDays === "" ? 0 : gracePeriodDays,
      includeUndispatchedPos: includeUndispatched,
      includeDispatchedUnbilled: includeDispatched,
      includeUnpaidInvoices: includeInvoices,
      restrictions,
      commissionPercentage: commissionPercentage === "" ? null : Number(commissionPercentage),
      deliveryLocations: deliveryLocations.map((l) => ({ ...l, isDefault: !!l.isDefault })),
    });
  }

  function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (clientToUpdateStatus) {
      statusMutation.mutate({
        organizationId: clientToUpdateStatus.id,
        status: targetStatus,
        reason: statusReason,
      });
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Client Directory</h1>
            <p className="text-sm text-muted-foreground">
              Manage client organizations, commercial credit limits, and exposure rules.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Onboard Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Onboard Client Organization</DialogTitle>
                  <DialogDescription>
                    Configure identity and commercial terms for the new tenant.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Master Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Master Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Legal Name *</Label>
                        <Input
                          value={legalName}
                          onChange={(e) => setLegalName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trade / Short Name</Label>
                        <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>GST Number</Label>
                        <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>PAN Number</Label>
                        <Input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* Contact & Billing */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Contact & Billing</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Primary Contact Name</Label>
                        <Input
                          value={primaryContactName}
                          onChange={(e) => setPrimaryContactName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Primary Contact Email</Label>
                        <Input
                          type="email"
                          value={primaryContactEmail}
                          onChange={(e) => setPrimaryContactEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Whatsapp / Contact Number</Label>
                        <Input
                          type="tel"
                          pattern="[0-9]{10}"
                          maxLength={10}
                          title="Please enter exactly 10 digits"
                          value={primaryContactPhone}
                          onChange={(e) =>
                            setPrimaryContactPhone(e.target.value.replace(/\D/g, ""))
                          }
                        />
                        {primaryContactPhone &&
                          primaryContactPhone.length > 0 &&
                          primaryContactPhone.length < 10 && (
                            <span className="text-[10px] text-destructive block mt-1">
                              Must be exactly 10 digits
                            </span>
                          )}
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Billing Address</Label>
                        <Textarea
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 pt-2">
                        <DeliveryLocationsBuilder
                          locations={deliveryLocations}
                          setLocations={setDeliveryLocations}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* Commercials */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Commercial Terms</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Credit Limit *</Label>
                        <Input
                          type="number"
                          value={creditLimit}
                          onChange={(e) =>
                            setCreditLimit(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Terms (Days) *</Label>
                        <Input
                          type="number"
                          value={paymentTermsDays}
                          onChange={(e) =>
                            setPaymentTermsDays(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Grace (Days)</Label>
                        <Input
                          type="number"
                          value={gracePeriodDays}
                          onChange={(e) =>
                            setGracePeriodDays(e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Commission (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={commissionPercentage}
                          onChange={(e) =>
                            setCommissionPercentage(
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3 mt-4 border p-4 rounded-md">
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground">
                        Exposure Rules
                      </h5>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Include Undispatched POs</Label>
                        <Switch
                          checked={includeUndispatched}
                          onCheckedChange={setIncludeUndispatched}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Include Dispatched Unbilled</Label>
                        <Switch
                          checked={includeDispatched}
                          onCheckedChange={setIncludeDispatched}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Include Unpaid Invoices</Label>
                        <Switch checked={includeInvoices} onCheckedChange={setIncludeInvoices} />
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Legal Name</TableHead>
                    <TableHead>Trade / Short Name</TableHead>
                    <TableHead>GST Number</TableHead>
                    <TableHead>Sanctioned Limit</TableHead>
                    <TableHead>Available Credit</TableHead>
                    <TableHead>Exposure</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients && clients.length > 0 ? (
                    clients.map((client: any) => {
                      const comm = client.client_commercial_profile || {};
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {client.legal_name}
                            </div>
                          </TableCell>
                          <TableCell>{client.trade_name || client.short_name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {client.gst_number ?? "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(comm.credit_limit ?? 0)}
                          </TableCell>
                          <TableCell className="font-semibold text-success">
                            {formatCurrency(comm.available_credit ?? comm.credit_limit ?? 0)}
                          </TableCell>
                          <TableCell className="font-semibold text-destructive">
                            {formatCurrency(comm.current_exposure ?? 0)}
                          </TableCell>
                          <TableCell>{comm.payment_terms_days ?? 30} Days</TableCell>
                          <TableCell>
                            <Badge
                              variant={client.status === "active" ? "default" : "destructive"}
                              className="capitalize"
                            >
                              {client.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedClient(client)}
                              >
                                Details
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {client.status === "active" ? (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setClientToUpdateStatus(client);
                                        setTargetStatus("suspended");
                                        setStatusModalOpen(true);
                                      }}
                                    >
                                      <Ban className="h-4 w-4 mr-2" /> Suspend
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setClientToUpdateStatus(client);
                                        setTargetStatus("active");
                                        setStatusModalOpen(true);
                                      }}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No clients onboarded yet. Click "Onboard Client" to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Details Sheet */}
        <Sheet open={!!selectedClient} onOpenChange={(o) => !o && setSelectedClient(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {selectedClient && (
              <ClientDetailsForm
                client={selectedClient}
                onClose={() => setSelectedClient(null)}
                mutation={commercialsMutation}
                masterMutation={updateMasterMutation}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Status Update Modal */}
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent>
            <form onSubmit={handleStatusUpdate}>
              <DialogHeader>
                <DialogTitle>
                  {targetStatus === "suspended" ? "Suspend Client" : "Reactivate Client"}
                </DialogTitle>
                <DialogDescription>
                  Please provide a reason for changing the status of{" "}
                  {clientToUpdateStatus?.legal_name}.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Enter reason..."
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStatusModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={targetStatus === "suspended" ? "destructive" : "default"}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function ClientDetailsForm({
  client,
  onClose,
  mutation,
  masterMutation,
}: {
  client: any;
  onClose: () => void;
  mutation: any;
  masterMutation: any;
}) {
  const comm = client.client_commercial_profile || {};

  const [cl, setCl] = useState<number | "">(comm.credit_limit || "");
  const [pt, setPt] = useState<number | "">(comm.payment_terms_days || "");
  const [gp, setGp] = useState<number | "">(comm.grace_period_days || "");
  const [undispatched, setUndispatched] = useState(comm.include_undispatched_pos || false);
  const [dispatched, setDispatched] = useState(comm.include_dispatched_unbilled !== false);
  const [unpaid, setUnpaid] = useState(comm.include_unpaid_invoices !== false);
  const [rest, setRest] = useState(comm.restrictions || "");
  const [commPerc, setCommPerc] = useState<number | "">(comm.commission_percentage ?? "");

  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [mLegal, setMLegal] = useState(client.legal_name || "");
  const [mShort, setMShort] = useState(client.short_name || "");
  const [mTrade, setMTrade] = useState(client.trade_name || "");
  const [mGst, setMGst] = useState(client.gst_number || "");
  const [mPan, setMPan] = useState(client.pan_number || "");
  const [mBilling, setMBilling] = useState(client.billing_address || "");
  const [mContactName, setMContactName] = useState(client.primary_contact_name || "");
  const [mContactEmail, setMContactEmail] = useState(client.primary_contact_email || "");
  const [mContactPhone, setMContactPhone] = useState(client.primary_contact_phone || "");
  const [mDeliveryLocations, setMDeliveryLocations] = useState<
    {
      id?: string;
      label: string;
      address: string;
      isDefault: boolean;
      contactPerson?: string;
      contactPhone?: string;
    }[]
  >(
    client.delivery_locations?.map((l: any) => ({
      ...l,
      isDefault: l.is_default,
      contactPerson: l.contact_person,
      contactPhone: l.contact_phone,
    })) || [],
  );

  useEffect(() => {
    setMLegal(client.legal_name || "");
    setMShort(client.short_name || "");
    setMTrade(client.trade_name || "");
    setMGst(client.gst_number || "");
    setMPan(client.pan_number || "");
    setMBilling(client.billing_address || "");
    setMContactName(client.primary_contact_name || "");
    setMContactEmail(client.primary_contact_email || "");
    setMContactPhone(client.primary_contact_phone || "");
    setMDeliveryLocations(
      client.delivery_locations?.map((l: any) => ({
        ...l,
        isDefault: l.is_default,
        contactPerson: l.contact_person,
        contactPhone: l.contact_phone,
      })) || [],
    );
  }, [client]);

  const handleSave = () => {
    mutation.mutate({
      organizationId: client.id,
      creditLimit: cl === "" ? 0 : cl,
      paymentTermsDays: pt === "" ? 30 : pt,
      gracePeriodDays: gp === "" ? 0 : gp,
      includeUndispatchedPos: undispatched,
      includeDispatchedUnbilled: dispatched,
      includeUnpaidInvoices: unpaid,
      restrictions: rest,
      commissionPercentage: commPerc === "" ? null : Number(commPerc),
    });
  };

  const handleSaveMaster = () => {
    masterMutation.mutate(
      {
        organizationId: client.id,
        legalName: mLegal,
        shortName: mShort,
        tradeName: mTrade,
        gstNumber: mGst,
        panNumber: mPan,
        billingAddress: mBilling,
        primaryContactName: mContactName,
        primaryContactEmail: mContactEmail,
        primaryContactPhone: mContactPhone,
        deliveryLocations: mDeliveryLocations.map((l) => ({ ...l, isDefault: !!l.isDefault })),
      },
      {
        onSuccess: () => setIsEditingMaster(false),
      },
    );
  };

  return (
    <>
      <SheetHeader className="mb-6">
        <SheetTitle>{client.legal_name}</SheetTitle>
        <SheetDescription>
          {client.gst_number ? `GST: ${client.gst_number}` : "No GST configured"} | Status:{" "}
          <span className="capitalize">{client.status}</span>
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="overview">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="overview" className="flex-1">
            Overview
          </TabsTrigger>
          <TabsTrigger value="commercials" className="flex-1">
            Commercials
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            Credit History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex justify-between items-center mb-2 border-b pb-2">
            <h4 className="font-semibold text-sm">Overview Details</h4>
            <Button variant="ghost" size="sm" onClick={() => setIsEditingMaster(!isEditingMaster)}>
              {isEditingMaster ? "Cancel Edit" : "Edit ✏️"}
            </Button>
          </div>

          {isEditingMaster ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input value={mLegal} onChange={(e) => setMLegal(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trade Name</Label>
                  <Input value={mTrade} onChange={(e) => setMTrade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Short Name</Label>
                  <Input value={mShort} onChange={(e) => setMShort(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input value={mGst} onChange={(e) => setMGst(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>PAN Number</Label>
                  <Input value={mPan} onChange={(e) => setMPan(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Billing Address</Label>
                  <Textarea value={mBilling} onChange={(e) => setMBilling(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={mContactName} onChange={(e) => setMContactName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={mContactEmail}
                    onChange={(e) => setMContactEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Whatsapp / Contact Number</Label>
                  <Input
                    type="tel"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    title="Please enter exactly 10 digits"
                    value={mContactPhone}
                    onChange={(e) => setMContactPhone(e.target.value.replace(/\D/g, ""))}
                  />
                  {mContactPhone && mContactPhone.length > 0 && mContactPhone.length < 10 && (
                    <span className="text-[10px] text-destructive block mt-1">
                      Must be exactly 10 digits
                    </span>
                  )}
                </div>

                <div className="col-span-2 pt-2 border-t mt-2">
                  <DeliveryLocationsBuilder
                    locations={mDeliveryLocations}
                    setLocations={setMDeliveryLocations}
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveMaster}
                className="w-full"
                disabled={masterMutation.isPending}
              >
                {masterMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                Details
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Trade Name</p>
                <p>{client.trade_name || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">PAN</p>
                <p>{client.pan_number || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="font-semibold text-muted-foreground">Billing Address</p>
                <p>{client.billing_address || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Contact Name</p>
                <p>{client.primary_contact_name || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Contact Details</p>
                <p>
                  {client.primary_contact_email}{" "}
                  {client.primary_contact_phone && `| ${client.primary_contact_phone}`}
                </p>
              </div>
            </div>
          )}

          {client.status_reason && (
            <div className="p-3 bg-muted rounded-md text-sm border">
              <span className="font-semibold">Status Reason:</span> {client.status_reason}
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-2 text-sm border-b pb-2">Delivery Locations</h4>
            {client.delivery_locations?.length > 0 ? (
              <ul className="space-y-2 text-sm mt-2">
                {client.delivery_locations.map((loc: any) => (
                  <li
                    key={loc.id}
                    className="p-3 border rounded-md bg-muted/20 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold block">{loc.label}</span>
                      {loc.is_default && (
                        <Badge variant="outline" className="text-[10px] uppercase bg-background">
                          Default
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground whitespace-pre-wrap">{loc.address}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic mt-2">No locations configured.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="commercials" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Credit Limit (₹)</Label>
              <Input
                type="number"
                value={cl}
                onChange={(e) => setCl(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Terms (Days)</Label>
              <Input
                type="number"
                value={pt}
                onChange={(e) => setPt(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Grace (Days)</Label>
              <Input
                type="number"
                value={gp}
                onChange={(e) => setGp(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Commission (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={commPerc}
                onChange={(e) => setCommPerc(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-4 border rounded-lg p-4">
            <h4 className="font-semibold text-sm">Exposure Rules</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Undispatched POs</Label>
                <p className="text-xs text-muted-foreground">
                  Count approved PO quantity minus dispatched quantity
                </p>
              </div>
              <Switch checked={undispatched} onCheckedChange={setUndispatched} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Dispatched Unbilled</Label>
                <p className="text-xs text-muted-foreground">Count active dispatch requests</p>
              </div>
              <Switch checked={dispatched} onCheckedChange={setDispatched} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Unpaid Invoices</Label>
                <p className="text-xs text-muted-foreground">
                  Count outstanding generated invoices
                </p>
              </div>
              <Switch checked={unpaid} onCheckedChange={setUnpaid} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account Restrictions / Notes</Label>
            <Textarea
              value={rest}
              onChange={(e) => setRest(e.target.value)}
              placeholder="Any special instructions or constraints..."
            />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Commercial Terms
          </Button>
        </TabsContent>

        <TabsContent value="history">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective Date</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.credit_history?.length > 0 ? (
                client.credit_history.map((hist: any) => (
                  <TableRow key={hist.id}>
                    <TableCell>{new Date(hist.effective_from).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{hist.credit_limit.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground italic">
                    No history available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </>
  );
}
