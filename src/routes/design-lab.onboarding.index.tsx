import { createFileRoute } from "@tanstack/react-router";

import { StrategyOnboardingPage } from "@/features/design-lab/onboarding/strategy-onboarding-page";

export const Route = createFileRoute("/design-lab/onboarding/")({
  component: StrategyOnboardingPage,
});