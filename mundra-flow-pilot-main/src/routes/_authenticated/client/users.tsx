import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/client/users")({
  ssr: false,
  component: () => <StubPage variant="client" title="Users & Workflows" description="Manage internal users, role assignments and maker-checker approval rules." />,
});
