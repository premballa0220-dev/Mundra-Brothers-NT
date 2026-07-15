import { createMiddleware } from "@tanstack/react-start";
import { mapUserToSessionContext, requireCurrentUser } from "@/lib/auth.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const result = await requireCurrentUser();
  if (!result) {
    throw new Error("Unauthorized");
  }

  return next({
    context: mapUserToSessionContext(result.user),
  });
});
