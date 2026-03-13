import type { ElementType } from "react";
import {
  CalendarDays,
  Megaphone,
  Rocket,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type ChangelogBadge,
  type ChangelogEntry,
  type ChangelogRelease,
  groupChangelogEntries,
} from "@/lib/changelog";

const SECTION_META: Record<
  ChangelogBadge,
  {
    label: { id: string; en: string };
    icon: ElementType;
    tone: string;
  }
> = {
  new: {
    label: { id: "Fitur", en: "Features" },
    icon: Sparkles,
    tone: "text-amber-500",
  },
  improvement: {
    label: { id: "Peningkatan", en: "Improvements" },
    icon: Rocket,
    tone: "text-emerald-500",
  },
  fix: {
    label: { id: "Perbaikan", en: "Fixes" },
    icon: Wrench,
    tone: "text-blue-500",
  },
  update: {
    label: { id: "Update", en: "Updates" },
    icon: Megaphone,
    tone: "text-slate-500",
  },
};

function formatReleaseDate(date: string, locale: string) {
  const formatterLocale = locale === "en" ? "en-US" : "id-ID";

  return new Date(date).toLocaleDateString(formatterLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEntryText(entry: ChangelogEntry) {
  return entry.description
    ? `${entry.title}: ${entry.description}`
    : entry.title;
}

export function ChangelogReleaseCard({
  release,
  locale,
  isLatest = false,
  compact = false,
  className,
}: {
  release: ChangelogRelease;
  locale: string;
  isLatest?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const latestLabel = locale === "en" ? "Latest" : "Latest";

  return (
    <section
      className={cn(
        compact
          ? "rounded-[1.5rem] border border-border/80 bg-card px-4 py-5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.35)] sm:px-5 sm:py-5"
          : "rounded-[2rem] border border-border/80 bg-card px-5 py-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] sm:px-8 sm:py-8",
        className,
      )}
    >
      <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <h2
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl",
            )}
          >
            v{release.version}
          </h2>
          {isLatest && (
            <Badge
              className={cn(
                "rounded-full border-0 bg-[#08c948] font-semibold text-white hover:bg-[#08c948]",
                compact ? "px-2.5 py-0.5 text-[11px]" : "px-4 py-2 text-sm",
              )}
            >
              {latestLabel}
            </Badge>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-2 text-muted-foreground",
            compact ? "text-xs" : "text-base",
          )}
        >
          <CalendarDays className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
          <span>{formatReleaseDate(release.publishedAt, locale)}</span>
        </div>
      </div>

      <div className={cn(compact ? "mt-6 space-y-6" : "mt-8 space-y-8")}>
        {release.sections.map((section) => {
          const sectionMeta = SECTION_META[section.badge];
          const SectionIcon = sectionMeta.icon;
          const sectionLabel =
            locale === "en" ? sectionMeta.label.en : sectionMeta.label.id;

          return (
            <section
              key={`${release.version}-${section.badge}`}
              className={cn(compact ? "space-y-3" : "space-y-4")}
            >
              <div className="flex items-center gap-3">
                <SectionIcon
                  className={cn(compact ? "h-4 w-4" : "h-5 w-5", sectionMeta.tone)}
                />
                <h3
                  className={cn(
                    "font-semibold uppercase tracking-[0.2em] text-muted-foreground",
                    compact ? "text-[11px]" : "text-sm",
                  )}
                >
                  {sectionLabel}
                </h3>
              </div>

              <ul className={cn(compact ? "space-y-2.5 pl-6" : "space-y-3 pl-7")}>
                {section.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={cn(
                      "relative leading-relaxed text-foreground before:absolute before:rounded-full before:bg-muted-foreground/35",
                      compact
                        ? "text-sm before:left-[-1.1rem] before:top-[0.55rem] before:h-1.5 before:w-1.5"
                        : "text-lg before:left-[-1.5rem] before:top-[0.75rem] before:h-2.5 before:w-2.5",
                    )}
                  >
                    {formatEntryText(entry)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function ChangelogReleaseList({
  entries,
  locale,
  compact = false,
  className,
}: {
  entries: ChangelogEntry[];
  locale: string;
  compact?: boolean;
  className?: string;
}) {
  const releases = groupChangelogEntries(entries);

  if (!releases.length) {
    return (
      <div
        className={cn(
          "rounded-[2rem] border border-dashed border-border bg-card/70 px-6 py-12 text-center text-muted-foreground",
          className,
        )}
      >
        {locale === "en"
          ? "There are no changelog notes yet."
          : "Belum ada catatan perubahan."}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {releases.map((release, index) => (
        <ChangelogReleaseCard
          key={`${release.version}-${release.publishedAt}`}
          release={release}
          locale={locale}
          isLatest={index === 0}
          compact={compact}
        />
      ))}
    </div>
  );
}
