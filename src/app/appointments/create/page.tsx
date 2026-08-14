import { CreateAppointmentForm } from "@/components/appointments/CreateAppointmentForm";

export default function CreateAppointmentPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">
        Create a Calendar Appointment
      </h2>
      <CreateAppointmentForm />
    </div>
  );
}
