import { ALargeSmall } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  type AppearanceControlProps,
} from "@/react-app/lib/appearance";

export function FontSizeSlider({ appearance, onChange }: AppearanceControlProps) {
  const size = appearance.fontSize;

  return (
    <div className="space-y-2 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <div className="flex items-center gap-2">
        <ALargeSmall className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Font size</span>
        <output className="w-11 text-right tabular-nums">{size}%</output>
      </div>
      <Slider
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        step={5}
        value={[size]}
        onValueChange={(values) => {
          const nextSize = values[0];
          if (typeof nextSize !== "number") {
            return;
          }
          onChange({ fontSize: nextSize });
        }}
        aria-label="Font size"
      />
    </div>
  );
}
