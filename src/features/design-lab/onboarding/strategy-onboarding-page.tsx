import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Car,
  Check,
  CircleDollarSign,
  Gem,
  Landmark,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TrackingOption = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
};

const trackingOptions: TrackingOption[] = [
  {
    id: "cash",
    title: "Cash & Bank Accounts",
    description: "Track cash, savings, and bank balances.",
    icon: Landmark,
  },
  {
    id: "investments",
    title: "Investments",
    description: "Track stocks, ETFs, funds, and portfolios.",
    icon: CircleDollarSign,
  },
  {
    id: "gold",
    title: "Gold & Precious Metals",
    description: "Track gold, silver, and other precious metals.",
    icon: Gem,
  },
  {
    id: "real-estate",
    title: "Real Estate",
    description: "Track properties, land, and real estate value.",
    icon: Building2,
  },
  {
    id: "business",
    title: "Business",
    description: "Include business ownership in your net worth.",
    icon: BriefcaseBusiness,
  },
  {
    id: "vehicles",
    title: "Vehicles",
    description: "Track cars and other valuable vehicles.",
    icon: Car,
  },
  {
    id: "debts",
    title: "Debts & Loans",
    description: "Track loans, mortgages, and other liabilities.",
    icon: Banknote,
  },
  {
    id: "goals",
    title: "Financial Goals",
    description: "Plan retirement, purchases, and custom goals.",
    icon: Target,
  },
];

export function StrategyOnboardingPage() {
  const navigate = useNavigate();

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  function toggleOption(optionId: string) {
    setSelectedOptions((currentOptions) => {
      if (currentOptions.includes(optionId)) {
        return currentOptions.filter((id) => id !== optionId);
      }

      return [...currentOptions, optionId];
    });
  }

  function handleContinue() {
    if (selectedOptions.length === 0) {
      return;
    }

    sessionStorage.setItem(
      "tharwati-selected-modules",
      JSON.stringify(selectedOptions),
    );

    navigate({
      to: "/design-lab/onboarding/goal",
    });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Step 1 of 5
            </span>

            <span className="text-sm text-muted-foreground">
              {selectedOptions.length} selected
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/5 rounded-full bg-primary" />
          </div>
        </header>

        <section>
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What would you like to track?
            </h1>

            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Select everything that applies. You can change these modules
              later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trackingOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedOptions.includes(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleOption(option.id)}
                  className={cn(
                    "relative flex min-h-36 w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all",
                    "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <div className="pr-8">
                    <h2 className="font-semibold">{option.title}</h2>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {option.description}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "absolute right-4 top-4 flex size-6 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background",
                    )}
                  >
                    {isSelected && <Check className="size-4" />}
                  </div>
                </button>
              );
            })}
          </div>

          <footer className="mt-10 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Choose at least one option to continue.
            </p>

            <Button
              type="button"
              size="lg"
              disabled={selectedOptions.length === 0}
              onClick={handleContinue}
              className="min-w-36"
            >
              Continue
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}