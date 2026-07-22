import { createFileRoute, Navigate } from "@tanstack/react-router";

import { DesignLabPage } from "@/features/design-lab/pages/design-lab-page";

export const Route = createFileRoute("/design-lab")({
  component: DesignLabRoute,
});

function DesignLabRoute() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" />;
  }

  return <DesignLabPage />;
}