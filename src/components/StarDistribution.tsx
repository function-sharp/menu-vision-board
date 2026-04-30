import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn("shrink-0", n <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40")}
        />
      ))}
    </div>
  );
}

export function StarDistribution({ distribution }: { distribution: number[] }) {
  const total = distribution.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star - 1] ?? 0;
        const pct = (count / total) * 100;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right tabular-nums text-muted-foreground">{star}</span>
            <Star className="h-3 w-3 fill-primary text-primary shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-12 text-right tabular-nums text-muted-foreground">{count.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
