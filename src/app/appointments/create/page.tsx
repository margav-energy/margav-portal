import { Suspense } from "react";
import { requireStaffUser } from "@/data/current-user";
import { CreateAppointmentFormLoader } from "@/components/appointments/CreateAppointmentFormLoader";

export default async function CreateAppointmentPage() {
  await requireStaffUser();

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
