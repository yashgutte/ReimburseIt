import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomePathForRole } from "../lib/dashboard-nav";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const tiles = [
  {
    title: "Submit & track",
    text: "Employees submit expenses with receipts; status visible end to end.",
    span: "md:col-span-4",
  },
  {
    title: "Approvals",
    text: "Managers review queues and approve or reject with full context.",
    span: "md:col-span-4",
  },
  {
    title: "Company rules",
    text: "Admins configure companies, users, and rules per category.",
    span: "md:col-span-4",
  },
  {
    title: "Currency aware",
    text: "Amounts reconcile to your company base currency.",
    span: "md:col-span-6",
  },
  {
    title: "Secure access",
    text: "Role-based dashboards for admin, manager, and employee.",
    span: "md:col-span-6",
  },
];

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  const dash = getHomePathForRole(user?.role, user?.roles);

  return (
    <div className="relative">
      <section className="page-shell">
        <div className="mx-auto max-w-4xl text-center">
          <Badge
            variant="outline"
            className="mb-4 border-cyan-500/30 bg-cyan-500/5 text-xs font-normal uppercase tracking-[0.2em] text-cyan-400 shadow-glow-cyan-soft"
          >
            ReimburseIt
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-white md:text-5xl">
            <span className="text-gradient-accent">Developer-grade</span>{" "}
            expense control
          </h1>
          <p className="mt-4 text-pretty text-sm text-gray-400 md:text-base">
            Dark, fast, minimal. One surface for claims, approvals, and org
            settings—without the clutter.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {!isAuthenticated ? (
              <Button size="lg" className="px-6" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            ) : (
              <Button size="lg" className="px-6" asChild>
                <Link to={dash}>Open dashboard</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-12 gap-4">
          {tiles.map((t) => (
            <Card
              key={t.title}
              className={`group col-span-12 border-white/10 bg-neutral-950/60 shadow-none backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:border-cyan-500/25 hover:shadow-glow-cyan-soft ${t.span}`}
            >
              <CardContent className="space-y-2 p-5">
                <h2 className="text-sm font-semibold text-white">{t.title}</h2>
                <p className="text-sm leading-relaxed text-gray-400">{t.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
