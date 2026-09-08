import { createFileRoute } from "@tanstack/react-router";

import { DashboardGalleryPage } from "@/features/design-lab/dashboards/dashboard-gallery-page";

export const Route = createFileRoute("/design-lab/dashboards")({
  component: DashboardGalleryPage,
});