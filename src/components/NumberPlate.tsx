import React from "react";
import { cn } from "@/lib/utils";
import { plateColors } from "@/lib/insights";

const SIZES = {
  xs: "h-6 min-w-[2.25rem] text-[0.8rem] px-1.5",
  sm: "h-8 min-w-[2.75rem] text-base px-2",
  md: "h-11 min-w-[3.75rem] text-2xl px-2.5",
  lg: "h-16 min-w-[5.5rem] text-[2.4rem] px-3",
  xl: "h-24 min-w-[8rem] text-6xl px-4",
};

interface NumberPlateProps {
  number?: number | string | null;
  team?: { color?: string; text_color?: string } | null;
  constructor?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  style?: React.CSSProperties;
}

/** A rider's race number on a plate painted in the team livery. */
const NumberPlate: React.FC<NumberPlateProps> = ({ number, team, constructor, size = "sm", className, style }) => {
  const { bg, fg } = plateColors(team, constructor);
  return (
    <span
      role="img"
      aria-label={number != null ? `Numéro ${number}` : "Numéro inconnu"}
      className={cn(
        "font-plate inline-flex shrink-0 items-center justify-center rounded-[0.35em] leading-none",
        "shadow-[inset_0_-0.12em_0_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.25)]",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: bg, color: fg, ...style }}
    >
      {number ?? "—"}
    </span>
  );
};

export default NumberPlate;
