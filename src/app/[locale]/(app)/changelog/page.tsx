import { ChangelogReleaseList } from "@/components/changelog-list";
import { createClient } from "@/utils/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { ChangelogEntry } from "@/lib/changelog";

export default async function ChangelogPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations("ChangelogPage");
  const { data } = await supabase
    .from("changelog")
    .select("id, version, title, description, badge, published_at")
    .order("published_at", { ascending: false })
    .limit(100);

  const entries = (data || []) as ChangelogEntry[];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="px-1 py-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>
      </section>

      <ChangelogReleaseList
        entries={entries}
        locale={locale}
        compact
        labels={{
          latest: t("latestLabel"),
          empty: t("emptyState"),
          sections: {
            new: t("sectionNew"),
            improvement: t("sectionImprovement"),
            fix: t("sectionFix"),
            update: t("sectionUpdate"),
          },
        }}
      />
    </div>
  );
}
