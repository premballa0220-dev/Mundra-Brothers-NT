export type AppRole =
  | "mundra_super_admin"
  | "mundra_accounts"
  | "mundra_po_dispatch"
  | "mundra_approver"
  | "mundra_readonly"
  | "client_admin"
  | "client_po_maker"
  | "client_po_approver"
  | "client_payment_maker"
  | "client_payment_approver"
  | "client_accounts"
  | "client_readonly";

export type OrgType = "mundra" | "client";

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string;
  organizationName: string;
  orgType: OrgType;
  roles: AppRole[];
}

export interface AuthUser extends SessionContext {
  _id: string;
  passwordHash: string;
  disabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  _id: string;
  userId: string;
  userAgent: string;
  ip: string;
  createdAt: Date;
  expiresAt: Date;
  revoked?: boolean;
}
