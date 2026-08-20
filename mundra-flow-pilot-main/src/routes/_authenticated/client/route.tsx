import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client")({
  beforeLoad: async ({ context }) => {
    const isClientRole = context.session?.roles.some((r) => r.startsWith("client_"));
    const isMundraRole = context.session?.roles.some((r) => r.startsWith("mundra_"));
    
    if (isMundraRole && !isClientRole) {
      throw redirect({ to: "/admin" });
    }
    if (!isClientRole && context.session?.orgType !== "client") {
      throw redirect({ to: "/admin" });
    }
  },
});
