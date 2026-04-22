import type { CampusEvent } from "../lib/search";

export default function EventCard({ event }: { event: CampusEvent }) {
  const spotsLeft = event.capacity - event.registered;
  const isFull = spotsLeft <= 0;
  const isAlmostFull = spotsLeft > 0 && spotsLeft <= 5;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4 transition-colors hover:border-neutral-500">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-neutral-100">{event.title}</h3>
        <span className="shrink-0 rounded-full bg-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
          {event.category}
        </span>
      </div>

      <p className="mb-3 text-sm text-neutral-400">{event.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>📅 {event.date}</span>
        <span>🕐 {event.time}</span>
        <span>📍 {event.location}</span>
        <span>🏢 {event.org}</span>
        <span
          className={
            isFull
              ? "text-red-400"
              : isAlmostFull
                ? "text-amber-400"
                : "text-emerald-400"
          }
        >
          {isFull
            ? "FULL"
            : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {event.tags.map((tag) => (
          <span
            key={tag}
            className="rounded bg-neutral-700/50 px-1.5 py-0.5 text-[10px] text-neutral-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}