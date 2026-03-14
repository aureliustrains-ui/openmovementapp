import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  textClassName?: string;
  stacked?: boolean;
  showDivider?: boolean;
};

export function BrandLogo({
  className,
  textClassName,
  stacked = false,
  showDivider = false,
}: BrandLogoProps) {
  if (stacked) {
    return (
      <div className={cn("inline-flex flex-col items-start leading-none text-black", className)}>
        <span className={cn("font-display text-[1.05rem] font-semibold tracking-tight", textClassName)}>Open</span>
        {showDivider ? <span className="my-1 h-px w-full bg-black/30" aria-hidden="true" /> : null}
        <span className={cn("font-display text-[1.05rem] font-semibold tracking-tight", textClassName)}>Movement</span>
      </div>
    );
  }

  return (
    <span className={cn("font-display font-semibold tracking-tight text-black", className, textClassName)}>
      Open Movement
    </span>
  );
}
