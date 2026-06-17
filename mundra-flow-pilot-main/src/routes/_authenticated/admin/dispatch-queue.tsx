import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/dispatch-queue")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Dispatch Queue" description="Review eligibility decisions, resolve blocks and send approved releases to UltraTech." />,
});
