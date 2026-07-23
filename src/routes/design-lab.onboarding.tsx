import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-lab/onboarding")({
  component: OnboardingLayout,
});

function OnboardingLayout() {
  return <Outlet />;
}