import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSessionContext } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    const session = await fetchSessionContext();
    if (!session) throw redirect({ to: "/auth" });
    const isMundraRole = session.roles.some((r) => r.startsWith("mundra_"));
    if (isMundraRole || session.orgType === "mundra") {
      // But if they only have client roles, they shouldn't go to admin
      if (!isMundraRole && session.roles.some((r) => r.startsWith("client_"))) {
        throw redirect({ to: "/client" });
      }
      throw redirect({ to: "/admin" });
    }
    throw redirect({ to: "/client" });
  },
});
