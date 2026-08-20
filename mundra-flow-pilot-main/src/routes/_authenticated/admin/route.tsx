import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const isClientRole = context.session?.roles.some((r) => r.startsWith("client_"));
    const isMundraRole = context.session?.roles.some((r) => r.startsWith("mundra_"));
    
    if (isClientRole && !isMundraRole) {
      throw redirect({ to: "/client" });
    }
    if (!isMundraRole && context.session?.orgType !== "mundra") {
      throw redirect({ to: "/client" });
    }
  },
});
