import {
  ArrowLeft,
  BriefcaseBusiness,
  Car,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Plane,
  Plus,
  type LucideIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GoalCard } from "@/features/onboarding/components/GoalCard"
import { useOnboarding } from "@/features/onboarding/hooks/useOnboarding"

interface GoalOption {
  icon: LucideIcon
  id: string
  label: string
}

const goalOptions: GoalOption[] = [
  { id: "retirement", label: "Retirement", icon: Landmark },
  { id: "emergency_fund", label: "Emergency Fund", icon: HeartPulse },
  { id: "buy_home", label: "Buy a Home", icon: House },
  { id: "buy_car", label: "Buy a Car", icon: Car },
  { id: "start_business", label: "Start a Business", icon: BriefcaseBusiness },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "custom_goal", label: "Custom Goal", icon: Plus },
]

export default function GoalsPage() {
  const navigate = useNavigate()
  const { goals, setGoals } = useOnboarding()

  function toggleGoal(goalId: string) {
    setGoals(
      goals.includes(goalId)
        ? goals.filter((currentGoal) => currentGoal !== goalId)
        : [...goals, goalId],
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section
        aria-labelledby="goals-title"
        className="tharwati-card relative w-full max-w-3xl px-6 py-8 sm:px-12 sm:py-12"
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-9">
            <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              Step 4 of 5
            </p>
            <Progress value={80} aria-label="Onboarding progress: step 4 of 5" />
          </div>

          <div className="text-center">
            <h1
              id="goals-title"
              className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
            >
              What are you working toward?
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
              Choose all goals that apply. These help personalize your financial insights and
              progress tracking.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {goalOptions.map((goal) => (
              <GoalCard
                key={goal.id}
                icon={goal.icon}
                isSelected={goals.includes(goal.id)}
                label={goal.label}
                onToggle={() => toggleGoal(goal.id)}
              />
            ))}
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-xl px-6 text-base"
              onClick={() => navigate("/onboarding/currency")}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={goals.length === 0}
              className="h-12 rounded-xl px-8 text-base sm:min-w-40"
              onClick={() => navigate("/onboarding/ready")}
            >
              Continue
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
