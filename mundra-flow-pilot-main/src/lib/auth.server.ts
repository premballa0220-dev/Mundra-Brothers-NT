import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/extended-types";
import type { AuthSession, AuthUser, OrgType, SessionContext, AppRole } from "./auth-types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Supabase environment variables: SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.",
  );
}

function createSupabaseClient(token?: string) {
  return createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    },
  });
}

export function createSupabaseAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }
  return createClient<Database>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isTransientNetworkError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "");
  const cause = String(err?.cause?.code ?? err?.cause?.message ?? "");
  return /fetch failed|network|socket hang up|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(
    `${msg} ${cause}`,
  );
}

/**
 * Runs a Supabase call, retrying only on transient network failures (e.g. the
 * backend waking from idle). Real errors returned as `{ error }` are untouched;
 * only thrown network errors trigger a retry. If it still fails, a clear,
 * user-facing message replaces the raw "fetch failed".
 */
async function withRetry<T>(fn: () => PromiseLike<T>): Promise<T> {
  const maxAttempts = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientNetworkError(err) || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  if (isTransientNetworkError(lastErr)) {
    throw new Error(
      "Couldn't reach the authentication service — it may be waking up from idle. Please wait a few seconds and try again.",
    );
  }
  throw lastErr;
}

export function mapUserToSessionContext(user: AuthUser): SessionContext {
  return {
    userId: user._id,
    email: user.email,
    fullName: user.fullName,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    orgType: user.orgType,
    roles: user.roles,
    approvalStatus: user.approvalStatus,
  };
}

function mapSupabaseUserToAuthUser(user: any): AuthUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, any>;
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles
    : typeof metadata.roles === "string"
      ? metadata.roles.split(",").map((role: string) => role.trim())
      : ["client_admin"];

  return {
    _id: user.id,
    userId: user.id,
    email: (user.email ?? "").toLowerCase().trim(),
    passwordHash: "",
    fullName: metadata.fullName ?? null,
    organizationId: metadata.organizationId ?? user.id,
    organizationName: metadata.organizationName ?? "",
    orgType: (metadata.orgType ?? "client") as OrgType,
    roles: roles as AppRole[],
    approvalStatus: metadata.approvalStatus ?? "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function createUser({
  email,
  password,
  fullName,
  organizationId,
  organizationName,
  orgType,
  roles,
}: {
  email: string;
  password: string;
  fullName?: string | null;
  organizationId?: string;
  organizationName?: string;
  orgType?: OrgType;
  roles: AppRole[];
}) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: {
        fullName: fullName?.trim() ?? null,
        organization_id: organizationId,
        role: roles[0] ?? "client_readonly",
        phone: null,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to create user.");
  }

  // The DB trigger handles creating the profile and assigning the role.
  // We need to fetch the DB profile to return the correct AuthUser.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*, organizations(legal_name, org_type)")
    .eq("id", data.user.id)
    .single();

  if (!profile || profileError) {
    throw new Error("Profile creation failed after sign up.");
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  return {
    _id: data.user.id,
    userId: data.user.id,
    email: data.user.email ?? "",
    passwordHash: "",
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.legal_name ?? "",
    orgType: profile.organizations?.org_type ?? "client",
    roles: roleData?.map((ur: any) => ur.role) || [],
    approvalStatus: profile.approval_status ?? "pending",
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  };
}

export async function createAdminUser({
  email,
  password,
  fullName,
  organizationId,
  role,
  phone,
}: {
  email: string;
  password?: string;
  fullName: string;
  organizationId: string;
  role: string;
  phone?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName.trim(),
      organization_id: organizationId,
      role,
      phone,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to create user.");
  }
  return data.user;
}

