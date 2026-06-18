import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/extended-types";
import type { AuthSession, AuthUser, OrgType, SessionContext, AppRole } from "./auth-types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase environment variables: SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY.");
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

export function mapUserToSessionContext(user: AuthUser): SessionContext {
  return {
    userId: user._id,
    email: user.email,
    fullName: user.fullName,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    orgType: user.orgType,
    roles: user.roles,
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
  organizationId: string;
  organizationName: string;
  orgType: OrgType;
  roles: AppRole[];
}) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: {
        fullName: fullName?.trim() ?? null,
        organizationId,
        organizationName,
        orgType,
        roles,
        approved: false,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to create user.");
  }

  return mapSupabaseUserToAuthUser(data.user);
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || "Invalid email or password.");
  }

  return {
    accessToken: data.session.access_token,
    user: mapSupabaseUserToAuthUser(data.user),
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

  const userData = data.user;
  const metadata = (userData.user_metadata ?? {}) as Record<string, any>;
  const user: AuthUser = {
    _id: userData.id,
    userId: userData.id,
    email: (userData.email ?? "").toLowerCase().trim(),
    passwordHash: "",
    fullName: metadata.fullName ?? null,
    organizationId: metadata.organizationId ?? userData.id,
    organizationName: metadata.organizationName ?? "",
    orgType: (metadata.orgType ?? "client") as OrgType,
    roles: Array.isArray(metadata.roles)
      ? metadata.roles
      : typeof metadata.roles === "string"
      ? metadata.roles.split(",").map((role: string) => role.trim())
      : ["client_admin"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const session: AuthSession = {
    _id: token,
    userId: userData.id,
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
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("[listPendingUsers] Supabase admin error:", error.message);
    throw new Error(error.message);
  }

  const users = data.users ?? [];
  console.log(`[listPendingUsers] Found ${users.length} total users in Supabase`);

  return users.map((u) => {
    const meta = (u.user_metadata ?? {}) as Record<string, any>;
    return {
      id: u.id,
      email: u.email ?? "",
      fullName: meta.fullName ?? null,
      approved: meta.approved === true,
      orgType: meta.orgType ?? "mundra",
      roles: meta.roles ?? [],
      createdAt: u.created_at,
    };
  });
}

export async function approveUserById(userId: string, roleType: "client" | "admin") {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      approved: true,
      orgType: roleType === "admin" ? "mundra" : "client",
      roles: roleType === "admin" ? ["mundra_super_admin"] : ["client_admin"],
      organizationName: roleType === "admin" ? "Mundra Brothers" : "Client User",
    },
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function rejectUserById(userId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

