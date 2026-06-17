import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Payments & Refunds" description="Verify client payments, raise allocations, capture TDS and generate refund letters." />,
});
