"use client";

import { useMemo, useState } from "react";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { CalendarSidebarFilters } from "@/components/calendar/CalendarSidebarFilters";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import type { FavouriteView } from "@/components/calendar/FavouritesPanel";
import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import {
  addDays,
  formatDayLabel,
  formatMonthLabel,
  formatWeekRangeLabel,
  startOfWeek,
} from "@/lib/date-utils";
import type {
  AppointmentStage,
  CalendarAppointment,
  CalendarViewMode,
} from "@/types/calendar-appointment";

const STAGE_OPTIONS = (Object.keys(APPOINTMENT_STAGE_STYLES) as AppointmentStage[]).map(
  (stage) => ({ value: stage, label: APPOINTMENT_STAGE_STYLES[stage].label }),
);

export function CalendarView({
  appointments,
  reps,
}: {
  appointments: CalendarAppointment[];
  reps: string[];
}) {
  const repOptions = useMemo(
    () => [
      { value: "Unallocated", label: "Unallocated" },
      ...reps.map((rep) => ({ value: rep, label: rep })),
    ],
    [reps],
  );

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedStages, setSelectedStages] = useState<string[]>(
    STAGE_OPTIONS.map((option) => option.value),
  );
  const [selectedReps, setSelectedReps] = useState<string[]>(
    repOptions.map((option) => option.value),
  );
  const [search, setSearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [favourites, setFavourites] = useState<FavouriteView[]>([]);

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return appointments.filter((appointment) => {
      if (!selectedStages.includes(appointment.stage)) return false;
      if (!selectedReps.includes(appointment.repName)) return false;
      if (query && !appointment.customerName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [appointments, selectedStages, selectedReps, search]);

  const weekStart = startOfWeek(anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const rangeLabel =
    viewMode === "month"
      ? formatMonthLabel(anchorDate)
      : viewMode === "day"
        ? formatDayLabel(anchorDate)
        : formatWeekRangeLabel(weekDays[0], weekDays[6]);

  function shift(amount: number) {
    if (viewMode === "month") {
      setAnchorDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    } else if (viewMode === "day") {
      setAnchorDate((current) => addDays(current, amount));
    } else {
      setAnchorDate((current) => addDays(current, amount * 7));
    }
  }

  function handleSaveFavourite(name: string) {
    setFavourites((current) => [
      ...current,
      { id: `fav-${current.length}-${name}`, name, stages: selectedStages, reps: selectedReps },
    ]);
  }

  function handleApplyFavourite(favourite: FavouriteView) {
    setSelectedStages(favourite.stages);
    setSelectedReps(favourite.reps);
  }

  function handleSelectMonthDay(day: Date) {
    setAnchorDate(day);
    setViewMode("day");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <CalendarToolbar
        rangeLabel={rangeLabel}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setAnchorDate(new Date())}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={setSearch}
        onToggleFilters={() => setIsFiltersOpen((open) => !open)}
        onSaveFavourite={handleSaveFavourite}
      />
      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebarFilters
          isOpen={isFiltersOpen}
          stageOptions={STAGE_OPTIONS}
          selectedStages={selectedStages}
          onStagesChange={setSelectedStages}
          repOptions={repOptions}
          selectedReps={selectedReps}
          onRepsChange={setSelectedReps}
          favourites={favourites}
          onApplyFavourite={handleApplyFavourite}
        />
        <div className="flex-1 overflow-auto p-4">
          {viewMode === "month" ? (
            <MonthGrid
              monthDate={anchorDate}
              appointments={filteredAppointments}
              onSelectDay={handleSelectMonthDay}
            />
          ) : viewMode === "day" ? (
            <WeekGrid days={[anchorDate]} appointments={filteredAppointments} />
          ) : (
            <WeekGrid days={weekDays} appointments={filteredAppointments} />
          )}
        </div>
      </div>
    </div>
  );
}
