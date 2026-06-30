import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBalanceConfirmations, clientApproveBalanceConfirmation } from "@/lib/api/business.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/client/balance-confirmations")({
  ssr: false,
  component: ClientBalanceConfirmationsPage,
});

function ClientBalanceConfirmationsPage() {
  const queryClient = useQueryClient();
  const { data: confirmations, isLoading } = useQuery({
    queryKey: ["client-balance-confirmations"],
    queryFn: () => getBalanceConfirmations(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => clientApproveBalanceConfirmation({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-balance-confirmations"] });
      toast.success("Balance confirmation approved successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to approve balance confirmation");
    },
  });

  const [selectedLetter, setSelectedLetter] = useState<any>(null);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "________";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (val?: number | null) => {
    if (val == null) return "________";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <AppShell variant="client">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Balance Confirmations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and acknowledge balance confirmations sent by Mundra Brothers.
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Confirmations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref No</TableHead>
                    <TableHead>Quarter End Date</TableHead>
                    <TableHead>Outstanding Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations && confirmations.length > 0 ? (
                    confirmations.map((conf: any) => (
                      <TableRow key={conf.id}>
                        <TableCell className="font-medium">{conf.ref_no || "—"}</TableCell>
                        <TableCell>{formatDate(conf.quarter_end_date)}</TableCell>
                        <TableCell className="font-semibold">{conf.outstanding_amount != null ? formatCurrency(conf.outstanding_amount) : "—"}</TableCell>
                        <TableCell>{formatDate(conf.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant={conf.status === "Approved" ? "default" : conf.status === "under_review" ? "secondary" : "outline"}>
                            {conf.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedLetter(conf)}>
                              <FileText className="h-4 w-4 mr-2" /> View Letter
                            </Button>
                            {conf.status !== "Approved" && (
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(conf.id)}
                                disabled={approveMutation.isPending}
                              >
                                {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No balance confirmations found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedLetter} onOpenChange={(o) => !o && setSelectedLetter(null)}>
        <DialogContent className="max-w-[800px] h-[80vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>Balance Confirmation Letter</DialogTitle>
          </DialogHeader>

          {selectedLetter && (
            <div className="bg-white text-black font-serif text-base leading-relaxed p-8 mt-4 border">
              <div className="max-w-[700px] mx-auto space-y-6">
                <div className="border-b-2 border-black pb-4 mb-8 text-center">
                  <h1 className="text-2xl font-bold uppercase tracking-wider">Mundra Brothers</h1>
                  <p className="text-sm">Balance Confirmation Letter</p>
                </div>

                <div className="flex justify-between items-start">
                  <div className="space-y-1 text-sm">
                    {selectedLetter.ref_no && <p><strong>Ref No:</strong> {selectedLetter.ref_no}</p>}
                  </div>
                  <div className="text-right text-sm">
                    <p><strong>Date:</strong> {formatDate(selectedLetter.created_at)}</p>
                  </div>
                </div>

                <div className="space-y-1 mt-4">
                  <p>To,</p>
                  <p className="font-semibold">{selectedLetter.client_name || "____________________"}</p>
                  <p className="whitespace-pre-wrap text-sm">{selectedLetter.client_address || "____________________"}</p>
                </div>

                <div className="my-6">
                  <p className="font-bold underline text-center">
                    Subject: Confirmation of Outstanding Balance as on {formatDate(selectedLetter.block_date)}
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <p>Dear Sir/Madam,</p>
                  <p>
                    As part of our routine accounting and audit procedures, we are writing to request your confirmation of the outstanding balance in your account with us, <strong>Mundra Brothers</strong>, as at <strong>{formatDate(selectedLetter.block_date)}</strong>.
                  </p>
                  <p>
                    As per our records, the balance outstanding against your account for the period <strong>{formatDate(selectedLetter.period_from)}</strong> to <strong>{formatDate(selectedLetter.period_to)}</strong> stands at:
                  </p>

                  <div className="my-4">
                    <table className="w-full max-w-md border-collapse border border-gray-400 text-sm">
                      <tbody>
                        <tr>
                          <td className="border border-gray-400 p-2 font-medium bg-gray-50">Client Name</td>
                          <td className="border border-gray-400 p-2 font-semibold">{selectedLetter.client_name || "________"}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-400 p-2 font-medium bg-gray-50">Balance As On</td>
                          <td className="border border-gray-400 p-2 font-semibold">{formatDate(selectedLetter.block_date)}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-400 p-2 font-medium bg-gray-50">Outstanding Amount</td>
                          <td className="border border-gray-400 p-2 font-semibold text-base">{formatCurrency(selectedLetter.outstanding_amount)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p>
                    Kindly confirm the correctness of the above balance by signing and returning the attached acknowledgement slip at the earliest. In case of any discrepancy, please provide your statement of account along with supporting documents so that we may reconcile and update our records accordingly.
                  </p>
                  <p>
                    If we do not receive your response within <strong>15 days</strong> from the date of this letter, we shall assume that the balance as stated above is agreed and accepted by you.
                  </p>
                  <p>We appreciate your cooperation in this matter.</p>
                </div>

                <div className="mt-12 pt-6">
                  <p>Yours faithfully,</p>
                  <div className="mt-12">
                    <p className="font-semibold">Authorized Signatory</p>
                    <p>For Mundra Brothers</p>
                  </div>
                </div>

                <div className="mt-12 pt-6 border-t-2 border-dashed border-gray-400">
                  <p className="text-center font-bold text-sm uppercase tracking-wide mb-4">— Acknowledgement Slip (To be signed and returned) —</p>
                  <div className="space-y-3 text-sm">
                    <p>
                      We, <strong>{selectedLetter.client_name || "____________________"}</strong>, hereby confirm that the balance outstanding in our account with <strong>Mundra Brothers</strong> as on <strong>{formatDate(selectedLetter.block_date)}</strong> is <strong>{formatCurrency(selectedLetter.outstanding_amount)}</strong>.
                    </p>
                    <p className="mt-2">☐ &nbsp;The balance as stated above is <strong>correct</strong>.</p>
                    <p>☐ &nbsp;The balance as stated above is <strong>not correct</strong>. Our balance stands at ₹ __________ (details attached).</p>

                    <div className="mt-8 grid grid-cols-2 gap-8">
                      <div>
                        <div className="border-b border-black mt-8 mb-1"></div>
                        <p className="text-xs">Signature</p>
                      </div>
                      <div>
                        <div className="border-b border-black mt-8 mb-1"></div>
                        <p className="text-xs">Date</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="border-b border-black mt-6 mb-1"></div>
                      <p className="text-xs">Name &amp; Designation / Seal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
