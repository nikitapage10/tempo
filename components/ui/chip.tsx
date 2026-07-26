import { cn } from "@/lib/utils";

type ChipProps = {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  as?: "button" | "span";
};

export function Chip({
  children,
  active,
  onClick,
  className,
  as = onClick ? "button" : "span",
}: ChipProps) {
  const Comp = as;
  return (
    <Comp
      type={as === "button" ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-chip border px-2.5 py-1 text-xs transition-colors duration-hover",
        active
          ? "border-ice/40 bg-ice/15 text-ice"
          : "border-line bg-bg-2 text-text-lo hover:text-text-hi",
        className
      )}
    >
      {children}
    </Comp>
  );
}
