import { createFileRoute } from "@tanstack/react-router";

import { StrategyGoalPage } from "@/features/design-lab/onboarding/strategy-goal-page";

export const Route = createFileRoute("/design-lab/onboarding/goal")({
  component: StrategyGoalPage,
});