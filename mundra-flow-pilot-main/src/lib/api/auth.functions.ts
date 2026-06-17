import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  createUser,
  signInUser,
  invalidateSession,
  requireCurrentUser,
  getCurrentUser,
} from "../auth.server";
import { mapUserToSessionContext } from "../auth.server";
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
    const organizationName = "Client Organisation";
    const orgType = "client" as const;
    const roles: AppRole[] = ["client_admin"];

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
