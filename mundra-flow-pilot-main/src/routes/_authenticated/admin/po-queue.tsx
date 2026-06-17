import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/po-queue")({
  ssr: false,
  component: () => <StubPage variant="admin" title="PO Queue" description="Review submitted POs, validate documents and authorise them through the engine." />,
});
