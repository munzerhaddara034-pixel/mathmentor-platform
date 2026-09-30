import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import type { OverviewStreak } from "@/lib/dashboard/overview";
import { beirutDayKey, formatBeirut } from "@/lib/format/dates";

const DAY_MS = 86_400_000;

/** Last 7 Beirut days; a day is "active" if it falls inside the current streak window. */
function lastSevenDays(streak: OverviewStreak) {
  const now = Date.now();
  const last = streak.lastActivityDate;
  const days = Array.from({ length: 7 }, (_, index) => new Date(now - (6 - index) * DAY_MS));
  const lastIndex = days.findIndex((day) => beirutDayKey(day) === last);
  return days.map((day, index) => ({
    key: beirutDayKey(day),
    label: formatBeirut(day.toISOString(), { weekday: "short" }),
    active: lastIndex >= 0 && index <= lastIndex && index > lastIndex - streak.streakDays,
    today: index === 6,
  }));
}

export function StreakCard({ streak }: { streak: OverviewStreak }) {
  const days = lastSevenDays(streak);
  return (
    <div className="mm-streak">
      <div className="mm-streak-head">
        <strong>
          <Icon name="fire" size={20} /> <Ltr>{streak.streakDays}</Ltr> {streak.streakDays === 1 ? "يوم" : "أيام"} متتالية
        </strong>
        <span className="mm-streak-xp">
          <Ltr>{streak.xp}</Ltr> نقطة
        </span>
      </div>
      <ol className="mm-streak-days">
        {days.map((day) => (
          <li key={day.key} className={`${day.active ? "on" : ""} ${day.today ? "today" : ""}`.trim()}>
            <span aria-hidden="true">{day.active ? <Icon name="check" size={16} /> : null}</span>
            <small>{day.label}</small>
          </li>
        ))}
      </ol>
      {streak.badges.length ? (
        <ul className="mm-badges" aria-label="أوسمتك">
          {streak.badges.map((badge) => (
            <li key={badge.id}>{badge.titleAr}</li>
          ))}
        </ul>
      ) : (
        <p className="mm-streak-hint">ادرس يومياً لتحافظ على سلسلتك وتكسب أوسمة.</p>
      )}
    </div>
  );
}
