"use client";

import { useSearchParams } from "next/navigation";
import { CreateAppointmentForm } from "@/components/appointments/CreateAppointmentForm";

/**
 * Reads ?firstName=&lastName=&rebookFrom= (e.g. from the Recently Cancelled
 * page's Rebook button) to prefill the form and, when rebooking, link the
 * new appointment back to the cancelled one via `rebooked_from_id`. Split
 * into its own component so the useSearchParams() call can be isolated
 * behind a Suspense boundary without forcing the rest of the page to bail
 * out of static rendering.
 */
export function CreateAppointmentFormLoader() {
  const searchParams = useSearchParams();

  return (
    <CreateAppointmentForm
      initialFirstName={searchParams.get("firstName") ?? undefined}
      initialLastName={searchParams.get("lastName") ?? undefined}
      rebookFrom={searchParams.get("rebookFrom") ?? undefined}
    />
  );
}
