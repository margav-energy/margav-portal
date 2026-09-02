"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MapPin, Phone, StickyNote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { DeleteQuoteModal } from "@/components/quotes/detail/DeleteQuoteModal";
import { DeleteAppointmentModal } from "@/components/appointments/DeleteAppointmentModal";
import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import { formatDate } from "@/lib/format";
import { getAppointmentOverviewAction, type AppointmentOverview } from "@/components/appointments/actions";
import type { CalendarAppointment } from "@/types/calendar-appointment";

/**
 * Click-to-view popup for a calendar block — a quick overview (contact
 * details, address, notes) plus a link through to the full quote, the way
 * clicking an event on Google Calendar opens a summary rather than nothing.
 * Starts from what the calendar already has in memory (`appointment`) so
 * the header renders instantly, then fills in the rest from the server.
 */
export function AppointmentOverviewModal({
  appointment,
  isAdmin,
  onClose,
}: {
  appointment: CalendarAppointment;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<AppointmentOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteQuoteOpen, setIsDeleteQuoteOpen] = useState(false);
  const [isDeleteAppointmentOpen, setIsDeleteAppointmentOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Fresh mount per selected appointment (the parent renders this modal
    // conditionally), so `isLoading`'s initial `true` already covers this —
    // no need to reset it here too.
    getAppointmentOverviewAction(appointment.id).then((result) => {
      if (!cancelled) {
        setOverview(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appointment.id]);

  // Prefer the freshly-fetched stage once it's in — `appointment.stage` is whatever the calendar's
  // list happened to show when the page last loaded, which can go stale (see `overview.repName`).
  const style = APPOINTMENT_STAGE_STYLES[overview ? overview.stage : appointment.stage];

  return (
    <Modal title={appointment.customerName} onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill label={style.label} className={style.blockClassName} />
          <span className="text-sm text-slate-600">
            {formatDate(appointment.date)} · {appointment.startTime}–{appointment.endTime}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          {/* `overview.repName` is a fresh, live lookup done on open — `appointment.repName` is
              whatever the calendar's list happened to show when the page was last loaded, which
              can be stale if a rep was (re)assigned since. Prefer the live value once it's in. */}
          Rep: <span className="font-medium text-slate-900">{overview ? overview.repName : appointment.repName}</span>
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading details…
          </div>
        ) : overview ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
            {overview.phone && (
              <a
                href={`tel:${overview.phone}`}
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-blue"
              >
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                {overview.phone}
              </a>
            )}
            {overview.email && (
              <a
                href={`mailto:${overview.email}`}
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-blue"
              >
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                {overview.email}
              </a>
            )}
            {overview.address && (
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  {overview.address}
                  {overview.postcode ? `, ${overview.postcode}` : ""}
                </span>
              </div>
            )}
            {overview.notes && (
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="whitespace-pre-line">{overview.notes}</span>
              </div>
            )}
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{overview.product}</p>
          </div>
        ) : (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-400">
            Couldn&rsquo;t load the full details for this appointment.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
        {isAdmin ? (
          <div className="flex gap-2">
            {overview?.quoteId && (
              <Button variant="danger" onClick={() => setIsDeleteQuoteOpen(true)}>
                Delete quote
              </Button>
            )}
            <Button variant="danger" onClick={() => setIsDeleteAppointmentOpen(true)}>
              Delete appointment
            </Button>
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {overview?.quoteId && (
            <Button variant="success" href={`/quotes/${overview.quoteId}`}>
              View full quote
            </Button>
          )}
        </div>
      </div>

      {isDeleteQuoteOpen && overview?.quoteId && (
        <DeleteQuoteModal
          quoteId={overview.quoteId}
          customerName={overview.customerName}
          reference={overview.quoteReference ?? "this quote"}
          onClose={() => setIsDeleteQuoteOpen(false)}
          onDeleted={() => {
            setIsDeleteQuoteOpen(false);
            onClose();
          }}
        />
      )}

      {isDeleteAppointmentOpen && (
        <DeleteAppointmentModal
          appointmentId={appointment.id}
          customerName={appointment.customerName}
          dateTimeLabel={`${formatDate(appointment.date)} · ${appointment.startTime}–${appointment.endTime}`}
          onClose={() => setIsDeleteAppointmentOpen(false)}
          onDeleted={() => {
            setIsDeleteAppointmentOpen(false);
            onClose();
            // The calendar's appointment list was fetched once at page load — without this,
            // the just-deleted block would keep showing until a manual reload.
            router.refresh();
          }}
        />
      )}
    </Modal>
  );
}
