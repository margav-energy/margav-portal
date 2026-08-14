import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="max-w-sm text-sm text-slate-500">
        This part of the portal is on its way. Check back soon.
      </p>
    </Card>
  );
}
