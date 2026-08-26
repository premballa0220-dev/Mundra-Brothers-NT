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
import { DateInput } from "@/components/ui/date-input";
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
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Building2, Plus, Loader2, MoreVertical, Ban, CheckCircle2, X, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

type OpeningInvoiceRow = {
  invoiceNumber: string;
  amount: number | "";
  date: string;
  mundraPaymentDate?: string;
  type?: "DR" | "CR";
};

const _norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function _excelToISO(v: any): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    // Excel serial → ISO. 25569 = days between 1899-12-30 and 1970-01-01.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().split("T")[0];
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // dd-mm-yyyy
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

function _parseAmountAndType(
  v: any,
  row?: any[],
  drCrCol?: number,
  pendingCol?: number,
  refCol?: number,
): { amount: number; type: "DR" | "CR" } {
  let isCredit = false;

  // 1. Check if numeric value is negative
  if (typeof v === "number") {
    if (v < 0) isCredit = true;
  }

  const str = String(v ?? "").trim();
  // 2. Check if string value contains Cr / Credit / negative / parentheses
  if (
    /(^|\W|\d)(cr|credit|c\/r)(\W|$)/i.test(str) ||
    /^-|^\(.*\)$/.test(str) ||
    /cr$/i.test(str)
  ) {
    isCredit = true;
  }

  // 3. Check explicit drCrCol if detected
  if (row && drCrCol !== undefined && drCrCol !== -1 && row[drCrCol] !== undefined) {
    const colVal = _norm(row[drCrCol]);
    if (colVal === "cr" || colVal === "credit" || /(^|\W)cr(\W|$)/i.test(colVal) || colVal.includes("cr")) {
      isCredit = true;
    }
  }

  // 4. Check adjacent cell (pendingCol + 1) - common in Tally / ERP blank sub-headers
  if (row && pendingCol !== undefined && pendingCol !== -1 && row[pendingCol + 1] !== undefined) {
    const nextVal = _norm(row[pendingCol + 1]);
    if (nextVal === "cr" || nextVal === "credit" || /(^|\W)cr(\W|$)/i.test(nextVal)) {
      isCredit = true;
    }
  }

  // 5. Check invoice ref / description (e.g. "On Account", "Advance", "Credit Note", "CN-...")
  if (row && refCol !== undefined && refCol !== -1 && row[refCol] !== undefined) {
    const refVal = _norm(row[refCol]);
    if (
      refVal.includes("on account") ||
      refVal.includes("advance") ||
      refVal.includes("credit note") ||
      refVal.startsWith("cn") ||
      refVal.startsWith("cr-") ||
      refVal.startsWith("cr ") ||
      refVal.endsWith("(cr)")
    ) {
      isCredit = true;
    }
  }

  // 6. Check any cell across the row for a "Cr" or "Credit" indicator
  if (!isCredit && row && Array.isArray(row)) {
    for (let c = 0; c < row.length; c++) {
      const cellStr = _norm(row[c]);
      if (
        cellStr === "cr" ||
        cellStr === "credit" ||
        cellStr === "(cr)" ||
        cellStr === "[cr]" ||
        /(^|\W)cr(\W|$)/i.test(cellStr)
      ) {
        isCredit = true;
        break;
      }
    }
  }

  const cleanStr = str.replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, "");
  const n = Number(cleanStr);
  const amount = isNaN(n) ? 0 : Math.abs(n);

  return { amount, type: isCredit ? "CR" : "DR" };
}

function _toNum(v: any): number {
  return _parseAmountAndType(v).amount;
}

