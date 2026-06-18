import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBalanceConfirmations, uploadBalanceConfirmation, getInvoices } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, UploadCloud, AlertCircle, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/ledgers")({
  ssr: false,
  component: ClientLedgersPage,
});

function ClientLedgersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedConfId, setSelectedConfId] = useState("");
  const [signedPdfUrl, setSignedPdfUrl] = useState("");

  const { data: confirmations, isLoading: confsLoading } = useQuery({
    queryKey: ["client-confirmations"],
    queryFn: () => getBalanceConfirmations(),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-invoices"],
    queryFn: () => getInvoices(),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { id: string; signedPdfUrl: string }) =>
      uploadBalanceConfirmation({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-confirmations"] });
      toast.success("Signed balance confirmation uploaded for audit verification!");
      setOpen(false);
      setSignedPdfUrl("");
      setSelectedConfId("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to upload confirmation");
    },
  });

  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConfId) return;
    uploadMutation.mutate({
      id: selectedConfId,
      signedPdfUrl: signedPdfUrl || "https://example.com/demo-signed-conf.pdf", // Mock link
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pendingConfirmation = confirmations?.find(
    (c: any) => c.status === "pending_upload" || c.status === "rejected"
  );

  return (
    <AppShell variant="client">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Ledgers & Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Monitor outstanding invoices, track quarterly statements, and upload signed balance confirmation audits.
          </p>
        </header>

        {pendingConfirmation && (
          <Alert variant="default" className="border-warning/50 bg-warning/5">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold">Action Required: Quarterly Statement Pending</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p className="text-sm">
                Your statement for quarter ending{" "}
                <span className="font-bold">{new Date(pendingConfirmation.quarter_end_date).toLocaleDateString()}</span>{" "}
                must be signed and returned by <span className="font-bold">{new Date(pendingConfirmation.due_date).toLocaleDateString()}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Critical: Material dispatch will be automatically suspended if unsubmitted past the block date:{" "}
                <span className="font-bold text-destructive">{new Date(pendingConfirmation.block_date).toLocaleDateString()}</span>.
              </p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSelectedConfId(pendingConfirmation.id);
                      setOpen(true);
                    }}
                  >
                    <UploadCloud className="h-4 w-4 mr-2" /> Upload Signed Confirmation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleUploadSubmit}>
                    <DialogHeader>
                      <DialogTitle>Upload Signed Confirmation</DialogTitle>
                      <DialogDescription>
                        Attach the signed and stamped balance confirmation document.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-1">
                        <Label htmlFor="pdfUrl">Signed PDF URL *</Label>
                        <Input
                          id="pdfUrl"
                          value={signedPdfUrl}
                          onChange={(e) => setSignedPdfUrl(e.target.value)}
                          placeholder="Paste document link or URL"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={uploadMutation.isPending}>
                        {uploadMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Confirm Upload
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Balance Confirmation Status</CardTitle>
              <CardDescription>Statements assigned for verification.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations && confirmations.length > 0 ? (
                    confirmations.map((conf: any) => (
                      <TableRow key={conf.id}>
                        <TableCell className="font-semibold text-xs">
                          {new Date(conf.quarter_end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              conf.status === "approved"
                                  ? "default"
                                  : conf.status === "under_review" || conf.status === "pending_upload"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="capitalize"
                          >
                            {conf.status === "pending_upload" ? "Pending Upload" : conf.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {conf.source_pdf_url && (
                            <a
                              href={conf.source_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              <FileText className="h-3 w-3" /> Source
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                        No confirmations requested.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Outstanding Invoices Ledger</CardTitle>
              <CardDescription>Real-time log of unpaid billings.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices && invoices.length > 0 ? (
                    invoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                        <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-bold text-success">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.status === "paid"
                                  ? "default"
                                  : inv.status === "partially_paid"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="capitalize"
                          >
                            {inv.status === "partially_paid" ? "Partially Paid" : inv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No outstanding invoices found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
