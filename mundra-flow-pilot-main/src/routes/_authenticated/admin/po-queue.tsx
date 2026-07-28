import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  getClients,
  getProducts,
  getApplicableRate,
  createPurchaseOrderAdmin,
  getClientDeliveryLocationsAdmin,
  deletePurchaseOrdersAdmin,
} from "@/lib/api/business.functions";
import { getPoFormats } from "@/lib/api/po-formats.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  Building2,
  MapPin,
  Phone,
  IndianRupee,
  Package,
  Calendar,
  Search,
  FileWarning,
  ExternalLink,
  Undo2,
  Plus,
  UploadCloud,
  AlertCircle,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/po-queue")({
  ssr: false,
  component: AdminPOQueuePage,
});

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  pending_approval: { label: "Pending Approval", variant: "secondary", color: "text-warning" },
  approved: { label: "Approved", variant: "default", color: "text-success" },
  rejected: { label: "Rejected", variant: "destructive", color: "text-destructive" },
  blocked: { label: "Blocked", variant: "destructive", color: "text-destructive" },
  submitted: { label: "Submitted", variant: "outline", color: "text-muted-foreground" },
  completed: { label: "Completed", variant: "default", color: "text-success" },
};

function AdminPOQueuePage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | "revert_approve" | "revert_reject" | null
  >(null);
  const [confirmPOId, setConfirmPOId] = useState<string | null>(null);
  const [confirmPONumber, setConfirmPONumber] = useState<string>("");
  const [viewGeneratedPo, setViewGeneratedPo] = useState<any>(null);

  const [selectedPOIds, setSelectedPOIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicking inside a dialog, the table container, or the bulk action bar, don't clear selection.
      if (
        target.closest(".table-container") ||
        target.closest(".bulk-action-bar") ||
        target.closest("[role='dialog']")
      ) {
        return;
      }
      setSelectedPOIds(new Set());
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Admin PO Creation Form States
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [lockedRate, setLockedRate] = useState<number>(0);
  const [isExceptionRate, setIsExceptionRate] = useState(false);
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [documentMethod, setDocumentMethod] = useState<"upload" | "generate">("upload");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPoFormatId, setSelectedPoFormatId] = useState("");
  const [poFormatText, setPoFormatText] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => getClients(),
  });

  const selectedClientObject = clients?.find((c: any) => c.id === selectedClientId);
  const clientHasLogo = !!selectedClientObject?.logo_url;

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getProducts(),
  });

  const { data: deliveryLocations } = useQuery({
    queryKey: ["admin-client-locations", selectedClientId],
    queryFn: () => getClientDeliveryLocationsAdmin({ data: { organizationId: selectedClientId } }),
    enabled: !!selectedClientId,
  });

  const { data: applicableRateInfo } = useQuery({
    queryKey: ["applicable-rate", productId, selectedClientId],
    queryFn: () => getApplicableRate({ data: { productId, organizationId: selectedClientId } }),
    enabled: !!productId && !!selectedClientId,
  });

  const { data: poFormats } = useQuery({
    queryKey: ["admin-client-po-formats", selectedClientId],
    queryFn: () => getPoFormats({ data: { organization_id: selectedClientId } }),
    enabled: !!selectedClientId,
  });

  useEffect(() => {
    if (createPOOpen) {
      if (poFormats && poFormats.length > 0) {
        const format = poFormats[0];
        setSelectedPoFormatId(format.id);
        setPoFormatText(format.template_schema?.template_text || "");
      } else {
        setSelectedPoFormatId("");
        setPoFormatText("");
      }
    }
  }, [poFormats, selectedClientId, createPOOpen]);

  // Effect to pre-fill default delivery location when client locations are loaded
  useEffect(() => {
    if (deliveryLocations && deliveryLocations.length > 0 && createPOOpen) {
      const defaultLoc = deliveryLocations.find((l: any) => l.is_default) || deliveryLocations[0];
      setSiteAddress(defaultLoc.address);
      if (defaultLoc.contact_person) {
        setDeliveryContact(
          `${defaultLoc.contact_person} ${defaultLoc.contact_phone ? `(${defaultLoc.contact_phone})` : ""}`.trim(),
        );
      } else {
        setDeliveryContact("");
      }
    } else {
      setSiteAddress("");
      setDeliveryContact("");
    }
  }, [deliveryLocations, createPOOpen]);

  // Effect to set rate
  useEffect(() => {
    if (applicableRateInfo && !isExceptionRate) {
      setLockedRate(applicableRateInfo.rate);
    }
  }, [applicableRateInfo, isExceptionRate]);

  const { data: allPOs, isLoading } = useQuery({
    queryKey: ["admin-po-queue"],
    queryFn: () => getPurchaseOrders(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => updatePurchaseOrderStatus({ data: { id, status: "approved" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-po-queue"] });
      toast.success("Purchase Order approved successfully");
      setDetailsOpen(false);
      setConfirmAction(null);
      setConfirmPOId(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to approve PO"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => updatePurchaseOrderStatus({ data: { id, status: "rejected" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-po-queue"] });
      toast.success("Purchase Order rejected");
      setDetailsOpen(false);
      setConfirmAction(null);
      setConfirmPOId(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to reject PO"),
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) =>
      updatePurchaseOrderStatus({ data: { id, status: "pending_approval" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-po-queue"] });
      toast.success("PO reverted to pending approval");
      setDetailsOpen(false);
      setConfirmAction(null);
      setConfirmPOId(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to revert PO"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deletePurchaseOrdersAdmin({ data: { ids } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-po-queue"] });
      toast.success("Purchase Orders deleted successfully");
      setSelectedPOIds(new Set());
      setBulkDeleteConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete POs"),
  });

  const createPOMutation = useMutation({
    mutationFn: (newPo: any) => createPurchaseOrderAdmin({ data: newPo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-po-queue"] });
      toast.success("Purchase Order submitted successfully!");
      setCreatePOOpen(false);
      resetCreatePOForm();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to submit Purchase Order"),
  });

  function resetCreatePOForm() {
    setSelectedClientId("");
    setPoNumber("");
    setProductId("");
    setQuantity(0);
    setLockedRate(0);
    setIsExceptionRate(false);
    setSiteAddress("");
    setDeliveryContact("");
    setDocumentMethod("upload");
    setDocumentUrl("");
    setDocumentFile(null);
    setSelectedPoFormatId("");
    setPoFormatText("");
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setDocumentFile(file);
      setDocumentUrl(URL.createObjectURL(file));
    }
  };

  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return toast.error("Please select a client.");

    let finalDocumentUrl = documentUrl;

    if (documentMethod === "upload" && documentFile) {
      setIsUploading(true);
      try {
        const fileExt = documentFile.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("po_container")
          .upload(filePath, documentFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("po_container").getPublicUrl(filePath);

        finalDocumentUrl = publicUrl;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Failed to upload document: ${err.message}`);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    createPOMutation.mutate({
      organizationId: selectedClientId,
      poNumber,
      items: [{ productId, quantity, lockedRate: isExceptionRate ? lockedRate : undefined }],
      isExceptionRate,
      siteAddress,
      deliveryContact,
      documentMethod,
      documentUrl: finalDocumentUrl,
      poFormatId: documentMethod === "generate" && selectedPoFormatId ? selectedPoFormatId : null,
      poFormatData: documentMethod === "generate" ? { html_content: poFormatText } : null,
    });
  };

  const filteredPOs = (allPOs || []).filter((po: any) => {
    const matchesStatus = filterStatus === "all" || po.status === filterStatus;
    const matchesSearch =
      !searchTerm ||
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.organization?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.organization?.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.product?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = (allPOs || []).filter((po: any) => po.status === "pending_approval").length;

  const toggleSelectAll = () => {
    if (selectedPOIds.size === filteredPOs.length && filteredPOs.length > 0) {
      setSelectedPOIds(new Set());
    } else {
      setSelectedPOIds(new Set(filteredPOs.map((po: any) => po.id)));
    }
  };

  const toggleSelectPO = (id: string) => {
    const newSet = new Set(selectedPOIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedPOIds(newSet);
  };
  const approvedCount = (allPOs || []).filter((po: any) => po.status === "approved").length;
  const rejectedCount = (allPOs || []).filter((po: any) => po.status === "rejected").length;

  function openConfirm(
    action: "approve" | "reject" | "revert_approve" | "revert_reject",
    poId: string,
    poNumber: string,
  ) {
    setConfirmAction(action);
    setConfirmPOId(poId);
    setConfirmPONumber(poNumber);
  }

  function executeConfirm() {
    if (!confirmPOId || !confirmAction) return;
    if (confirmAction === "approve") {
      approveMutation.mutate(confirmPOId);
    } else if (confirmAction === "reject") {
      rejectMutation.mutate(confirmPOId);
    } else {
      revertMutation.mutate(confirmPOId);
    }
  }

  function openDetails(po: any) {
    setSelectedPO(po);
    setDetailsOpen(true);
  }

  return (
    <AppShell variant="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">PO Queue</h1>
            <p className="text-sm text-muted-foreground">
              Review submitted Purchase Orders from clients, validate documents, and approve or
              reject them.
            </p>
          </div>
          <Button onClick={() => setCreatePOOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create PO On Behalf
          </Button>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card
            className={`cursor-pointer transition-colors ${filterStatus === "pending_approval" ? "border-warning/60 bg-warning/5" : "hover:border-warning/30"}`}
            onClick={() =>
              setFilterStatus(filterStatus === "pending_approval" ? "all" : "pending_approval")
            }
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileWarning className="h-5 w-5 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{pendingCount}</div>
                <div className="text-xs text-muted-foreground">Pending Approval</div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors ${filterStatus === "approved" ? "border-success/60 bg-success/5" : "hover:border-success/30"}`}
            onClick={() => setFilterStatus(filterStatus === "approved" ? "all" : "approved")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{approvedCount}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors ${filterStatus === "rejected" ? "border-destructive/60 bg-destructive/5" : "hover:border-destructive/30"}`}
            onClick={() => setFilterStatus(filterStatus === "rejected" ? "all" : "rejected")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{rejectedCount}</div>
                <div className="text-xs text-muted-foreground">Rejected</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO number, client, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedPOIds.size > 0 && (
          <div className="bg-muted p-3 rounded-md flex items-center justify-between border bulk-action-bar">
            <span className="text-sm font-medium">
              {selectedPOIds.size} Purchase Order(s) selected
            </span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
            </Button>
          </div>
        )}

        {/* PO Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="table-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Purchase Orders ({filteredPOs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={
                          filteredPOs.length > 0 && selectedPOIds.size === filteredPOs.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Rate / MT</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.length > 0 ? (
                    filteredPOs.map((po: any) => {
                      const cfg = statusConfig[po.status] || {
                        label: po.status,
                        variant: "secondary" as const,
                        color: "",
                      };
                      return (
                        <TableRow key={po.id} className="group">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedPOIds.has(po.id)}
                              onCheckedChange={() => toggleSelectPO(po.id)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {po.po_number}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span
                                className="truncate max-w-[140px]"
                                title={po.organization?.legal_name}
                              >
                                {po.organization?.trade_name || po.organization?.legal_name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {po.product?.name}
                            {po.product?.grade && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({po.product.grade})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {Number(po.original_quantity).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatCurrency(po.locked_rate)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(po.total_value)}
                          </TableCell>
                          <TableCell>
                            {po.document_method === "generate" && po.po_format_data ? (
                              <button
                                onClick={() => setViewGeneratedPo(po)}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                View Generated PO
                              </button>
                            ) : po.document_url ? (
                              <a
                                href={po.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                View PDF
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Not uploaded
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="capitalize">
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openDetails(po)}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {po.status === "pending_approval" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                    onClick={() => openConfirm("approve", po.id, po.po_number)}
                                    disabled={approveMutation.isPending}
                                    title="Approve"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => openConfirm("reject", po.id, po.po_number)}
                                    disabled={rejectMutation.isPending}
                                    title="Reject"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(po.status === "approved" || po.status === "rejected") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-warning hover:bg-warning/10"
                                  onClick={() =>
                                    openConfirm(
                                      po.status === "approved" ? "revert_approve" : "revert_reject",
                                      po.id,
                                      po.po_number,
                                    )
                                  }
                                  disabled={revertMutation.isPending}
                                  title={
                                    po.status === "approved"
                                      ? "Revoke Approval"
                                      : "Remove Rejection"
                                  }
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                        No purchase orders match your filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Details dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-[650px] overflow-y-auto max-h-[90vh]">
            {selectedPO && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {selectedPO.po_number}
                    <Badge
                      variant={(statusConfig[selectedPO.status]?.variant as any) || "secondary"}
                      className="ml-2 capitalize"
                    >
                      {statusConfig[selectedPO.status]?.label || selectedPO.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Submitted on{" "}
                    {new Date(selectedPO.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Client info */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Client Details
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">
                            {selectedPO.organization?.legal_name || "—"}
                          </div>
                          {selectedPO.organization?.trade_name && (
                            <div className="text-xs text-muted-foreground">
                              Trade: {selectedPO.organization.trade_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">Site Address</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedPO.site_address || "—"}
                          </div>
                        </div>
                      </div>
                      {selectedPO.delivery_contact && (
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <div className="font-medium">Delivery Contact</div>
                            <div className="text-xs text-muted-foreground">
                              {selectedPO.delivery_contact}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product and financials */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Order Details
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">Product</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedPO.product?.name}
                            {selectedPO.product?.grade && ` (${selectedPO.product.grade})`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">Quantity</div>
                          <div className="text-xs text-muted-foreground">
                            {Number(selectedPO.original_quantity).toFixed(2)} MT
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <IndianRupee className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">Locked Rate</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(selectedPO.locked_rate)} / MT
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <IndianRupee className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">Total Value</div>
                          <div className="text-lg font-bold text-success">
                            {formatCurrency(selectedPO.total_value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document section */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      PO Document
                    </div>
                    {selectedPO.document_method === "generate" && selectedPO.po_format_data ? (
                      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/10 text-primary rounded-md flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Auto-Generated PO</div>
                            <div className="text-xs text-muted-foreground">
                              Created from client format
                            </div>
                          </div>
                        </div>
                        <Button variant="default" size="sm" onClick={() => setViewGeneratedPo(selectedPO)}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          View PO
                        </Button>
                      </div>
                    ) : selectedPO.document_url ? (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/10 text-primary rounded-md flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Uploaded Document</div>
                            <div className="text-xs text-muted-foreground">
                              Method: {selectedPO.document_method}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={selectedPO.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Open PDF
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-warning/5 border border-warning/20 rounded-md text-sm text-warning">
                        <FileWarning className="h-4 w-4" />
                        No document has been uploaded for this PO.
                      </div>
                    )}
                  </div>
                </div>

                {selectedPO.status === "pending_approval" && (
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="destructive"
                      onClick={() => openConfirm("reject", selectedPO.id, selectedPO.po_number)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => openConfirm("approve", selectedPO.id, selectedPO.po_number)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Approve PO
                    </Button>
                  </DialogFooter>
                )}
                {(selectedPO.status === "approved" || selectedPO.status === "rejected") && (
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() =>
                        openConfirm(
                          selectedPO.status === "approved" ? "revert_approve" : "revert_reject",
                          selectedPO.id,
                          selectedPO.po_number,
                        )
                      }
                      disabled={revertMutation.isPending}
                    >
                      <Undo2 className="h-4 w-4 mr-1.5" />
                      {selectedPO.status === "approved" ? "Revoke Approval" : "Remove Rejection"}
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
        {/* Confirmation AlertDialog */}
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmAction(null);
              setConfirmPOId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === "approve" && "Confirm Approval"}
                {confirmAction === "reject" && "Confirm Rejection"}
                {confirmAction === "revert_approve" && "Revoke Approval"}
                {confirmAction === "revert_reject" && "Remove Rejection"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "approve" &&
                  `Are you sure you want to approve PO "${confirmPONumber}"? This will allow the client to request dispatches against this order.`}
                {confirmAction === "reject" &&
                  `Are you sure you want to reject PO "${confirmPONumber}"? The client will be notified and will need to re-submit.`}
                {confirmAction === "revert_approve" &&
                  `Are you sure you want to revoke approval for PO "${confirmPONumber}"? It will be moved back to pending approval and dispatches will no longer be allowed.`}
                {confirmAction === "revert_reject" &&
                  `Are you sure you want to remove the rejection for PO "${confirmPONumber}"? It will be moved back to pending approval for re-review.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={
                  approveMutation.isPending || rejectMutation.isPending || revertMutation.isPending
                }
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={executeConfirm}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending || revertMutation.isPending
                }
                className={
                  confirmAction === "reject"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : confirmAction === "revert_approve" || confirmAction === "revert_reject"
                      ? "bg-warning text-warning-foreground hover:bg-warning/90"
                      : ""
                }
              >
                {(approveMutation.isPending ||
                  rejectMutation.isPending ||
                  revertMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {confirmAction === "approve" && "Yes, Approve"}
                {confirmAction === "reject" && "Yes, Reject"}
                {confirmAction === "revert_approve" && "Yes, Revoke"}
                {confirmAction === "revert_reject" && "Yes, Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedPOIds.size} Purchase Order(s)? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(Array.from(selectedPOIds))}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create PO Dialog */}
        <Dialog open={createPOOpen} onOpenChange={setCreatePOOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreatePOSubmit}>
              <DialogHeader>
                <DialogTitle>Create Purchase Order (On Behalf of Client)</DialogTitle>
                <DialogDescription>
                  This PO will be created securely as an admin and assigned directly to the selected
                  client.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Select Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients || []).map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.trade_name || client.legal_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClientId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>PO Number *</Label>
                        <Input
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          required
                          placeholder="e.g. PO-2026-001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Product *</Label>
                        <Select value={productId} onValueChange={setProductId} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(products || []).map((prod: any) => (
                              <SelectItem key={prod.id} value={prod.id}>
                                {prod.name} {prod.packaging ? `- ${prod.packaging}` : ""}{" "}
                                {prod.grade ? `(${prod.grade})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quantity || ""}
                          onChange={(e) => setQuantity(parseFloat(e.target.value))}
                          required
                          placeholder="Enter quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate / MT (INR) *</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={lockedRate || ""}
                            onChange={(e) => setLockedRate(parseFloat(e.target.value))}
                            required
                            disabled={!isExceptionRate}
                          />
                          <div className="flex items-center gap-2 border px-3 py-2 rounded-md bg-muted/20 whitespace-nowrap">
                            <Switch
                              checked={isExceptionRate}
                              onCheckedChange={setIsExceptionRate}
                              id="exc-rate"
                            />
                            <Label htmlFor="exc-rate" className="text-xs cursor-pointer">
                              Exception
                            </Label>
                          </div>
                        </div>
                        {!isExceptionRate && applicableRateInfo && (
                          <div className="text-xs text-muted-foreground">
                            Using active {applicableRateInfo.source.toLowerCase()} rate.
                          </div>
                        )}
                      </div>
                    </div>

                    {quantity > 0 && lockedRate > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex justify-between items-center text-sm">
                        <div className="text-muted-foreground font-medium">Total Order Value</div>
                        <div className="text-lg font-bold text-primary flex items-center">
                          <IndianRupee className="h-4 w-4 mr-1" />
                          {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
                            quantity * lockedRate,
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-2 border-t">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Delivery Site Address *</Label>
                          {deliveryLocations && deliveryLocations.length > 0 && (
                            <Select
                              onValueChange={(val) => {
                                const loc = deliveryLocations.find((l: any) => l.address === val);
                                setSiteAddress(loc?.address || val);
                                if (loc?.contact_person) {
                                  setDeliveryContact(
                                    `${loc.contact_person} ${loc.contact_phone ? `(${loc.contact_phone})` : ""}`.trim(),
                                  );
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px] h-8 text-xs">
                                <SelectValue placeholder="Select saved address" />
                              </SelectTrigger>
                              <SelectContent>
                                {deliveryLocations.map((loc: any, i: number) => (
                                  <SelectItem key={i} value={loc.address}>
                                    {loc.label || `Location ${i + 1}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <Textarea
                          value={siteAddress}
                          onChange={(e) => setSiteAddress(e.target.value)}
                          required
                          rows={2}
                          placeholder="Enter the complete delivery address..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Site Contact Information</Label>
                        <Input
                          value={deliveryContact}
                          onChange={(e) => setDeliveryContact(e.target.value)}
                          placeholder="e.g. John Doe (9876543210)"
                        />
                      </div>
                    </div>

                    {documentMethod === "generate" && (
                      <div className="space-y-2 pt-4 border-t">
                        <Label>Format Editor</Label>
                        <Textarea 
                          value={poFormatText}
                          onChange={(e) => setPoFormatText(e.target.value)}
                          rows={8}
                          placeholder="Edit the PO template here..."
                        />
                      </div>
                    )}

                    <div className="space-y-3 pt-2 border-t">
                      <Label>PO Document</Label>
                      <div className="border rounded-md p-4 bg-muted/10 space-y-4">
                        <div className="flex gap-4">
                          <Label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="docMethod"
                              checked={documentMethod === "upload"}
                              onChange={() => setDocumentMethod("upload")}
                              className="accent-primary"
                            />
                            Upload Client PO PDF
                          </Label>
                          <Label className={`flex items-center gap-2 cursor-pointer ${!clientHasLogo ? 'text-muted-foreground' : ''}`}>
                            <input
                              type="radio"
                              name="docMethod"
                              checked={documentMethod === "generate"}
                              onChange={() => setDocumentMethod("generate")}
                              className="accent-primary"
                              disabled={!clientHasLogo}
                            />
                            Generate Proforma {(!clientHasLogo) && "(Logo Required)"}
                          </Label>
                        </div>

                        {documentMethod === "upload" && (
                          !documentFile ? (
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-accent/50 transition-colors relative bg-white">
                              <Input
                                type="file"
                                accept=".pdf,image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 1024 * 1024) {
                                      toast.error("File size must be less than 1MB");
                                      e.target.value = "";
                                      return;
                                    }
                                    setDocumentFile(file);
                                    setDocumentUrl(URL.createObjectURL(file));
                                    setDocumentMethod("upload");
                                  }
                                }}
                              />
                              <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                              <p className="text-sm font-medium">Click or drag file to upload</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Supports PDF, PNG, JPG up to 1MB
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                              <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded flex items-center justify-center">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{documentFile.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setDocumentFile(null);
                                  setDocumentUrl("");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreatePOOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPOMutation.isPending || isUploading || !selectedClientId}
                >
                  {createPOMutation.isPending || isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? "Uploading PO..." : "Create & Approve PO"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated PO Viewer Dialog */}
      <Dialog open={!!viewGeneratedPo} onOpenChange={(open) => !open && setViewGeneratedPo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50">
          <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
            <div>
              <DialogTitle className="text-lg">Generated Purchase Order</DialogTitle>
              <DialogDescription>
                {viewGeneratedPo?.po_number} - {viewGeneratedPo?.organization?.trade_name || viewGeneratedPo?.organization?.legal_name}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center print:p-0 print:bg-white">
            {viewGeneratedPo && viewGeneratedPo.po_format_data && (
              <div className="w-[210mm] min-h-[297mm] bg-white shadow-xl p-12 print:shadow-none print:w-full font-sans text-sm border border-slate-200">
                
                {/* Header with Logo */}
                <div className="flex justify-between items-start mb-8 pb-4 border-b-2 border-slate-800">
                  <div className="max-w-[50%]">
                    {viewGeneratedPo.organization?.logo_url ? (
                      <img 
                        src={viewGeneratedPo.organization.logo_url} 
                        alt="Client Logo" 
                        className="max-h-20 object-contain mb-4"
                      />
                    ) : (
                      <div className="h-16 flex items-center text-slate-400 italic">No logo provided</div>
                    )}
                    <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-800">
                      Purchase Order
                    </h1>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-lg">{viewGeneratedPo.organization?.trade_name || viewGeneratedPo.organization?.legal_name}</p>
                    <p className="text-slate-600">PO Number: <span className="font-semibold text-slate-900">{viewGeneratedPo.po_number}</span></p>
                    <p className="text-slate-600">Date: <span className="font-semibold text-slate-900">{new Date(viewGeneratedPo.created_at || Date.now()).toLocaleDateString()}</span></p>
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-6">
                  {/* Template Text */}
                  <div 
                    className="whitespace-pre-wrap leading-relaxed text-slate-700"
                    dangerouslySetInnerHTML={{
                      __html: (viewGeneratedPo.po_format_data.html_content || "")
                        .replace(/\{\{PO_NUMBER\}\}/g, viewGeneratedPo.po_number || "")
                        .replace(/\{\{CLIENT_NAME\}\}/g, viewGeneratedPo.organization?.trade_name || viewGeneratedPo.organization?.legal_name || "")
                        .replace(/\{\{DATE\}\}/g, new Date(viewGeneratedPo.created_at || Date.now()).toLocaleDateString())
                    }}
                  />
                  
                  {/* Items Table */}
                  <div className="mt-8 border rounded-lg overflow-hidden border-slate-300">
                    <Table>
                      <TableHeader className="bg-slate-100">
                        <TableRow>
                          <TableHead className="w-[50px] font-bold text-slate-800 border-r border-slate-300">S.No</TableHead>
                          <TableHead className="font-bold text-slate-800 border-r border-slate-300">Product</TableHead>
                          <TableHead className="text-right font-bold text-slate-800 border-r border-slate-300">Quantity (MT)</TableHead>
                          <TableHead className="text-right font-bold text-slate-800 border-r border-slate-300">Rate</TableHead>
                          <TableHead className="text-right font-bold text-slate-800">Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(viewGeneratedPo.items && viewGeneratedPo.items.length > 0
                          ? viewGeneratedPo.items
                          : [
                              {
                                product: viewGeneratedPo.product,
                                original_quantity: viewGeneratedPo.original_quantity,
                                locked_rate: viewGeneratedPo.locked_rate,
                              },
                            ]
                        ).map((it: any, i: number) => (
                          <TableRow key={i} className="border-b border-slate-200">
                            <TableCell className="border-r border-slate-300 font-medium">{i + 1}</TableCell>
                            <TableCell className="border-r border-slate-300">{it.product?.name || "—"}</TableCell>
                            <TableCell className="text-right border-r border-slate-300">
                              {Number(it.original_quantity).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right border-r border-slate-300">
                              {formatCurrency(it.locked_rate)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(it.original_quantity * it.locked_rate)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Footer Totals */}
                  <div className="flex justify-end pt-4">
                    <div className="w-64 space-y-2 border-t-2 border-slate-800 pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(viewGeneratedPo.total_value)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
