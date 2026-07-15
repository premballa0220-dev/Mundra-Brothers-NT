import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/client/documents")({
  ssr: false,
  component: () => (
    <StubPage
      variant="client"
      title="Documents"
      description="Repository of POs, refund letters, balance confirmations and other shared documents."
    />
  ),
});
