import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCreditNote, createDebitNote, getAllOrganizations } from "@/lib/api/business.functions";
import { Loader2 } from "lucide-react";
import { Textarea } from "./ui/textarea";

const CREDIT_REASONS = [
  "Rate Correction",
  "Shortage",
  "Quality Claim",
  "Discount",
  "Goods Return",
  "Other"
];

const DEBIT_REASONS = [
  "Rate Escalation",
  "Excess Dispatch",
  "Interest-Penalty",
  "Under-billing Correction",
  "Other"
];

const ORIGIN_TYPES = ["PO", "Dispatch", "Payment"];

export function CreditDebitNoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [type, setType] = useState<"credit" | "debit">("credit");
  const [issuedByOrgId, setIssuedByOrgId] = useState("");
  const [issuedToOrgId, setIssuedToOrgId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [originType, setOriginType] = useState<"PO" | "Dispatch" | "Payment">("PO");
  const [originReference, setOriginReference] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["all-orgs"],
    queryFn: () => getAllOrganizations(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuedByOrgId || !issuedToOrgId || !amount || !reason || !originType || !originReference) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        issueDate: new Date().toISOString().split("T")[0],
        amount: Number(amount),
        reason,
        remarks,
        issuedByOrgId,
        issuedToOrgId,
        originType,
        originReference,
        status: "draft" as const,
      };

      if (type === "credit") {
        await createCreditNote({
          data: {
            ...payload,
            creditNoteNumber: `CN-${Date.now()}`,
          },
        });
      } else {
        await createDebitNote({
          data: {
            ...payload,
            debitNoteNumber: `DN-${Date.now()}`,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-journal-entries"] });
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to issue note. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setType("credit");
    setAmount("");
    setReason("");
    setRemarks("");
    setOriginReference("");
    setOriginType("PO");
    setIssuedByOrgId("");
    setIssuedToOrgId("");
  };

  const reasons = type === "credit" ? CREDIT_REASONS : DEBIT_REASONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Issue Adjustment Note</DialogTitle>
          <DialogDescription>
            Create a Credit Note or Debit Note to adjust accounting ledgers. Notes will be created as "Draft".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: "credit" | "debit") => { setType(v); setReason(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit Note</SelectItem>
                  <SelectItem value="debit">Debit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issued By</Label>
              <Select value={issuedByOrgId} onValueChange={setIssuedByOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Issuer" />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.legal_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issued To (Recipient)</Label>
              <Select value={issuedToOrgId} onValueChange={setIssuedToOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Recipient" />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.map((o) => (
                    <SelectItem key={o.id} value={o.id} disabled={o.id === issuedByOrgId}>
                      {o.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origin Type</Label>
              <Select value={originType} onValueChange={(v: any) => setOriginType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGIN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origin Reference No.</Label>
              <Input
                required
                value={originReference}
                onChange={(e) => setOriginReference(e.target.value)}
                placeholder="e.g. PO-1234"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason Code</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks or details about this adjustment..."
              className="resize-none"
              required={reason === "Other"}
            />
          </div>

          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !issuedByOrgId || !issuedToOrgId || !amount || !reason || !originReference}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue {type === "credit" ? "Credit" : "Debit"} Note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
