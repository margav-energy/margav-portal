import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import type { QuickLink } from "@/lib/quick-links-config";

export function QuickLinksCard({ items }: { items: QuickLink[] }) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Quick Links
      </p>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-lg p-2 text-center hover:bg-slate-50"
          >
            <IconTile icon={item.icon} />
            <span className="text-xs font-medium text-slate-600">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}
