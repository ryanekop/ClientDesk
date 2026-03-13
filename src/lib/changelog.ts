export type ChangelogEntry = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  badge: string | null;
  published_at: string;
};

export type ChangelogBadge = "new" | "improvement" | "fix" | "update";

export type ChangelogSection = {
  badge: ChangelogBadge;
  entries: ChangelogEntry[];
};

export type ChangelogRelease = {
  version: string;
  publishedAt: string;
  entries: ChangelogEntry[];
  sections: ChangelogSection[];
};

export const CHANGELOG_DISMISS_STORAGE_KEY =
  "clientdesk:changelog:dismissed-version";
export const CHANGELOG_PREFERENCE_EVENT =
  "clientdesk:changelog-preference-changed";

const SECTION_ORDER: ChangelogBadge[] = ["new", "improvement", "fix", "update"];

export function normalizeChangelogBadge(
  badge: string | null | undefined,
): ChangelogBadge {
  if (
    badge === "new" ||
    badge === "improvement" ||
    badge === "fix" ||
    badge === "update"
  ) {
    return badge;
  }

  return "update";
}

export function groupChangelogEntries(
  entries: ChangelogEntry[],
): ChangelogRelease[] {
  const releases = new Map<string, ChangelogEntry[]>();

  entries.forEach((entry) => {
    const versionEntries = releases.get(entry.version) || [];
    versionEntries.push(entry);
    releases.set(entry.version, versionEntries);
  });

  return Array.from(releases.entries())
    .map(([version, versionEntries]) => {
      const sortedEntries = [...versionEntries].sort(
        (a, b) =>
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
      );

      const sections = SECTION_ORDER.flatMap((badge) => {
        const badgeEntries = sortedEntries.filter(
          (entry) => normalizeChangelogBadge(entry.badge) === badge,
        );

        if (!badgeEntries.length) {
          return [];
        }

        return [{ badge, entries: badgeEntries }];
      });

      return {
        version,
        publishedAt: sortedEntries[0]?.published_at || "",
        entries: sortedEntries,
        sections,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}

export function isChangelogDismissed(latestVersion: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const savedVersion = window.localStorage.getItem(
    CHANGELOG_DISMISS_STORAGE_KEY,
  );

  return savedVersion === latestVersion;
}

export function saveChangelogPreference(
  latestVersion: string,
  persistInBrowser: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (persistInBrowser) {
    window.localStorage.setItem(CHANGELOG_DISMISS_STORAGE_KEY, latestVersion);
    window.dispatchEvent(new CustomEvent(CHANGELOG_PREFERENCE_EVENT));
  }
}
