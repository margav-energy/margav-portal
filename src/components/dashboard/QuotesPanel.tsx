import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { QuoteListRow } from "@/components/dashboard/QuoteListRow";
import { PAGE_SIZE } from "@/lib/constants";
import type { Quote } from "@/types/quote";

export function QuotesPanel({
  title,
  viewAllHref,
  quotes,
  variant,
}: {
  title: string;
  viewAllHref: string;
  quotes: Quote[];
  variant: "sent" | "signed";
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Badge>{quotes.length}</Badge>
        <Button href={viewAllHref} className="ml-auto px-3 py-1.5 text-xs">
          View all
        </Button>
      </div>
      <Pagination
        rows={quotes.map((quote) => (
          <QuoteListRow key={quote.id} quote={quote} variant={variant} />
        ))}
        pageSize={PAGE_SIZE}
        emptyMessage={`No ${title.toLowerCase()} yet.`}
      />
    </Card>
  );
}
