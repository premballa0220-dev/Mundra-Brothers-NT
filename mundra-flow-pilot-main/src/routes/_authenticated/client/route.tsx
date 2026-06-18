import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client")({
  beforeLoad: async ({ context }) => {
    if (context.session?.orgType !== "client") {
      throw redirect({ to: "/admin" });
    }
  },
});
