import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Special Approvals" description="Grant scoped exceptions with amount, product, PO/dispatch, validity and approver." />,
});
