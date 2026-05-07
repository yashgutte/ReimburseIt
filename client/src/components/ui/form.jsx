import * as React from "react";
import { cn } from "@/lib/utils";

function Form({ className, ...props }) {
  return <form className={cn("space-y-4", className)} {...props} />;
}

export { Form };
