import { Box } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "sm" ? "text-base" : "text-lg";
  const icon = size === "sm" ? 16 : 20;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${dims} items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-950/40`}
      >
        <Box size={icon} strokeWidth={2.25} className="text-neutral-950" />
      </div>
      <span className={`${text} font-semibold tracking-tight text-neutral-100`}>
        AI Architect
      </span>
    </div>
  );
}
