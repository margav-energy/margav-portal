import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { CreateAppointmentFormLoader } from "@/components/appointments/CreateAppointmentFormLoader";

// Admin-only — reps work appointments an admin has already booked, they
// don't create new ones (same "admin creates, rep works" split as quotes —
// see `createQuote`'s role check in src/components/quotes/actions.ts).
export default async function CreateAppointmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">
        Create a Calendar Appointment
      </h2>
      <Suspense fallback={null}>
        <CreateAppointmentFormLoader />
      </Suspense>
    </div>
  );
}
