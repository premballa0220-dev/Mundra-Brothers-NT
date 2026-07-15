import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/balance-confirmations")({
  ssr: false,
  component: () => (
    <StubPage
      variant="admin"
      title="Refund Letters"
      description="Generate and manage refund letters for double payments made to suppliers."
    />
  ),
});
