"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { ActivityUserFilter } from "@/components/activity/ActivityUserFilter";
import { PAGE_SIZE } from "@/lib/constants";
import type { Activity } from "@/types/activity";

// Cycled by index purely as a visual accent on the timeline dots.
const DOT_COLORS = ["bg-brand-blue", "bg-brand-green-mid", "bg-amber-500"];

export function ActivityFeedPanel({
  activities,
  actors,
}: {
  activities: Activity[];
  actors: string[];
}) {
  const [selectedActor, setSelectedActor] = useState<string | "all">("all");

  const filtered = useMemo(
    () =>
      selectedActor === "all"
        ? activities
        : activities.filter((activity) => activity.actorName === selectedActor),
    [activities, selectedActor],
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Recent activities</h3>
        <ActivityUserFilter actors={actors} selected={selectedActor} onSelect={setSelectedActor} />
      </div>
      <Pagination
        rows={filtered.map((activity, index) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            dotColorClassName={DOT_COLORS[index % DOT_COLORS.length]}
          />
        ))}
        pageSize={PAGE_SIZE}
        emptyMessage="No activity for this user yet."
      />
    </Card>
  );
}
