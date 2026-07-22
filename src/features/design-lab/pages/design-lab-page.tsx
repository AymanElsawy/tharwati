import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LabSection = {
  title: string;
  description: string;
  status: "Ready" | "Next" | "Planned";
  href?: "/design-lab/dashboards";
};

const labSections: LabSection[] = [
  {
    title: "Dashboard Gallery",
    description:
      "Compare complete dashboard concepts and review different visual directions.",
    status: "Ready",
    href: "/design-lab/dashboards",
  },
  {
    title: "Component Gallery",
    description:
      "Review cards, buttons, tables, badges, inputs, and other reusable components.",
    status: "Next",
  },
  {
    title: "Theme Studio",
    description:
      "Experiment with colors, typography, spacing, borders, and interface density.",
    status: "Planned",
  },
  {
    title: "Chart Gallery",
    description:
      "Compare wealth charts, allocation charts, growth charts, and progress visuals.",
    status: "Planned",
  },
];

function getStatusVariant(status: LabSection["status"]) {
  if (status === "Ready") {
    return "default" as const;
  }

  if (status === "Next") {
    return "secondary" as const;
  }

  return "outline" as const;
}

export function DesignLabPage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <section className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Internal development tool</Badge>
            <Badge variant="outline">Design Lab v0.2</Badge>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Tharwati Design Lab
            </h1>

            <p className="text-lg leading-8 text-muted-foreground">
              A private workspace for designing, comparing, and approving the
              Tharwati interface before connecting real financial data.
            </p>
          </div>

          <Button asChild className="w-fit">
            <Link to="/">Return to application</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Design workspaces
          </h2>

          <p className="mt-2 text-muted-foreground">
            Each workspace contains live React components, not static images.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {labSections.map((section) => (
            <Card key={section.title} className="flex min-h-64 flex-col">
              <CardHeader>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl border bg-muted font-semibold">
                    {section.title.charAt(0)}
                  </div>

                  <Badge variant={getStatusVariant(section.status)}>
                    {section.status}
                  </Badge>
                </div>

                <CardTitle>{section.title}</CardTitle>

                <CardDescription className="leading-6">
                  {section.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                  Review this workspace independently before approving its
                  components for the production application.
                </div>
              </CardContent>

              <CardFooter>
                {section.href ? (
                  <Button asChild className="w-full">
                    <Link to={section.href}>Open workspace</Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Not available yet
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}