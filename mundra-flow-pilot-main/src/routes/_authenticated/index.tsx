import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSessionContext } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    const session = await fetchSessionContext();
    if (!session) throw redirect({ to: "/auth" });
    if (session.orgType === "mundra") throw redirect({ to: "/admin" });
    throw redirect({ to: "/client" });
  },
});
