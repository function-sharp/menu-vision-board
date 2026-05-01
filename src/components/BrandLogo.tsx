import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { box: string; img: string; title: string; subtitle: string }> = {
  sm: { box: "h-8 w-8", img: "h-6 w-6", title: "text-sm", subtitle: "text-[10px]" },
  md: { box: "h-10 w-10", img: "h-7 w-7", title: "text-base", subtitle: "text-xs" },
  lg: { box: "h-14 w-14", img: "h-10 w-10", title: "text-xl", subtitle: "text-sm" },
};

interface BrandLogoProps {
  size?: Size;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  /** Use light foreground colors (for dark sidebar) */
  onDark?: boolean;
}

export function BrandLogo({
  size = "sm",
  showWordmark = true,
  subtitle = "Menu Dashboard",
  className,
  onDark = false,
}: BrandLogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <div
        className={cn(
          "shrink-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground overflow-hidden",
          s.box
        )}
      >
        <img
          src="/favicon.png"
          alt="Col'Cacchio"
          className={cn("object-contain", s.img)}
          loading="eager"
          decoding="async"
        />
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-tight min-w-0">
          <span
            className={cn(
              "font-semibold tracking-tight truncate",
              s.title,
              onDark ? "text-sidebar-foreground" : "text-foreground"
            )}
          >
            Col'Cacchio
          </span>
          {subtitle && (
            <span
              className={cn(
                "truncate",
                s.subtitle,
                onDark ? "text-sidebar-foreground/60" : "text-muted-foreground"
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
