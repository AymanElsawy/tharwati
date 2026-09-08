import { createFileRoute } from "@tanstack/react-router";

import { DesignLabPage } from "@/features/design-lab/pages/design-lab-page";

export const Route = createFileRoute("/design-lab/")({
  component: DesignLabPage,
});