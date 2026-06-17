import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/balance-confirmations")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Balance Confirmations" description="Configure period, sync from Drive, track uploads and enforce dispatch blocks after cutoff." />,
});
