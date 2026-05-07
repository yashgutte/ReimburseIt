import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({ title, value, hint, loading, className }) {
  return (
    <Card
      className={cn(
        "border border-white/10 bg-neutral-950/70 text-gray-100 shadow-none ring-0 backdrop-blur-sm transition-all duration-200",
        "hover:scale-[1.02] hover:border-cyan-500/25 hover:shadow-glow-cyan-soft",
        className
      )}
    >
      <CardHeader className="pb-1 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {title}
        </p>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="h-8 w-24 bg-white/10" />
        ) : (
          <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
        )}
        {hint && (
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
