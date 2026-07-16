import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Send, Loader2, History, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  createBalanceConfirmationPeriod,
  getBalanceConfirmations,
} from "@/lib/api/business.functions";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/refund-letters")({
  ssr: false,
  component: BalanceConfirmationLetterPage,
});

function BalanceConfirmationLetterPage() {
  const queryClient = useQueryClient();
  const { data: clients } = useQuery({ queryKey: ["admin-clients"], queryFn: () => getClients() });
  const { data: confirmations, isLoading: isConfirmationsLoading } = useQuery({
    queryKey: ["admin-balance-confirmations"],
    queryFn: () => getBalanceConfirmations(),
  });
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [partyCode, setPartyCode] = useState("");
  const [tpCode, setTpCode] = useState("");
  const [outstandingAmount, setOutstandingAmount] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState("");

  const incrementRefNo = () => {
    setRefNo((prev) => {
      if (!prev) return prev;
      const match = prev.match(/(\d+)(?!.*\d)/);
      if (!match) return prev;
      const numStr = match[1];
      const nextNum = (parseInt(numStr, 10) + 1).toString();
      return (
        prev.substring(0, match.index) +
        nextNum.padStart(numStr.length, "0") +
        prev.substring(match.index! + numStr.length)
      );
    });
  };

  const handlePrint = () => {
    window.print();
    incrementRefNo();
  };

  const sendMutation = useMutation({
    mutationFn: (data: any) => createBalanceConfirmationPeriod({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-balance-confirmations"] });
      toast.success("Balance confirmation sent to client successfully");
      incrementRefNo();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to send balance confirmation");
    },
  });

  const handleSendToClient = () => {
    const client = clients?.find((c: any) => (c.trade_name || c.legal_name) === clientName);
    if (!client) {
      toast.error("Please select a client first");
      return;
    }

    sendMutation.mutate({
      organizationId: client.id,
      quarterEndDate: asOfDate,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      blockDate: asOfDate,
      outstandingAmount: Number(outstandingAmount) || undefined,
      periodFrom: periodFrom || undefined,
      periodTo: periodTo || undefined,
      refNo: refNo || undefined,
      clientName: clientName || undefined,
      clientAddress: clientAddress || undefined,
    });
  };

  const formatCurrency = (val: string) => {
    if (!val) return "________";
    const num = Number(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "________";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppShell variant="admin">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Balance Confirmation Letters
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate a formal balance confirmation letter to be signed and returned by the
                client.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Letter
              </Button>
              <Button
                onClick={handleSendToClient}
                disabled={sendMutation.isPending}
                className="gap-2"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to Client
              </Button>
            </div>
          </div>
        </header>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="mb-4 print:hidden">
            <TabsTrigger value="generate">
              <FileText className="w-4 h-4 mr-2" /> Generate Letter
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" /> Sent Confirmations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Section */}
              <div className="lg:col-span-4 space-y-6 print:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Letter Details</CardTitle>
                    <CardDescription>Fill out the fields to generate the letter.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <Label>Letter Date</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Reference No.</Label>
                      <Input
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        placeholder="e.g. MB/BC/2024-25/001"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Client Name</Label>
                      <Select
                        value={clientName}
                        onValueChange={(val) => {
                          setClientName(val);
                          const client = clients?.find(
                            (c: any) => (c.trade_name || c.legal_name) === val,
                          );
                          if (client) {
                            console.log("Selected Client Data:", client);
                            setPartyCode(client.party_code || "");
                            setTpCode(client.tp_code || "");
                            if (client.billing_address) {
                              if (typeof client.billing_address === "string") {
                                setClientAddress(client.billing_address);
                              } else {
                                const addr = [
                                  client.billing_address.street1,
                                  client.billing_address.street2,
                                  client.billing_address.city,
                                  client.billing_address.state,
                                  client.billing_address.zip,
                                ]
                                  .filter(Boolean)
                                  .join(", ");
                                setClientAddress(addr);
                              }
                            } else {
                              setClientAddress("");
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((c: any) => {
                            const name = c.trade_name || c.legal_name;
                            return (
                              <SelectItem key={c.id} value={name}>
                                {name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Client Address</Label>
                      <Textarea
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        placeholder="Full address of the client..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Party Code</Label>
                        <Input
                          value={partyCode}
                          onChange={(e) => setPartyCode(e.target.value)}
                          placeholder="Party Code"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>TP Code</Label>
                        <Input
                          value={tpCode}
                          onChange={(e) => setTpCode(e.target.value)}
                          placeholder="TP Code"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Balance As of Date</Label>
                      <Input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Outstanding Balance (₹)</Label>
                      <Input
                        type="number"
                        value={outstandingAmount}
                        onChange={(e) => setOutstandingAmount(e.target.value)}
                        placeholder="e.g. 500000"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Period From</Label>
                        <Input
                          type="date"
                          value={periodFrom}
                          onChange={(e) => setPeriodFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Period To</Label>
                        <Input
                          type="date"
                          value={periodTo}
                          onChange={(e) => setPeriodTo(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Letter Preview Section */}
              <div className="lg:col-span-8 print:col-span-12">
                <Card className="print:shadow-none print:border-none">
                  <CardContent className="p-8 sm:p-12 min-h-[800px] bg-white text-black font-serif text-base leading-relaxed print:p-0 print:min-h-0">
                    <div className="max-w-[800px] mx-auto space-y-6">
                      {/* Letterhead */}
                      <div className="border-b-2 border-black pb-4 mb-8 text-center">
                        <h1 className="text-2xl font-bold uppercase tracking-wider">
                          Mundra Brothers
                        </h1>
                        <p className="text-sm">Balance Confirmation Letter</p>
                      </div>

                      <div className="flex justify-between items-start">
                        <div className="space-y-1 text-sm">
                          {refNo && (
                            <p>
                              <strong>Ref No:</strong> {refNo}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <p>
                            <strong>Date:</strong> {formatDate(date)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 mt-4">
                        <p>To,</p>
                        <p className="font-semibold">{clientName || "____________________"}</p>
                        {partyCode && (
                          <p className="text-sm">
                            <strong>Party Code:</strong> {partyCode}
                          </p>
                        )}
                        {tpCode && (
                          <p className="text-sm">
                            <strong>TP Code:</strong> {tpCode}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-sm">
                          {clientAddress || "____________________"}
                        </p>
                      </div>

                      <div className="my-6">
                        <p className="font-bold underline text-center">
                          Subject: Confirmation of Outstanding Balance as on {formatDate(asOfDate)}
                        </p>
                      </div>

                      <div className="space-y-4 text-sm">
                        <p>Dear Sir/Madam,</p>
                        <p>
                          As part of our routine accounting and audit procedures, we are writing to
                          request your confirmation of the outstanding balance in your account with
                          us, <strong>Mundra Brothers</strong>, as at{" "}
                          <strong>{formatDate(asOfDate)}</strong>.
                        </p>
                        <p>
                          As per our records, the balance outstanding against your account for the
                          period <strong>{formatDate(periodFrom)}</strong> to{" "}
                          <strong>{formatDate(periodTo)}</strong> stands at:
                        </p>

                        <div className="my-4">
                          <table className="w-full max-w-md border-collapse border border-gray-400 text-sm">
                            <tbody>
                              <tr>
                                <td className="border border-gray-400 p-2 font-medium bg-gray-50 print:bg-transparent">
                                  Client Name
                                </td>
                                <td className="border border-gray-400 p-2 font-semibold">
                                  {clientName || "________"}
                                </td>
                              </tr>
                              <tr>
                                <td className="border border-gray-400 p-2 font-medium bg-gray-50 print:bg-transparent">
                                  Balance As On
                                </td>
                                <td className="border border-gray-400 p-2 font-semibold">
                                  {formatDate(asOfDate)}
                                </td>
                              </tr>
                              <tr>
                                <td className="border border-gray-400 p-2 font-medium bg-gray-50 print:bg-transparent">
                                  Outstanding Amount
                                </td>
                                <td className="border border-gray-400 p-2 font-semibold text-base">
                                  {formatCurrency(outstandingAmount)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <p>
                          Kindly confirm the correctness of the above balance by signing and
                          returning the attached acknowledgement slip at the earliest. In case of
                          any discrepancy, please provide your statement of account along with
                          supporting documents so that we may reconcile and update our records
                          accordingly.
                        </p>
                        <p>
                          If we do not receive your response within <strong>15 days</strong> from
                          the date of this letter, we shall assume that the balance as stated above
                          is agreed and accepted by you.
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

                      {/* Acknowledgement Slip */}
                      <div className="mt-12 pt-6 border-t-2 border-dashed border-gray-400">
                        <p className="text-center font-bold text-sm uppercase tracking-wide mb-4">
                          — Acknowledgement Slip (To be signed and returned) —
                        </p>
                        <div className="space-y-3 text-sm">
                          <p>
                            We, <strong>{clientName || "____________________"}</strong>, hereby
                            confirm that the balance outstanding in our account with{" "}
                            <strong>Mundra Brothers</strong> as on{" "}
                            <strong>{formatDate(asOfDate)}</strong> is{" "}
                            <strong>{formatCurrency(outstandingAmount)}</strong>.
                          </p>
                          <p className="mt-2">
                            ☐ &nbsp;The balance as stated above is <strong>correct</strong>.
                          </p>
                          <p>
                            ☐ &nbsp;The balance as stated above is <strong>not correct</strong>. Our
                            balance stands at ₹ __________ (details attached).
                          </p>

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
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="m-0 print:hidden">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Sent Balance Confirmations
                </CardTitle>
                <CardDescription>
                  Review the balance confirmation letters sent to clients.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Date Sent</TableHead>
                      <TableHead>Ref No</TableHead>
                      <TableHead>Outstanding Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isConfirmationsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : confirmations && confirmations.length > 0 ? (
                      confirmations.map((conf: any) => (
                        <TableRow key={conf.id}>
                          <TableCell className="font-medium">{conf.client_name || "—"}</TableCell>
                          <TableCell>{formatDate(conf.created_at)}</TableCell>
                          <TableCell>{conf.ref_no || "—"}</TableCell>
                          <TableCell className="font-semibold">
                            {conf.outstanding_amount != null
                              ? formatCurrency(String(conf.outstanding_amount))
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                conf.status === "Approved"
                                  ? "default"
                                  : conf.status === "under_review"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {conf.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          No balance confirmations sent yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
