import { Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Stand-in for the property/site photo shown alongside Customer details.
 * No real imagery is wired up yet — this just reserves the spot so the
 * layout matches the reference design.
 */
export function PropertyImagePlaceholder() {
  return (
    <Card className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-slate-50 p-5 text-slate-300">
      <ImageIcon className="h-8 w-8" />
      <p className="text-xs font-medium text-slate-400">No site photo available</p>
    </Card>
  );
}
