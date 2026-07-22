import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type DashboardVariant = "executive" | "command";

const allocationData = [
  { name: "Investments", value: 52, color: "#2563eb" },
  { name: "Cash", value: 18, color: "#16a34a" },
  { name: "Gold", value: 14, color: "#d97706" },
  { name: "Business", value: 11, color: "#7c3aed" },
  { name: "Fixed Income", value: 5, color: "#64748b" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function DashboardGalleryPage() {
  const [activeVariant, setActiveVariant] =
    useState<DashboardVariant>("executive");

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Dashboard Gallery</Badge>
                <Badge variant="outline">Development only</Badge>
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                Dashboard exploration
              </h1>

              <p className="mt-2 text-muted-foreground">
                Compare different layouts using the same financial information.
              </p>
            </div>

            <Button variant="outline" asChild>
              <Link to="/design-lab">Back to Design Lab</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant={activeVariant === "executive" ? "default" : "outline"}
              onClick={() => setActiveVariant("executive")}
            >
              A — Executive
            </Button>

            <Button
              variant={activeVariant === "command" ? "default" : "outline"}
              onClick={() => setActiveVariant("command")}
            >
              B — Command Center
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        {activeVariant === "executive" ? (
          <ExecutiveDashboard />
        ) : (
          <CommandCenterDashboard />
        )}
      </section>
    </main>
  );
}

function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      <DashboardLabel
        name="Dashboard A — Executive"
        description="Clean, spacious, and focused on the most important wealth information."
      />

      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.4fr_1fr] lg:p-10">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total net worth
              </p>

              <p className="mt-3 text-5xl font-bold tracking-tight">
                {currencyFormatter.format(186240)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Badge>+8.4% this year</Badge>
                <span className="text-sm text-muted-foreground">
                  Updated a few moments ago
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Assets"
                value={currencyFormatter.format(192840)}
              />
              <Metric
                label="Liabilities"
                value={currencyFormatter.format(6600)}
              />
              <Metric
                label="Monthly growth"
                value={currencyFormatter.format(3240)}
              />
            </div>
          </div>

          <TodayChangeCard />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
  <PortfolioAllocationCard />

  <Card>
    <CardHeader>
      <CardTitle>Wealth signals</CardTitle>
      <CardDescription>
        Quick indicators about your financial position.
      </CardDescription>
    </CardHeader>

    <CardContent className="space-y-4">
      <SignalRow
        title="Cash reserve"
        value="7.2 months"
        status="Healthy"
      />

      <SignalRow
        title="Portfolio concentration"
        value="32% growth assets"
        status="Balanced"
      />

      <SignalRow
        title="Monthly contribution"
        value="$500"
        status="On track"
      />

      <SignalRow
        title="Goal completion"
        value="68%"
        status="Progressing"
      />
    </CardContent>
  </Card>
</div>

<div className="grid gap-6 lg:grid-cols-2">
  <GoalProgressCard />
  <FinancialFreedomCard compact />
</div>
}

function CommandCenterDashboard() {
  return (
    <div className="space-y-6">
      <DashboardLabel
        name="Dashboard B — Command Center"
        description="Denser layout with more information visible at the same time."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <CompactMetricCard
          label="Net worth"
          value={currencyFormatter.format(186240)}
          detail="+8.4% this year"
        />

        <CompactMetricCard
          label="Today's change"
          value="+$640"
          detail="+0.35% today"
        />

        <CompactMetricCard
          label="Goal progress"
          value="68%"
          detail="$186,240 of $275,000"
        />

        <CompactMetricCard
          label="Financial freedom"
          value="31%"
          detail="Target: $600,000"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <PortfolioAllocationCard />

        <Card>
          <CardHeader>
            <CardTitle>Wealth signals</CardTitle>
            <CardDescription>
              Quick indicators requiring your attention.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <SignalRow
              title="Cash reserve"
              value="7.2 months"
              status="Healthy"
            />

            <SignalRow
              title="Portfolio concentration"
              value="32% growth"
              status="Balanced"
            />

            <SignalRow
              title="Monthly contribution"
              value="$500"
              status="On track"
            />

            <SignalRow
              title="Goal completion"
              value="68%"
              status="Progressing"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GoalProgressCard />
        <FinancialFreedomCard compact />
      </div>
    </div>
  );
}

function DashboardLabel({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Badge variant="outline">Live React preview</Badge>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function CompactMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function TodayChangeCard() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border bg-muted/30 p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Today's change
        </p>
        <p className="mt-3 text-3xl font-bold">+$640</p>
        <p className="mt-1 text-sm font-medium">+0.35%</p>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Best contributor</span>
          <span className="font-medium">Investments</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Daily high</span>
          <span className="font-medium">+$810</span>
        </div>
      </div>
    </div>
  );
}

function PortfolioAllocationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio allocation</CardTitle>
        <CardDescription>
          Distribution of your total wealth by asset category.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid items-center gap-8 md:grid-cols-[260px_1fr]">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocationData}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                strokeWidth={0}
              >
                {allocationData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>

              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {allocationData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium">{item.name}</span>
              </div>

              <span className="text-sm font-semibold">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GoalProgressCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Goal progress</CardTitle>
        <CardDescription>
          Progress toward your medium-term wealth target.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <div className="flex items-end justify-between gap-4">
            <p className="text-4xl font-bold">68%</p>
            <p className="text-sm text-muted-foreground">
              Target: $275,000
            </p>
          </div>

          <Progress value={68} className="mt-4" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Metric label="Current" value="$186,240" />
          <Metric label="Remaining" value="$88,760" />
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialFreedomCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial freedom progress</CardTitle>
        <CardDescription>
          Estimated progress toward your long-term independence target.
        </CardDescription>
      </CardHeader>

      <CardContent
        className={
          compact
            ? "space-y-6"
            : "grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center"
        }
      >
        <div>
          <p className="text-5xl font-bold">31%</p>
          <p className="mt-2 text-sm text-muted-foreground">
            $186,240 of a $600,000 target
          </p>
        </div>

        <div className="space-y-4">
          <Progress value={31} />

          <div className="flex flex-wrap justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Estimated completion
            </span>
            <span className="font-medium">Age 50</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalRow({
  title,
  value,
  status,
}: {
  title: string;
  value: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{value}</p>
      </div>

      <Badge variant="secondary">{status}</Badge>
    </div>
  );
}