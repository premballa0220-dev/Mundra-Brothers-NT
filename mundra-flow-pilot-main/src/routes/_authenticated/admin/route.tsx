import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    if (context.session?.orgType !== "mundra") {
      throw redirect({ to: "/client" });
    }
  },
});
