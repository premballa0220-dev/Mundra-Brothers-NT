import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  ssr: false,
  component: () => <StubPage variant="admin" title="Platform Settings" description="Branding, notification templates, integrations and platform-wide configuration." />,
});
