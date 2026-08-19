import { Star, Trash2 } from "lucide-react";

export interface FavouriteView {
  id: string;
  name: string;
  stages: string[];
  reps: string[];
}

export function FavouritesPanel({
  favourites,
  onApply,
  onDelete,
}: {
  favourites: FavouriteView[];
  onApply: (favourite: FavouriteView) => void;
  onDelete: (favourite: FavouriteView) => void;
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
            <div
              key={favourite.id}
              className="group flex items-center gap-1 rounded-md pr-1 hover:bg-slate-100"
            >
              <button
                type="button"
                onClick={() => onApply(favourite)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600"
              >
                <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="truncate">{favourite.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(favourite)}
                aria-label={`Delete ${favourite.name}`}
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-red-600 group-hover:flex"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
