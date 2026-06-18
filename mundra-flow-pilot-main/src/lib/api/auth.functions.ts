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
    const organizationId = email;
    const organizationName = "Mundra Brothers";
    const orgType = "mundra" as const;
    const roles: AppRole[] = ["mundra_super_admin"];

    const user = await createUser({
      email,
      password: data.password,
      fullName,
      organizationId,
      organizationName,
      orgType,
      roles,
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
  .validator(z.object({ userId: z.string().min(1), roleType: z.enum(["client", "admin"]) }))
  .handler(async ({ data }) => {
    await approveUserById(data.userId, data.roleType);
    return { success: true };
  });

export const rejectUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await rejectUserById(data.userId);
    return { success: true };
  });
