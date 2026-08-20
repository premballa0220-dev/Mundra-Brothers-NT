import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  createClient,
  updateClientStatus,
  updateClientCommercials,
  updateClient,
  createOpeningBalance,
  cancelOpeningBalanceAction,
  deleteClientAdmin
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
import { Building2, Plus, Loader2, MoreVertical, Ban, CheckCircle2, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

function BillingProfilesBuilder({
  profiles,
  setProfiles,
}: {
  profiles: any[];
  setProfiles: any;
}) {
  const addProfile = () =>
    setProfiles([
      ...profiles,
      {
        gstNumber: "",
        billingAddress: "",
        isDefault: profiles.length === 0,
      },
    ]);
  const updateProfile = (index: number, key: string, value: any) => {
    const newProfiles = [...profiles];
    if (key === "isDefault" && value === true) {
      newProfiles.forEach((p) => (p.isDefault = false));
    }
    newProfiles[index][key] = value;
    setProfiles(newProfiles);
  };
  const removeProfile = (index: number) => {
    const newProfiles = profiles.filter((_, i) => i !== index);
    if (profiles[index].isDefault && newProfiles.length > 0) {
      newProfiles[0].isDefault = true;
    }
    setProfiles(newProfiles);
  };

  return (
    <div className="col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-sm">GST & Billing Profiles</Label>
        <Button type="button" variant="outline" size="sm" onClick={addProfile}>
          <Plus className="h-3 w-3 mr-1" /> Add Billing Profile
        </Button>
      </div>
      {profiles.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No billing profiles added. You must add at least one to generate POs.
        </p>
      )}
      {profiles.map((profile, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border rounded-md relative bg-muted/10">
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">GST Number *</Label>
                <Input
                  value={profile.gstNumber}
                  onChange={(e) => updateProfile(i, "gstNumber", e.target.value)}
                  required
                  placeholder="e.g. 27AAAAA1234A1ZA"
                />
              </div>
              <div className="flex items-end pb-2">
                <Label className="flex items-center gap-2 cursor-pointer text-xs bg-background border px-3 py-2 rounded-md">
                  <input
                    type="radio"
                    name="defaultBillingProfileNew"
                    checked={profile.isDefault}
                    onChange={() => updateProfile(i, "isDefault", true)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  Set as Default
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Billing Address *</Label>
              <Textarea
                value={profile.billingAddress}
                onChange={(e) => updateProfile(i, "billingAddress", e.target.value)}
                required
                rows={2}
                placeholder="Enter complete billing address for this GST..."
              />
            </div>
          </div>
          {profiles.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => removeProfile(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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
  const [partyCode, setPartyCode] = useState("");
  const [tpCode, setTpCode] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [billingProfiles, setBillingProfiles] = useState<
    {
      gstNumber: string;
      billingAddress: string;
      isDefault: boolean;
    }[]
  >([{ gstNumber: "", billingAddress: "", isDefault: true }]);
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [stampUrl, setStampUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);

  const [initialOpeningBalance, setInitialOpeningBalance] = useState<number | "">("");
  const [initialOpeningBalanceDate, setInitialOpeningBalanceDate] = useState("");
  const [openingInvoices, setOpeningInvoices] = useState<{ invoiceNumber: string; amount: number | ""; date: string; mundraPaymentDate?: string }[]>([]);
  // Debit notes that form part of the opening balance, alongside the invoices.
  const [openingDebitNotes, setOpeningDebitNotes] = useState<{ fromDate: string; toDate: string; amount: number | "" }[]>([]);
  // Draft rows shown inside the "Add Debit Note" dialog; only committed on OK.
  const [debitNoteDialogOpen, setDebitNoteDialogOpen] = useState(false);
  const [debitNoteDraft, setDebitNoteDraft] = useState<{ fromDate: string; toDate: string; amount: number | "" }[]>([
    { fromDate: "", toDate: "", amount: "" },
  ]);

  useEffect(() => {
    if (openingInvoices.length > 0 || openingDebitNotes.length > 0) {
      const invoiceSum = openingInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const debitSum = openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0);
      setInitialOpeningBalance(invoiceSum + debitSum || "");

      const validDates = [
        ...openingInvoices.map((inv) => inv.date),
        ...openingDebitNotes.map((dn) => dn.toDate),
      ].filter(Boolean);
      if (validDates.length > 0) {
        const latestDate = validDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        setInitialOpeningBalanceDate(latestDate);
      }
    }
  }, [openingInvoices, openingDebitNotes]);

  const [creditLimit, setCreditLimit] = useState<number | "">("");
  const [annualInterestRate, setAnnualInterestRate] = useState<number | "">("");
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

  const deleteClientMutation = useMutation({
    mutationFn: (organizationId: string) => deleteClientAdmin({ data: { organizationId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast.success("Client deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to delete client");
    },
  });

  function resetForm() {
    setLegalName("");
    setShortName("");
    setTradeName("");
    setPartyCode("");
    setTpCode("");
    setPanNumber("");
    setBillingProfiles([{ gstNumber: "", billingAddress: "", isDefault: true }]);
    setPrimaryContactName("");
    setPrimaryContactEmail("");
    setPrimaryContactPhone("");
    setLogoUrl("");
    setStampUrl("");
    setInitialOpeningBalance("");
    setInitialOpeningBalanceDate("");
    setOpeningInvoices([]);
    setCreditLimit(0);
    setAnnualInterestRate(0);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('po_container')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('po_container')
        .getPublicUrl(filePath);

      setLogoUrl(data.publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (err: any) {
      toast.error("Error uploading logo: " + err.message);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingStamp(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('po_container')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('po_container')
        .getPublicUrl(filePath);

      setStampUrl(data.publicUrl);
      toast.success("Stamp uploaded successfully");
    } catch (err: any) {
      toast.error("Error uploading stamp: " + err.message);
    } finally {
      setIsUploadingStamp(false);
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (openingInvoices.length > 0 || openingDebitNotes.length > 0) {
      const sum =
        openingInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0) +
        openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0);
      if (sum !== Number(initialOpeningBalance || 0)) {
        toast.error(
          "The sum of historical invoices and debit notes does not match the Initial Opening Balance.",
        );
        return;
      }
    }

    createMutation.mutate({
      legalName,
      shortName,
      tradeName,
      partyCode,
      tpCode,
      panNumber,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      logoUrl,
      stampUrl,
      creditLimit: creditLimit === "" ? 0 : creditLimit,
      annualInterestRate: annualInterestRate === "" ? 0 : annualInterestRate,
      paymentTermsDays: paymentTermsDays === "" ? 30 : paymentTermsDays,
      gracePeriodDays: gracePeriodDays === "" ? 0 : gracePeriodDays,
      includeUndispatchedPos: includeUndispatched,
      includeDispatchedUnbilled: includeDispatched,
      includeUnpaidInvoices: includeInvoices,
      restrictions,
      commissionPercentage: commissionPercentage === "" ? null : Number(commissionPercentage),
      deliveryLocations: deliveryLocations.map((l) => ({ ...l, isDefault: !!l.isDefault })),
      billingProfiles,
      initialOpeningBalance: initialOpeningBalance === "" ? undefined : Number(initialOpeningBalance),
      initialOpeningBalanceDate: initialOpeningBalanceDate === "" ? undefined : initialOpeningBalanceDate,
      openingInvoices: openingInvoices.filter(i => i.invoiceNumber && i.amount !== ""),
      openingDebitNotes: openingDebitNotes
        .filter((dn) => dn.fromDate && dn.toDate && dn.amount !== "")
        .map((dn) => ({ fromDate: dn.fromDate, toDate: dn.toDate, amount: Number(dn.amount) })),
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
            <DialogContent 
              className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => {
                if (debitNoteDialogOpen) {
                  e.preventDefault();
                }
              }}
            >
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
                        <Label>PAN Number</Label>
                        <Input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Party Code</Label>
                        <Input value={partyCode} onChange={(e) => setPartyCode(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>TP Code</Label>
                        <Input value={tpCode} onChange={(e) => setTpCode(e.target.value)} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Client Logo (Optional)</Label>
                        <div className="flex items-center gap-4">
                          <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                          {isUploadingLogo && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        {logoUrl && (
                          <div className="mt-2 text-sm">
                            <a href={logoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                              View Uploaded Logo
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Official Stamp (Optional)</Label>
                        <div className="flex items-center gap-4">
                          <Input type="file" accept="image/*" onChange={handleStampUpload} disabled={isUploadingStamp} />
                          {isUploadingStamp && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        {stampUrl && (
                          <div className="mt-2 text-sm">
                            <a href={stampUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                              View Uploaded Stamp
                            </a>
                          </div>
                        )}
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
                      <div className="col-span-2 pt-2">
                        <BillingProfilesBuilder
                          profiles={billingProfiles}
                          setProfiles={setBillingProfiles}
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
                    <h4 className="text-sm font-medium">Opening / Historical Invoices</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">Optional: Add individual invoices and debit notes that make up the opening balance.</p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpeningInvoices([...openingInvoices, { invoiceNumber: "", amount: "", date: "", mundraPaymentDate: "" }])}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Invoice
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Reopen with the notes already added, so the dialog edits
                              // rather than replaces them.
                              setDebitNoteDraft(
                                openingDebitNotes.length > 0
                                  ? openingDebitNotes.map((dn) => ({ ...dn }))
                                  : [{ fromDate: "", toDate: "", amount: "" }],
                              );
                              setDebitNoteDialogOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Debit Note
                          </Button>
                        </div>
                      </div>
                      {openingInvoices.map((inv, idx) => (
                        <div key={idx} className="flex gap-2 items-end p-3 border rounded-md bg-muted/20">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Invoice Number *</Label>
                            <Input
                              value={inv.invoiceNumber}
                              onChange={(e) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].invoiceNumber = e.target.value;
                                setOpeningInvoices(newInvs);
                              }}
                              required
                            />
                          </div>
                          <div className="flex-[0.8] space-y-1">
                            <Label className="text-xs">Amount (₹) *</Label>
                            <Input
                              type="number"
                              value={inv.amount}
                              onChange={(e) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].amount = e.target.value === "" ? "" : Number(e.target.value);
                                setOpeningInvoices(newInvs);
                              }}
                              required
                            />
                          </div>
                          <div className="flex-[0.8] space-y-1">
                            <Label className="text-xs">Date *</Label>
                            <Input
                              type="date"
                              value={inv.date}
                              onChange={(e) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].date = e.target.value;
                                setOpeningInvoices(newInvs);
                              }}
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] sm:text-xs truncate">Mundra Payment Date</Label>
                            <Input
                              type="date"
                              value={inv.mundraPaymentDate || ""}
                              onChange={(e) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].mundraPaymentDate = e.target.value;
                                setOpeningInvoices(newInvs);
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-9 w-9 mb-0.5 shrink-0"
                            onClick={() => setOpeningInvoices(openingInvoices.filter((_, i) => i !== idx))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {openingDebitNotes.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Debit Notes</Label>
                          {openingDebitNotes.map((dn, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 px-3 py-2 border rounded-md bg-muted/20 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {dn.fromDate ? `${new Date(dn.fromDate).toLocaleDateString("en-IN")} - ${dn.toDate ? new Date(dn.toDate).toLocaleDateString("en-IN") : "?"}` : "No date"}
                              </span>
                              <span className="font-medium">
                                ₹{(Number(dn.amount) || 0).toLocaleString("en-IN")}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-7 w-7"
                                onClick={() =>
                                  setOpeningDebitNotes(openingDebitNotes.filter((_, i) => i !== idx))
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {(openingInvoices.length > 0 || openingDebitNotes.length > 0) && (
                        <div className="space-y-1 text-sm px-1 pt-1">
                          {openingInvoices.length > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Sum of Invoices:</span>
                              <span className="font-medium">
                                ₹{openingInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}
                          {openingDebitNotes.length > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Sum of Debit Notes:</span>
                              <span className="font-medium">
                                ₹{openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t pt-1">
                            <span className="text-muted-foreground">Total Opening Balance:</span>
                            <span className="font-semibold text-primary">
                              ₹{(
                                openingInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0) +
                                openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0)
                              ).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <hr className="border-border my-4" />

                    <h4 className="text-sm font-medium">Commercial Terms & Balances</h4>
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md border border-dashed">
                      <div className="space-y-2">
                        <Label>Initial Opening Balance (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 50000"
                          value={initialOpeningBalance}
                          disabled={openingInvoices.length > 0 || openingDebitNotes.length > 0}
                          onChange={(e) =>
                            setInitialOpeningBalance(e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>As Of Date</Label>
                        <Input
                          type="date"
                          value={initialOpeningBalanceDate}
                          onChange={(e) => setInitialOpeningBalanceDate(e.target.value)}
                        />
                      </div>
                    </div>

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
                        <Label>Interest Rate (%) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={annualInterestRate}
                          onChange={(e) =>
                            setAnnualInterestRate(e.target.value === "" ? "" : Number(e.target.value))
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

          {/* Add Debit Note — collects date/amount pairs that add into the
              opening balance alongside the historical invoices. */}
          <Dialog open={debitNoteDialogOpen} onOpenChange={setDebitNoteDialogOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Add Debit Notes</DialogTitle>
                <DialogDescription>
                  These are added to the sum of invoices to make up the opening balance.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
                {debitNoteDraft.map((dn, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">From</Label>
                      <Input
                        type="date"
                        value={dn.fromDate}
                        onChange={(e) => {
                          const next = [...debitNoteDraft];
                          next[idx] = { ...next[idx], fromDate: e.target.value };
                          setDebitNoteDraft(next);
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">To</Label>
                      <Input
                        type="date"
                        value={dn.toDate}
                        onChange={(e) => {
                          const next = [...debitNoteDraft];
                          next[idx] = { ...next[idx], toDate: e.target.value };
                          setDebitNoteDraft(next);
                        }}
                      />
                    </div>
                    <div className="flex-[0.8] space-y-1">
                      <Label className="text-xs">Debit (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={dn.amount}
                        onChange={(e) => {
                          const next = [...debitNoteDraft];
                          next[idx] = {
                            ...next[idx],
                            amount: e.target.value === "" ? "" : Number(e.target.value),
                          };
                          setDebitNoteDraft(next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-9 w-9 mb-0.5 shrink-0"
                      disabled={debitNoteDraft.length === 1}
                      onClick={() => setDebitNoteDraft(debitNoteDraft.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDebitNoteDraft([...debitNoteDraft, { fromDate: "", toDate: "", amount: "" }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add another
                </Button>

                <div className="flex justify-between items-center text-sm border-t pt-2">
                  <span className="text-muted-foreground">Total of these debit notes:</span>
                  <span className="font-semibold text-primary">
                    ₹
                    {debitNoteDraft
                      .reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0)
                      .toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDebitNoteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // Keep only rows that actually carry a value.
                    const valid = debitNoteDraft.filter(
                      (dn) => dn.fromDate && dn.toDate && dn.amount !== "" && Number(dn.amount) > 0,
                    );
                    const incomplete = debitNoteDraft.filter(
                      (dn) =>
                        (dn.fromDate || dn.toDate || (dn.amount !== "" && Number(dn.amount) > 0)) &&
                        !(dn.fromDate && dn.toDate && dn.amount !== "" && Number(dn.amount) > 0),
                    );
                    if (incomplete.length > 0) {
                      toast.error("Each debit note needs both From and To dates and an amount greater than 0.");
                      return;
                    }
                    setOpeningDebitNotes(valid);
                    setDebitNoteDialogOpen(false);
                  }}
                >
                  OK
                </Button>
              </DialogFooter>
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
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                    onClick={() => {
                                      if (window.confirm("Are you sure you want to delete this client? This cannot be undone.")) {
                                        deleteClientMutation.mutate(client.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Client
                                  </DropdownMenuItem>
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
  const [ir, setIr] = useState<number | "">(comm.annual_interest_rate || 0);
  const [pt, setPt] = useState<number | "">(comm.payment_terms_days || "");
  const [gp, setGp] = useState<number | "">(comm.grace_period_days || "");
  const [undispatched, setUndispatched] = useState(comm.include_undispatched_pos || false);
  const [dispatched, setDispatched] = useState(comm.include_dispatched_unbilled !== false);
  const [unpaid, setUnpaid] = useState(comm.include_unpaid_invoices !== false);
  const [rest, setRest] = useState(comm.restrictions || "");
  const [commPerc, setCommPerc] = useState<number | "">(comm.commission_percentage ?? "");

  const [obAmount, setObAmount] = useState<number | "">("");
  const [obDate, setObDate] = useState(new Date().toISOString().split("T")[0]);
  const [obReference, setObReference] = useState("");
  const queryClient = useQueryClient();

  const obMutation = useMutation({
    mutationFn: (data: any) => createOpeningBalance({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Opening balance recorded successfully!");
      setObAmount("");
      setObReference("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to record opening balance");
    },
  });

  const cancelObMutation = useMutation({
    mutationFn: (data: any) => cancelOpeningBalanceAction({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Opening balance cancelled successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to cancel opening balance");
    },
  });

  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [mLegal, setMLegal] = useState(client.legal_name || "");
  const [mShort, setMShort] = useState(client.short_name || "");
  const [mTrade, setMTrade] = useState(client.trade_name || "");
  const [mPartyCode, setMPartyCode] = useState(client.party_code || "");
  const [mTpCode, setMTpCode] = useState(client.tp_code || "");
  const [mGst, setMGst] = useState(client.gst_number || "");
  const [mPan, setMPan] = useState(client.pan_number || "");
  const [mBillingProfiles, setMBillingProfiles] = useState<
    {
      gstNumber: string;
      billingAddress: string;
      isDefault: boolean;
    }[]
  >(
    client.billing_addresses?.map((b: any) => ({
      gstNumber: b.gst_number || "",
      billingAddress: b.billing_address || "",
      isDefault: b.is_default,
    })) || [],
  );
  const [mContactName, setMContactName] = useState(client.primary_contact_name || "");
  const [mContactEmail, setMContactEmail] = useState(client.primary_contact_email || "");
  const [mContactPhone, setMContactPhone] = useState(client.primary_contact_phone || "");
  const [mLogo, setMLogo] = useState(client.logo_url || "");
  const [mStamp, setMStamp] = useState(client.stamp_url || "");
  const [isUploadingMLogo, setIsUploadingMLogo] = useState(false);
  const [isUploadingMStamp, setIsUploadingMStamp] = useState(false);
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
    setMPartyCode(client.party_code || "");
    setMTpCode(client.tp_code || "");
    setMGst(client.gst_number || "");
    setMPan(client.pan_number || "");
    setMBillingProfiles(
      client.billing_addresses?.map((b: any) => ({
        gstNumber: b.gst_number || "",
        billingAddress: b.billing_address || "",
        isDefault: b.is_default,
      })) || [],
    );
    setMContactName(client.primary_contact_name || "");
    setMContactEmail(client.primary_contact_email || "");
    setMContactPhone(client.primary_contact_phone || "");
    setMLogo(client.logo_url || "");
    setMStamp(client.stamp_url || "");
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
      annualInterestRate: ir === "" ? 0 : ir,
      paymentTermsDays: pt === "" ? 30 : pt,
      gracePeriodDays: gp === "" ? 0 : gp,
      includeUndispatchedPos: undispatched,
      includeDispatchedUnbilled: dispatched,
      includeUnpaidInvoices: unpaid,
      restrictions: rest,
      commissionPercentage: commPerc === "" ? null : Number(commPerc),
    });
  };

  const handleMLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('po_container')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('po_container')
        .getPublicUrl(filePath);

      setMLogo(data.publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (err: any) {
      toast.error("Error uploading logo: " + err.message);
    } finally {
      setIsUploadingMLogo(false);
    }
  };

  const handleMStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMStamp(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('po_container')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('po_container')
        .getPublicUrl(filePath);

      setMStamp(data.publicUrl);
      toast.success("Stamp uploaded successfully");
    } catch (err: any) {
      toast.error("Error uploading stamp: " + err.message);
    } finally {
      setIsUploadingMStamp(false);
    }
  };

  const handleSaveMaster = () => {
    masterMutation.mutate(
      {
        organizationId: client.id,
        legalName: mLegal,
        shortName: mShort,
        tradeName: mTrade,
        partyCode: mPartyCode,
        tpCode: mTpCode,
        panNumber: mPan,
        primaryContactName: mContactName,
        primaryContactEmail: mContactEmail,
        primaryContactPhone: mContactPhone,
        logoUrl: mLogo,
        stampUrl: mStamp,
        billingProfiles: mBillingProfiles,
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
          <TabsTrigger value="opening-balance" className="flex-1">
            Opening Balance
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
                  <Label>Party Code</Label>
                  <Input value={mPartyCode} onChange={(e) => setMPartyCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>TP Code</Label>
                  <Input value={mTpCode} onChange={(e) => setMTpCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>PAN Number</Label>
                  <Input value={mPan} onChange={(e) => setMPan(e.target.value)} />
                </div>

                <div className="col-span-2 pt-2">
                  <BillingProfilesBuilder
                    profiles={mBillingProfiles}
                    setProfiles={setMBillingProfiles}
                  />
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
                <div className="col-span-2 space-y-2">
                  <Label>Client Logo</Label>
                  <div className="flex items-center gap-4">
                    <Input type="file" accept="image/*" onChange={handleMLogoUpload} disabled={isUploadingMLogo} />
                    {isUploadingMLogo && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {mLogo && (
                    <div className="mt-2 text-sm">
                      <a href={mLogo} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                        View Uploaded Logo
                      </a>
                    </div>
                  )}
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Official Stamp</Label>
                  <div className="flex items-center gap-4">
                    <Input type="file" accept="image/*" onChange={handleMStampUpload} disabled={isUploadingMStamp} />
                    {isUploadingMStamp && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {mStamp && (
                    <div className="mt-2 text-sm">
                      <a href={mStamp} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                        View Uploaded Stamp
                      </a>
                    </div>
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
                <p className="font-semibold text-muted-foreground">Party Code</p>
                <p>{client.party_code || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">TP Code</p>
                <p>{client.tp_code || "—"}</p>
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
              <div className="col-span-2 mt-2">
                <p className="font-semibold text-muted-foreground mb-1">Client Logo</p>
                {client.logo_url ? (
                  <div className="h-16 w-32 border rounded-md flex items-center justify-center p-2 bg-white">
                    <img src={client.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No logo uploaded</p>
                )}
              </div>
              <div className="col-span-2 mt-2">
                <p className="font-semibold text-muted-foreground mb-1">Official Stamp</p>
                {client.stamp_url ? (
                  <div className="h-16 w-32 border rounded-md flex items-center justify-center p-2 bg-white">
                    <img src={client.stamp_url} alt="Stamp" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No stamp uploaded</p>
                )}
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
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={ir}
                onChange={(e) => setIr(e.target.value === "" ? "" : Number(e.target.value))}
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

        <TabsContent value="opening-balance" className="space-y-6">
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-sm">Add Opening Balance</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={obAmount}
                  onChange={e => setObAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={obDate}
                  onChange={e => setObDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={obReference}
                  onChange={e => setObReference(e.target.value)}
                  placeholder="Optional reference"
                />
              </div>
            </div>
            <Button
              onClick={() => obMutation.mutate({
                organizationId: client.id,
                amount: obAmount,
                invoiceDate: obDate,
                reference: obReference
              })}
              disabled={obMutation.isPending || obAmount === ""}
            >
              {obMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Opening Balance
            </Button>
          </div>

          <div className="border rounded-lg p-4 space-y-4 mt-6">
            <h4 className="font-semibold text-sm">Existing Opening Balances</h4>
            {client.invoices?.filter((inv: any) => inv.is_opening_balance && inv.status !== 'cancelled').length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.invoices
                    .filter((inv: any) => inv.is_opening_balance && inv.status !== 'cancelled')
                    .map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{inv.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelObMutation.isPending || inv.status === 'paid' || inv.status === 'partially_paid'}
                            onClick={() => cancelObMutation.mutate({ invoiceId: inv.id })}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground italic">No opening balances recorded.</p>
            )}
          </div>
        </TabsContent>


      </Tabs>
    </>
  );
}
