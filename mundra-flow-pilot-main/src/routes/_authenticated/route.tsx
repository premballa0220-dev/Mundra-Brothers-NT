import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionContext } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionContext();
    if (!session) throw redirect({ to: "/auth" });
    return { session };
  },
  component: () => <Outlet />,
});
