import { useQuery } from "@tanstack/react-query";
import { getSessionContext } from "@/lib/api/auth.functions";
import type { SessionContext } from "@/lib/auth-types";

export type { SessionContext };

export type AppRole = SessionContext["roles"][number];
export type OrgType = SessionContext["orgType"];

export const sessionQueryKey = ["session-context"] as const;

export async function fetchSessionContext(): Promise<SessionContext | null> {
  return await getSessionContext();
}

export function useSessionContext() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSessionContext,
    staleTime: 60_000,
  });
}

export const ROLE_LABELS: Record<AppRole, string> = {
  mundra_super_admin: "Mundra Super Admin",
  mundra_accounts: "Mundra Accounts",
  mundra_po_dispatch: "Mundra PO / Dispatch",
  mundra_approver: "Mundra Approver",
  mundra_readonly: "Mundra Read-Only",
  client_admin: "Client Org Admin",
  client_po_maker: "Client PO Maker",
  client_po_approver: "Client PO Approver",
  client_payment_maker: "Client Payment Maker",
  client_payment_approver: "Client Payment Approver",
  client_accounts: "Client Accounts",
  client_readonly: "Client Read-Only",
};
