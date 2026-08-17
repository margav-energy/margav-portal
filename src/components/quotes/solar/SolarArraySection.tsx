import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { SolarArray } from "@/types/solar-quote";

function specLine(array: SolarArray): string {
  const shade = Number(array.shadeFactor.toFixed(2)).toString();
  return `${shade} Shade · ${array.orientation} · ${array.pitchDegrees}° Pitch`;
}

export function SolarArraySection({ arrays }: { arrays: SolarArray[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Solar Array ({arrays.length})
      </p>

      {arrays.map((array) => (
        <Card key={array.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{array.label}</p>
              <p className="text-sm text-slate-500">{specLine(array)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs">
                Edit
              </Button>
              <Button variant="danger" className="px-3 py-1.5 text-xs">
                Remove
              </Button>
            </div>
          </div>
          {array.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700"
            >
              <span>
                {item.name} <span className="text-slate-400">&times; {item.quantity}</span>
              </span>
              <span className="font-medium text-slate-900">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
        </Card>
      ))}

      <Button variant="secondary" className="w-fit self-center">
        Add solar array
      </Button>
    </div>
  );
}
