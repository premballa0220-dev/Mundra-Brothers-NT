import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Reports" description="Operational, financial and compliance reports across the portfolio." />,
});
