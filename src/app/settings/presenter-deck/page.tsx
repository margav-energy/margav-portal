import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getActivePresenterDeck } from "@/data/presenter-deck-service";
import { Card } from "@/components/ui/Card";
import { PresenterDeckManager } from "@/components/settings/PresenterDeckManager";

export default async function PresenterDeckSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/settings");

  const activeDeck = await getActivePresenterDeck();
  const imageSlides = activeDeck?.slides.filter((slide) => slide.slideType === "image") ?? [];
  const firstLiveSlide = activeDeck?.slides.find((slide) => slide.slideType !== "image");
  const liveSlidesAfterPosition = firstLiveSlide ? firstLiveSlide.position - 1 : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Presenter Deck</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload the sales deck reps present to customers from a quote&rsquo;s Presenter button. Admin only.
        </p>
      </div>

      <Card className="p-5">
        <PresenterDeckManager
          deck={
            activeDeck
              ? {
                  id: activeDeck.id,
                  originalFilename: activeDeck.originalFilename,
                  uploadedAt: activeDeck.uploadedAt,
                  imageSlideCount: imageSlides.length,
                  liveSlidesAfterPosition,
                }
              : null
          }
        />
      </Card>
    </div>
  );
}