export async function signInUser({
  email,
  password,
  ip,
  userAgent,
}: {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}) {
  const supabase = createSupabaseClient();
  const { data, error } = await withRetry(() =>
    supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    }),
  );

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || "Invalid email or password.");
  }

  // Fetch from DB to ensure approval status and accurate roles
  const adminClient = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await withRetry(() =>
    adminClient
      .from("profiles")
      .select("*, organizations(legal_name, org_type)")
      .eq("id", data.user.id)
      .single(),
  );

  if (profileError) {
    console.error("Error fetching profile:", profileError.message);
  }

  if (!profile) {
    throw new Error(
      "User profile not found. If you just registered, your profile might be pending creation.",
    );
  }

  if (profile.approval_status === "rejected") {
    throw new Error("Account has been rejected. Please contact administrator.");
  }
  if (profile.approval_status === "pending") {
    throw new Error("Account pending approval. You cannot log in yet.");
  }

  const { data: roleData } = await withRetry(() =>
    adminClient.from("user_roles").select("role").eq("user_id", data.user.id),
  );

  const authUser: AuthUser = {
    _id: data.user.id,
    userId: data.user.id,
    email: data.user.email ?? "",
    passwordHash: "",
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.legal_name ?? "",
    orgType: profile.organizations?.org_type ?? "client",
    roles: roleData?.map((ur: any) => ur.role) || [],
    approvalStatus: profile.approval_status,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  };

  return {
    accessToken: data.session.access_token,
    user: authUser,
  };
}

export async function invalidateSession(): Promise<void> {
  // Supabase auth sign-out is handled client-side by clearing the local token.
  return;
}

export async function getUserFromToken(token: string) {
  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(legal_name, org_type)")
    .eq("id", data.user.id)
    .single();

  if (!profile) return null;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  const user: AuthUser = {
    _id: data.user.id,
    userId: data.user.id,
    email: (data.user.email ?? "").toLowerCase().trim(),
    passwordHash: "",
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.legal_name ?? "",
    orgType: profile.organizations?.org_type ?? "client",
    roles: roleData?.map((ur: any) => ur.role) || [],
    approvalStatus: profile.approval_status ?? "pending",
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  };

  const session: AuthSession = {
    _id: token,
    userId: data.user.id,
    userAgent: "",
    ip: "",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    revoked: false,
  };

  return { user, session };
}

export async function getCurrentUser() {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return null;
  }

  try {
    return await getUserFromToken(token);
  } catch (error) {
    return null;
  }
}

export async function requireCurrentUser() {
  const result = await getCurrentUser();
  if (!result) {
    throw new Error("Unauthorized");
  }
  return result;
}

// ─── Admin user management ───────────────────────────────────────────

export async function listPendingUsers() {
  const supabase = createSupabaseAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, approval_status, created_at, organizations(legal_name, org_type)",
    );

  if (error) throw new Error(error.message);

  const { data: rolesData } = await supabase.from("user_roles").select("*");

  return profiles.map((p: any) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    approved: p.approval_status === "approved",
    approvalStatus: p.approval_status,
    orgType: p.organizations?.org_type ?? "mundra",
    organizationName: p.organizations?.legal_name ?? "Unknown",
    roles: rolesData?.filter((r: any) => r.user_id === p.id).map((ur: any) => ur.role) || [],
    createdAt: p.created_at,
  }));
}

export async function approveUserById(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function rejectUserById(userId: string, reason?: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected", status_reason: reason })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function changeUserRole(userId: string, newRole: AppRole) {
  const supabase = createSupabaseAdminClient();
  // We delete existing and insert new
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { data, error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: newRole })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deactivateUser(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function listOrganizationUsers(organizationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, approval_status, is_active, created_at")
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);

  const { data: rolesData } = await supabase.from("user_roles").select("*");

  return profiles.map((p: any) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    phone: p.phone,
    approved: p.approval_status === "approved",
    approvalStatus: p.approval_status,
    isActive: p.is_active,
    roles: rolesData?.filter((r: any) => r.user_id === p.id).map((ur: any) => ur.role) || [],
    createdAt: p.created_at,
  }));
}