// Add N days to an ISO (YYYY-MM-DD) date, returning ISO. Blank in → blank out.
function _addDays(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

// Parse one worksheet (as a 2D array) of the UTCL "Bill-wise Details / Pending
// Bills" ledger into opening-invoice rows. The header spans two rows (e.g.
// "Pending" over "Amount"), the invoice number is the "Ref. No." column, dates
// are Excel serials, and the "Opening Amount" and "Overdue by days" columns are
// intentionally ignored — the PENDING amount is the carried-forward outstanding.
// Returns null when the sheet has no recognisable bill table.
function parseLedgerSheet(rows: any[][]): OpeningInvoiceRow[] | null {
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = (rows[i] || []).map(_norm);
    if (r.some((c) => c.includes("pending")) && r.some((c) => c.includes("ref") || c.includes("date") || c.includes("overdue"))) {
      hi = i;
      break;
    }
  }
  if (hi === -1) return null;

  // Merge a continuation header row ("Amount", "by days", …) into the main one.
  const next = (rows[hi + 1] || []).map(_norm);
  const nonEmptyNext = next.filter(Boolean).length;
  const isCont = nonEmptyNext > 0 && nonEmptyNext <= 3 && next.some((c) => c.includes("amount") || c.includes("day"));
  const H0 = (rows[hi] || []).map(_norm);
  const H = H0.map((h, c) => (isCont ? `${h} ${next[c] || ""}`.trim() : h));

  const find = (preds: ((h: string) => boolean)[]) => {
    for (const p of preds) {
      const i = H.findIndex((h) => p(h));
      if (i !== -1) return i;
    }
    return -1;
  };
  const refCol = find([
    (h) => h.includes("ref") && h.includes("no"),
    (h) => (h.includes("invoice") || h.includes("bill")) && (h.includes("no") || h.includes("number") || h.includes("#")),
    (h) => h === "ref. no." || h === "invoice" || h === "bill",
  ]);
  const dateCol = find([(h) => h.includes("date") && !h.includes("due")]);
  const pendingCol = find([
    (h) => h.includes("pending"),
    (h) => h.includes("outstanding") || h.includes("balance"),
    (h) => h === "amount" || h.includes("amt"),
  ]);
  const drCrCol = find([
    (h) => h.includes("dr") && h.includes("cr"),
    (h) => h === "cr/dr" || h === "dr/cr" || h === "d/c" || h === "type",
    (h) => h.includes("debit") && h.includes("credit"),
    (h) => h === "dr" || h === "cr",
  ]);
  if (refCol === -1 || pendingCol === -1) return null;

  const dataStart = isCont ? hi + 2 : hi + 1;
  const out: OpeningInvoiceRow[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || [];
    const invoiceNumber = String(row[refCol] ?? "").trim();
    const { amount, type } = _parseAmountAndType(row[pendingCol], row, drCrCol, pendingCol, refCol);
    if (!invoiceNumber) continue;
    if (/total|closing|opening|grand|carried|b\/?f|c\/?f/i.test(invoiceNumber)) continue; // summary rows
    if (amount <= 0) continue; // nothing pending to carry forward
    const date = dateCol !== -1 ? _excelToISO(row[dateCol]) : "";
    // The Mundra-to-UTCL payment date is always 9 days after the invoice date.
    out.push({ invoiceNumber, amount, date, mundraPaymentDate: _addDays(date, 9), type });
  }
  return out.length > 0 ? out : null;
}

