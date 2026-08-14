import { getAllHolidays, getHolidayReps } from "@/data/holidays-service";
import { HolidaysPanel } from "@/components/holidays/HolidaysPanel";

export default async function HolidaysPage() {
  const [holidays, reps] = await Promise.all([getAllHolidays(), getHolidayReps()]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Holidays</h2>
        <p className="mt-1 text-sm text-slate-500">
          Below are holidays which have been requested. Use the All holidays
          toggle to also see previously approved or rejected requests.
        </p>
      </div>
      <HolidaysPanel holidays={holidays} reps={reps} />
    </div>
  );
}
