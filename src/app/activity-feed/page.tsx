import { getAllActivities, getActivityActors } from "@/data/activities-service";
import { requireStaffUser } from "@/data/current-user";
import { ActivityFeedPanel } from "@/components/activity/ActivityFeedPanel";

export default async function ActivityFeedPage() {
  await requireStaffUser();

  const [activities, actors] = await Promise.all([
    getAllActivities(),
    getActivityActors(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Activity Feed</h2>
      <ActivityFeedPanel activities={activities} actors={actors} />
    </div>
  );
}