// The client name sits on the line just above "Bill-wise Details"; fall back to
// the sheet name so the picker always has a readable label.
function ledgerSheetLabel(rows: any[][], sheetName: string): string {
  const idx = rows.findIndex((r) => (r || []).some((c) => _norm(c).includes("bill-wise")));
  if (idx > 0) {
    const above = (rows[idx - 1] || []).map((c) => String(c ?? "").trim()).filter(Boolean);
    if (above.length) return above[0];
  }
  return sheetName;
}

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
          No delivery locations added. (Optional)
        </p>
      )}
      {locations.map((loc, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border rounded-md relative bg-muted/20">
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Location Label (e.g. Site A)</Label>
                <Input
                  value={loc.label}
                  onChange={(e) => updateLocation(i, "label", e.target.value)}
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
              <Label className="text-xs">Full Address</Label>
              <Textarea
                value={loc.address}
                onChange={(e) => updateLocation(i, "address", e.target.value)}
                rows={2}
                placeholder="Enter shipping address..."
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Contact Person</Label>
                <Input
                  value={loc.contactPerson || ""}
                  onChange={(e) => updateLocation(i, "contactPerson", e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Contact Phone</Label>
                <Input
                  value={loc.contactPhone || ""}
                  onChange={(e) =>
                    updateLocation(i, "contactPhone", e.target.value)
                  }
                  placeholder="Phone number"
                />
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
          No billing profiles added. (Optional)
        </p>
      )}
      {profiles.map((profile, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border rounded-md relative bg-muted/10">
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">GST Number</Label>
                <Input
                  value={profile.gstNumber}
                  onChange={(e) => updateProfile(i, "gstNumber", e.target.value)}
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
              <Label className="text-xs">Billing Address</Label>
              <Textarea
                value={profile.billingAddress}
                onChange={(e) => updateProfile(i, "billingAddress", e.target.value)}
                rows={2}
                placeholder="Enter billing address for this GST..."
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
  const [initialOpeningBalanceType, setInitialOpeningBalanceType] = useState<"DR" | "CR">("DR");
  const [initialOpeningBalanceDate, setInitialOpeningBalanceDate] = useState("");
  const [openingInvoices, setOpeningInvoices] = useState<
    { invoiceNumber: string; amount: number | ""; date: string; mundraPaymentDate?: string; type?: "DR" | "CR" }[]
  >([]);
  // Debit notes that form part of the opening balance, alongside the invoices.
  const [openingDebitNotes, setOpeningDebitNotes] = useState<{ fromDate: string; toDate: string; amount: number | "" }[]>([]);
  // Excel import: when a workbook has several client sheets, let the user pick one.
  const [importSheets, setImportSheets] = useState<{ name: string; label: string; invoices: OpeningInvoiceRow[] }[]>([]);
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  // Opening the OS file picker steals focus from the onboarding dialog, which
  // Radix would otherwise treat as an outside interaction and close it. This
  // flag tells the dialog's onInteractOutside guard to ignore that event.
  const fileDialogActiveRef = useRef(false);
  const applyImportedInvoices = (invoices: OpeningInvoiceRow[]) => {
    setOpeningInvoices((prev) => [
      ...prev.filter((r) => r.invoiceNumber || r.amount !== ""),
      ...invoices.map((inv) => ({ ...inv, type: inv.type || "DR" })),
    ]);
    toast.success(`Imported ${invoices.length} invoice(s).`);
  };
  // Draft rows shown inside the "Add Debit Note" dialog; only committed on OK.
  const [debitNoteDialogOpen, setDebitNoteDialogOpen] = useState(false);
  const [debitNoteDraft, setDebitNoteDraft] = useState<{ fromDate: string; toDate: string; amount: number | "" }[]>([
    { fromDate: "", toDate: "", amount: "" },
  ]);

  useEffect(() => {
    if (openingInvoices.length > 0 || openingDebitNotes.length > 0) {
      const invoiceDrSum = openingInvoices
        .filter((i) => (i.type || "DR") === "DR")
        .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const invoiceCrSum = openingInvoices
        .filter((i) => (i.type || "DR") === "CR")
        .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const debitSum = openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0);
      const totalDr = invoiceDrSum + debitSum;
      const totalCr = invoiceCrSum;
      const netTotal = Math.abs(totalDr - totalCr);
      const netType = totalCr > totalDr ? "CR" : "DR";

      setInitialOpeningBalance(netTotal);
      setInitialOpeningBalanceType(netType);

      const validDates = [
        ...openingInvoices.map((inv) => inv.date),
        ...openingDebitNotes.map((dn) => dn.toDate),
      ].filter(Boolean);
      if (validDates.length > 0) {
        const latestDate = validDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        setInitialOpeningBalanceDate(latestDate);
      }
    } else {
      setInitialOpeningBalance("");
      setInitialOpeningBalanceType("DR");
      setInitialOpeningBalanceDate("");
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
    setInitialOpeningBalanceType("DR");
    setInitialOpeningBalanceDate("");
    setOpeningInvoices([]);
    setOpeningDebitNotes([]);
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
      const invoiceDrSum = openingInvoices
        .filter((i) => (i.type || "DR") === "DR")
        .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const invoiceCrSum = openingInvoices
        .filter((i) => (i.type || "DR") === "CR")
        .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const debitSum = openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0);
      const totalDr = invoiceDrSum + debitSum;
      const totalCr = invoiceCrSum;
      const expectedNet = Math.abs(totalDr - totalCr);
      if (Math.abs(Number(initialOpeningBalance || 0) - expectedNet) > 0.01) {
        toast.error(
          "The net sum of historical invoices and debit notes does not match the Initial Opening Balance.",
        );
        return;
      }
    }

    const cleanLocations = deliveryLocations
      .filter((l) => l.label?.trim() || l.address?.trim())
      .map((l) => ({
        ...l,
        label: l.label?.trim() || "Main Location",
        address: l.address?.trim() || "Not specified",
        isDefault: !!l.isDefault,
      }));

    const cleanBilling = billingProfiles
      .filter((p) => p.gstNumber?.trim() || p.billingAddress?.trim())
      .map((p) => ({
        ...p,
        isDefault: !!p.isDefault,
      }));

    createMutation.mutate({
      legalName: legalName.trim() || tradeName.trim() || "New Client Organization",
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
      creditLimit: creditLimit === "" ? 0 : Number(creditLimit),
      annualInterestRate: annualInterestRate === "" ? 0 : Number(annualInterestRate),
      paymentTermsDays: paymentTermsDays === "" ? 30 : Number(paymentTermsDays),
      gracePeriodDays: gracePeriodDays === "" ? 0 : Number(gracePeriodDays),
      includeUndispatchedPos: includeUndispatched,
      includeDispatchedUnbilled: includeDispatched,
      includeUnpaidInvoices: includeInvoices,
      restrictions,
      commissionPercentage: commissionPercentage === "" ? null : Number(commissionPercentage),
      deliveryLocations: cleanLocations,
      billingProfiles: cleanBilling,
      initialOpeningBalance: initialOpeningBalance === "" ? undefined : Number(initialOpeningBalance),
      initialOpeningBalanceType,
      initialOpeningBalanceDate: initialOpeningBalanceDate === "" ? undefined : initialOpeningBalanceDate,
      openingInvoices: openingInvoices
        .filter((i) => i.invoiceNumber && i.amount !== "")
        .map((i) => ({
          invoiceNumber: i.invoiceNumber,
          amount: Number(i.amount),
          date: i.date || new Date().toISOString().split("T")[0],
          mundraPaymentDate: i.mundraPaymentDate,
          type: i.type || "DR",
        })),
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
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
                // Keep the onboarding dialog open while any of its own sub-flows
                // are active: the debit-note dialog, the Excel sheet picker, or
                // the native file picker (which momentarily steals focus).
                if (debitNoteDialogOpen || importPickerOpen || fileDialogActiveRef.current) {
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
                        <Label>Legal Name</Label>
                        <Input
                          value={legalName}
                          onChange={(e) => setLegalName(e.target.value)}
                          placeholder="e.g. Acme Corp Ltd"
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
                          value={primaryContactPhone}
                          onChange={(e) =>
                            setPrimaryContactPhone(e.target.value)
                          }
                          placeholder="Phone number"
                        />
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
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            id="opening-invoices-excel"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = ""; // allow re-selecting the same file
                              if (!file) return;
                              try {
                                const buf = await file.arrayBuffer();
                                const wb = XLSX.read(buf, { type: "array" });
                                // Each sheet is one client's pending-bill ledger. Parse them all
                                // and keep the ones that actually contain a bill table.
                                const sheets = wb.SheetNames.map((name) => {
                                  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: "" });
                                  const invoices = parseLedgerSheet(rows);
                                  return invoices ? { name, label: ledgerSheetLabel(rows, name), invoices } : null;
                                }).filter(Boolean) as { name: string; label: string; invoices: OpeningInvoiceRow[] }[];

                                if (sheets.length === 0) {
                                  toast.error("No pending-bill sheet was found in this workbook.");
                                  return;
                                }
                                if (sheets.length === 1) {
                                  applyImportedInvoices(sheets[0].invoices);
                                  return;
                                }
                                // Several client sheets → let the user choose which one.
                                setImportSheets(sheets);
                                setImportPickerOpen(true);
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to import Excel file.");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              fileDialogActiveRef.current = true;
                              // Whether the user picks a file or cancels, focus
                              // returns to the window — clear the guard shortly after.
                              window.addEventListener(
                                "focus",
                                () => setTimeout(() => { fileDialogActiveRef.current = false; }, 300),
                                { once: true },
                              );
                              document.getElementById("opening-invoices-excel")?.click();
                            }}
                          >
                            <Upload className="h-3 w-3 mr-1" /> Import Invoices
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setOpeningInvoices([
                                ...openingInvoices,
                                { invoiceNumber: "", amount: "", date: "", mundraPaymentDate: "", type: "DR" },
                              ])
                            }
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
                          {openingInvoices.length > 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setOpeningInvoices([]);
                                toast.success("All imported invoices removed.");
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Delete All Invoices
                            </Button>
                          )}
                        </div>
                      </div>
                      {openingInvoices.map((inv, idx) => (
                        <div key={idx} className="flex gap-2 items-end p-3 border rounded-md bg-muted/20">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Invoice Number</Label>
                            <Input
                              value={inv.invoiceNumber}
                              onChange={(e) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].invoiceNumber = e.target.value;
                                setOpeningInvoices(newInvs);
                              }}
                              placeholder="Invoice No"
                            />
                          </div>
                          <div className="flex-[0.9] space-y-1">
                            <Label className="text-xs">Amount (₹)</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={inv.amount}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const newInvs = [...openingInvoices];
                                  newInvs[idx].amount = e.target.value === "" ? "" : Number(e.target.value);
                                  setOpeningInvoices(newInvs);
                                }}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                title={`Click to toggle Dr/Cr (Currently ${(inv.type || "DR") === "CR" ? "Credit (Cr) - subtracts from total" : "Debit (Dr) - adds to total"})`}
                                onClick={() => {
                                  const newInvs = [...openingInvoices];
                                  newInvs[idx].type = (newInvs[idx].type || "DR") === "DR" ? "CR" : "DR";
                                  setOpeningInvoices(newInvs);
                                }}
                                className={`h-9 px-2.5 rounded-md font-semibold text-xs transition-all select-none flex items-center justify-center border shadow-xs cursor-pointer ${
                                  (inv.type || "DR") === "CR"
                                    ? "bg-rose-500/15 text-rose-600 border-rose-300 dark:border-rose-800 dark:text-rose-400 hover:bg-rose-500/25"
                                    : "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/25"
                                }`}
                              >
                                {inv.type || "DR"}
                              </button>
                            </div>
                          </div>
                          <div className="flex-[0.8] space-y-1">
                            <Label className="text-xs">Date</Label>
                            <DateInput
                              value={inv.date}
                              onChange={(val) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].date = val;
                                setOpeningInvoices(newInvs);
                              }}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] sm:text-xs truncate">Mundra Payment Date</Label>
                            <DateInput
                              value={inv.mundraPaymentDate || ""}
                              onChange={(val) => {
                                const newInvs = [...openingInvoices];
                                newInvs[idx].mundraPaymentDate = val;
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
                      {(openingInvoices.length > 0 || openingDebitNotes.length > 0) && (() => {
                        const invoiceDrSum = openingInvoices
                          .filter((i) => (i.type || "DR") === "DR")
                          .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
                        const invoiceCrSum = openingInvoices
                          .filter((i) => (i.type || "DR") === "CR")
                          .reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
                        const debitSum = openingDebitNotes.reduce((acc, dn) => acc + (Number(dn.amount) || 0), 0);
                        const totalDr = invoiceDrSum + debitSum;
                        const totalCr = invoiceCrSum;
                        const netAmount = Math.abs(totalDr - totalCr);
                        const netType = totalCr > totalDr ? "Cr" : "Dr";

                        return (
                          <div className="space-y-1 text-sm px-1 pt-1">
                            {openingInvoices.length > 0 && (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Sum of Invoices (Dr):</span>
                                  <span className="font-medium">
                                    ₹{invoiceDrSum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                {invoiceCrSum > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Credit Invoices (Cr):</span>
                                    <span className="font-medium text-rose-600 dark:text-rose-400">
                                      ₹{invoiceCrSum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {openingDebitNotes.length > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Sum of Debit Notes:</span>
                                <span className="font-medium">
                                  ₹{debitSum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center border-t pt-1">
                              <span className="text-muted-foreground">Total Opening Balance:</span>
                              <span className={`font-semibold ${netType === "Cr" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                ₹{netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {netType}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <hr className="border-border my-4" />

                    <h4 className="text-sm font-medium">Commercial Terms & Balances</h4>
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md border border-dashed">
                      <div className="space-y-2">
                        <Label>Initial Opening Balance (₹)</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder="e.g. 50000"
                            value={initialOpeningBalance}
                            disabled={openingInvoices.length > 0 || openingDebitNotes.length > 0}
                            onChange={(e) =>
                              setInitialOpeningBalance(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <button
                            type="button"
                            disabled={openingInvoices.length > 0 || openingDebitNotes.length > 0}
                            title={`Balance type: ${initialOpeningBalanceType === "CR" ? "Credit (Cr)" : "Debit (Dr)"}`}
                            onClick={() => {
                              if (openingInvoices.length === 0 && openingDebitNotes.length === 0) {
                                setInitialOpeningBalanceType(initialOpeningBalanceType === "DR" ? "CR" : "DR");
                              }
                            }}
                            className={`h-9 px-2.5 rounded-md font-semibold text-xs select-none flex items-center justify-center border shadow-xs ${
                              openingInvoices.length > 0 || openingDebitNotes.length > 0 ? "cursor-default opacity-85" : "cursor-pointer hover:opacity-90"
                            } ${
                              initialOpeningBalanceType === "CR"
                                ? "bg-rose-500/15 text-rose-600 border-rose-300 dark:border-rose-800 dark:text-rose-400"
                                : "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400"
                            }`}
                          >
                            {initialOpeningBalanceType}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>As Of Date</Label>
                        <DateInput
                          value={initialOpeningBalanceDate}
                          onChange={(val) => setInitialOpeningBalanceDate(val)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Credit Limit (₹)</Label>
                        <Input
                          type="number"
                          value={creditLimit}
                          onChange={(e) =>
                            setCreditLimit(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interest Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={annualInterestRate}
                          onChange={(e) =>
                            setAnnualInterestRate(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Terms (Days)</Label>
                        <Input
                          type="number"
                          value={paymentTermsDays}
                          onChange={(e) =>
                            setPaymentTermsDays(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="30"
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
                          placeholder="0"
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
          <Dialog open={importPickerOpen} onOpenChange={setImportPickerOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Select a client sheet to import</DialogTitle>
                <DialogDescription>
                  This workbook has several sheets. Pick the one for the client you are creating.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
                {importSheets.map((s) => {
                  const drTotal = s.invoices
                    .filter((r) => (r.type || "DR") === "DR")
                    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                  const crTotal = s.invoices
                    .filter((r) => (r.type || "DR") === "CR")
                    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                  const net = Math.abs(drTotal - crTotal);
                  const netType = crTotal > drTotal ? "Cr" : "Dr";
                  return (
                    <button
                      key={s.name}
                      type="button"
                      className="w-full text-left p-3 border rounded-md hover:bg-muted/40 transition-colors"
                      onClick={() => {
                        applyImportedInvoices(s.invoices);
                        setImportPickerOpen(false);
                      }}
                    >
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.invoices.length} invoice(s) · Pending ₹{net.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {netType}
                        {s.label !== s.name ? ` · sheet: ${s.name}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>

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
                      <DateInput
                        value={dn.fromDate}
                        onChange={(val) => {
                          const next = [...debitNoteDraft];
                          next[idx] = { ...next[idx], fromDate: val };
                          setDebitNoteDraft(next);
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">To</Label>
                      <DateInput
                        value={dn.toDate}
                        onChange={(val) => {
                          const next = [...debitNoteDraft];
                          next[idx] = { ...next[idx], toDate: val };
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
                <DateInput
                  value={obDate}
                  onChange={val => setObDate(val)}
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
