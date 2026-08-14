import { QUICK_LINKS } from "@/lib/quick-links-config";
import { QuickLinkTile } from "@/components/quick-links/QuickLinkTile";

export default function QuickLinksPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Quick Links</h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <QuickLinkTile key={link.label} {...link} />
        ))}
      </div>
    </div>
  );
}
