import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  createUser,
  signInUser,
  invalidateSession,
  requireCurrentUser,
  getCurrentUser,
  listPendingUsers as listPendingUsersServer,
  approveUserById,
  rejectUserById,
  changeUserRole as changeUserRoleServer,
  deactivateUser as deactivateUserServer,
  listOrganizationUsers,
  createAdminUser,
} from "../auth.server";
import { mapUserToSessionContext } from "../auth.server";
import { requireAuth } from "@/integrations/auth/auth-middleware";
import type { AppRole } from "../auth-types";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
});

export const signIn = createServerFn({ method: "POST" })
  .validator(signInSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = request?.headers.get("x-forwarded-for") ?? "unknown";
    const userAgent = request?.headers.get("user-agent") ?? "unknown";
    const result = await signInUser({
      email: data.email,
      password: data.password,
      ip,
      userAgent,
    });

    return {
      accessToken: result.accessToken,
      session: mapUserToSessionContext(result.user),
    };
  });

export const signUp = createServerFn({ method: "POST" })
  .validator(signUpSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const email = data.email.toLowerCase().trim();
    const fullName = data.fullName?.trim() ?? null;

    const user = await createUser({
      email,
      password: data.password,
      fullName,
      // Pass undefined so the DB trigger uses the default Mundra org UUID
      organizationId: undefined,
      roles: ["mundra_readonly"],
    });

    const signInResult = await signInUser({
      email,
      password: data.password,
      ip: request?.headers.get("x-forwarded-for") ?? "unknown",
      userAgent: request?.headers.get("user-agent") ?? "unknown",
    });

    return {
      accessToken: signInResult.accessToken,
      session: mapUserToSessionContext(user),
    };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await requireCurrentUser();
  return { success: true };
});

export const getSessionContext = createServerFn({ method: "GET" }).handler(async () => {
  const current = await getCurrentUser();
  if (!current) return null;
  return mapUserToSessionContext(current.user);
});

// ─── Admin: User Approval ────────────────────────────────────────────

export const getPendingUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return await listPendingUsersServer();
  });

export const approveUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await approveUserById(data.userId);
    return { success: true };
  });

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ userId: z.string().min(1), roleType: z.string() }))
  .handler(async ({ data }) => {
    await changeUserRoleServer(data.userId, data.roleType as AppRole);
    return { success: true };
  });

export const rejectUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ userId: z.string().min(1), reason: z.string().optional() }))
  .handler(async ({ data }) => {
    await rejectUserById(data.userId, data.reason);
    return { success: true };
  });

export const deactivateUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await deactivateUserServer(data.userId);
    return { success: true };
  });

// ─── Client: User Management ──────────────────────────────────────────

export const getOrganizationUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const current = await requireCurrentUser();
    return await listOrganizationUsers(current.user.organizationId);
  });

const createClientUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  role: z.string().min(1),
});

export const createClientUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(createClientUserSchema)
  .handler(async ({ data }) => {
    const current = await requireCurrentUser();
    if (!current.user.roles.includes("client_admin")) {
      throw new Error("Unauthorized. Only Client Admin can create users.");
    }
    
    await createAdminUser({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone,
      organizationId: current.user.organizationId,
      role: data.role,
    });
    return { success: true };
  });
