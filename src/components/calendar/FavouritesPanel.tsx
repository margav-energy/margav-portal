import { Star } from "lucide-react";

export interface FavouriteView {
  id: string;
  name: string;
  stages: string[];
  reps: string[];
}

export function FavouritesPanel({
  favourites,
  onApply,
}: {
  favourites: FavouriteView[];
  onApply: (favourite: FavouriteView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Favourites
      </h3>
      {favourites.length === 0 ? (
        <p className="text-sm text-slate-400">
          Save a filter combination with the + Favourite button above.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {favourites.map((favourite) => (
            <button
              key={favourite.id}
              type="button"
              onClick={() => onApply(favourite)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate">{favourite.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
