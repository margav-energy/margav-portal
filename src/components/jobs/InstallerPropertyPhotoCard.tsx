import { Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Read-only counterpart of `PropertyPhotoCard` — no upload/replace/remove
 *  controls, just the photo (or a placeholder) so an installer can see
 *  what the property looks like before they arrive. */
export function InstallerPropertyPhotoCard({
  customerName,
  photoUrl,
}: {
  customerName: string;
  photoUrl: string | undefined;
}) {
  if (photoUrl) {
    return (
      <Card className="min-h-[220px] overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed Storage URL, not a static/local asset next/image can optimize. */}
        <img src={photoUrl} alt={`${customerName}'s property`} className="h-full w-full object-cover" />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-slate-50 p-5 text-slate-300">
      <ImageIcon className="h-8 w-8" />
      <p className="text-xs font-medium text-slate-400">No site photo available</p>
    </Card>
  );
}
