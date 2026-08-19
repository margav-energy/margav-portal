import { CalendarFilterGroup, type FilterOption } from "@/components/calendar/CalendarFilterGroup";
import { FavouritesPanel, type FavouriteView } from "@/components/calendar/FavouritesPanel";
import { cn } from "@/lib/utils";

export function CalendarSidebarFilters({
  isOpen,
  stageOptions,
  selectedStages,
  onStagesChange,
  repOptions,
  selectedReps,
  onRepsChange,
  favourites,
  onApplyFavourite,
  onDeleteFavourite,
}: {
  isOpen: boolean;
  stageOptions: FilterOption[];
  selectedStages: string[];
  onStagesChange: (value: string[]) => void;
  repOptions: FilterOption[];
  selectedReps: string[];
  onRepsChange: (value: string[]) => void;
  favourites: FavouriteView[];
  onApplyFavourite: (favourite: FavouriteView) => void;
  onDeleteFavourite: (favourite: FavouriteView) => void;
}) {
  return (
    <aside
      className={cn(
        "w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5",
        isOpen ? "block" : "hidden lg:block",
      )}
    >
      <div className="flex flex-col gap-6">
        <CalendarFilterGroup
          title="Stage"
          options={stageOptions}
          selected={selectedStages}
          onChange={onStagesChange}
        />
        <CalendarFilterGroup
          title="Representative"
          options={repOptions}
          selected={selectedReps}
          onChange={onRepsChange}
        />
        <FavouritesPanel favourites={favourites} onApply={onApplyFavourite} onDelete={onDeleteFavourite} />
      </div>
    </aside>
  );
}
