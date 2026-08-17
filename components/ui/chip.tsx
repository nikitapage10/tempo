import { cn } from "@/lib/utils";

type ChipProps = {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  as?: "button" | "span";
  /** Dense chips for filter toolbars. */
  size?: "md" | "sm";
  disabled?: boolean;
  style?: React.CSSProperties;
};

export function Chip({
  children,
  active,
  onClick,
  className,
  as = onClick ? "button" : "span",
  size = "md",
  disabled = false,
  style,
}: ChipProps) {
  const Comp = as;
  return (
    <Comp
      type={as === "button" ? "button" : undefined}
      disabled={as === "button" ? disabled : undefined}
      onClick={disabled ? undefined : onClick}
      style={style}
      className={cn(
        "inline-flex items-center rounded-chip border transition-colors duration-hover",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        active
          ? "border-ice/40 bg-ice/15 text-ice"
          : "border-line bg-bg-2 text-text-lo hover:text-text-hi",
        disabled && "pointer-events-none opacity-40",
        className
      )}
    >
      {children}
    </Comp>
  );
}
