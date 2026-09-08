import { createFileRoute } from "@tanstack/react-router";
import WelcomePage from "@/features/onboarding/pages/WelcomePage";

export const Route = createFileRoute("/onboarding/")({
  component: WelcomePage,
});