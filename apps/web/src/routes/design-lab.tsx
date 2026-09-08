import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/design-lab")({
  component: DesignLabLayout,
});

function DesignLabLayout() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
}