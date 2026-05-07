import * as React from "react";
import { cn } from "@/lib/utils";

function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-sm text-white outline-none transition-all duration-200 focus-visible:border-cyan-500/50 focus-visible:ring-3 focus-visible:ring-cyan-400/35",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
