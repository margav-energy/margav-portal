"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { CalendarSidebarFilters } from "@/components/calendar/CalendarSidebarFilters";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { AppointmentOverviewModal } from "@/components/calendar/AppointmentOverviewModal";
import type { FavouriteView } from "@/components/calendar/FavouritesPanel";
import { deleteFavouriteViewAction, saveFavouriteViewAction } from "@/components/calendar/actions";
import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import { repColorFor } from "@/lib/rep-colors";
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

export interface CalendarRep {
  fullName: string;
  /** Manually picked on Settings → Team Members, if any — see `repColorFor`. */
  calendarColor?: string;
}

export function CalendarView({
  appointments,
  reps,
  initialFavourites = [],
  isAdmin,
}: {
  appointments: CalendarAppointment[];
  reps: CalendarRep[];
  initialFavourites?: FavouriteView[];
  isAdmin: boolean;
}) {
  const repOptions = useMemo(
    () => [
      { value: "Unallocated", label: "Unallocated" },
      ...reps.map((rep) => ({
        value: rep.fullName,
        label: rep.fullName,
        dotColor: repColorFor(rep.fullName, rep.calendarColor)?.hex,
      })),
    ],
    [reps],
  );

  // Keyed by name (same key `CalendarAppointment.repName` uses) so blocks can look up a rep's
  // manually-picked colour, if any, without needing a repId on every appointment.
  const repColorsByName = useMemo(
    () => Object.fromEntries(reps.map((rep) => [rep.fullName, rep.calendarColor])),
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
  const [favourites, setFavourites] = useState<FavouriteView[]>(initialFavourites);
  const [, startFavouriteTransition] = useTransition();
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);

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
    startFavouriteTransition(async () => {
      const saved = await saveFavouriteViewAction(name, selectedStages, selectedReps);
      if (saved) {
        setFavourites((current) => [
          ...current,
          { id: saved.id, name: saved.name, stages: saved.filters.stages, reps: saved.filters.reps },
        ]);
      }
    });
  }

  function handleApplyFavourite(favourite: FavouriteView) {
    setSelectedStages(favourite.stages);
    setSelectedReps(favourite.reps);
  }

  function handleDeleteFavourite(favourite: FavouriteView) {
    setFavourites((current) => current.filter((item) => item.id !== favourite.id));
    startFavouriteTransition(async () => {
      await deleteFavouriteViewAction(favourite.id);
    });
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
          onDeleteFavourite={handleDeleteFavourite}
        />
        <div className="flex-1 overflow-auto p-4">
          {viewMode === "month" ? (
            <MonthGrid
              monthDate={anchorDate}
              appointments={filteredAppointments}
              onSelectDay={handleSelectMonthDay}
              onSelectAppointment={setSelectedAppointment}
              repColorsByName={repColorsByName}
            />
          ) : viewMode === "day" ? (
            <WeekGrid
              days={[anchorDate]}
              appointments={filteredAppointments}
              onSelectAppointment={setSelectedAppointment}
              repColorsByName={repColorsByName}
            />
          ) : (
            <WeekGrid
              days={weekDays}
              appointments={filteredAppointments}
              onSelectAppointment={setSelectedAppointment}
              repColorsByName={repColorsByName}
            />
          )}
        </div>
      </div>

      {selectedAppointment && (
        <AppointmentOverviewModal
          key={selectedAppointment.id}
          appointment={selectedAppointment}
          isAdmin={isAdmin}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}
