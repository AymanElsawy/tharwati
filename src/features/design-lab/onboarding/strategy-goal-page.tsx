import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const goals = [
  {
    title: "Build long-term wealth",
    description:
      "Grow your net worth steadily over time across your selected assets.",
  },
  {
    title: "Reach financial independence",
    description:
      "Build enough wealth to reduce or replace your dependence on employment income.",
  },
  {
    title: "Plan for retirement",
    description:
      "Track your progress toward a retirement target and expected retirement date.",
  },
  {
    title: "Buy a home",
    description:
      "Build and monitor the amount needed for a future home purchase.",
  },
  {
    title: "Build an emergency fund",
    description:
      "Create a cash reserve based on your preferred number of monthly expenses.",
  },
  {
    title: "Create passive income",
    description:
      "Track your progress toward a recurring income target from your assets.",
  },
];

export function StrategyGoalPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <Badge variant="secondary">Strategy Onboarding</Badge>

            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              Build your wealth strategy
            </h1>
          </div>

          <Button variant="outline" asChild>
            <Link to="/design-lab/onboarding">Back</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <p className="text-sm font-medium text-muted-foreground">
              Step 2 of 6
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              What are you building toward?
            </h2>

            <p className="mt-3 text-muted-foreground">
              Choose the financial goal that matters most to you right now.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => (
              <Card
                key={goal.title}
                className="cursor-pointer transition hover:border-primary/50"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{goal.title}</CardTitle>

                  <CardDescription className="leading-6">
                    {goal.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" asChild>
              <Link to="/design-lab/onboarding">Back</Link>
            </Button>

            <Button disabled>Continue</Button>
          </div>
        </div>
      </section>
    </main>
  );
}