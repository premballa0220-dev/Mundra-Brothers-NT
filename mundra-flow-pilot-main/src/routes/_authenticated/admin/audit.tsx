import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Audit Trail" description="Immutable record of every sensitive change with actor, before/after values and timestamp." />,
});
