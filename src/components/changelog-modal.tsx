"use client";

import * as React from "react";
import { X, Sparkles, Wrench, Bug, Zap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type ChangelogEntry = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  badge: string;
  published_at: string;
};

const BADGE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  new: {
    label: "Baru",
    icon: Sparkles,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  improvement: {
    label: "Peningkatan",
    icon: Zap,
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  },
  fix: {
    label: "Perbaikan",
    icon: Bug,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  update: {
    label: "Update",
    icon: Wrench,
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  },
};

export function ChangelogModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = React.useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();

  React.useEffect(() => {
    if (!open) return;
    fetchChangelog();
    markAsSeen();
  }, [open]);

  async function fetchChangelog() {
    setLoading(true);
    const { data } = await supabase
      .from("changelog")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50);
    setEntries((data || []) as ChangelogEntry[]);
    setLoading(false);
  }

  async function markAsSeen() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("changelog_reads").upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  // Group entries by version
  const grouped = React.useMemo(() => {
    const map = new Map<string, ChangelogEntry[]>();
    entries.forEach((e) => {
      const key = e.version;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries());
  }, [entries]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl border w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">Log Perubahan</h2>
            <p className="text-xs text-muted-foreground">
              Fitur baru & perbaikan
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Belum ada catatan perubahan.
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([version, items]) => (
                <div key={version}>
                  {/* Version header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-foreground text-background">
                      v{version}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(items[0].published_at).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>

                  {/* Entries */}
                  <div className="space-y-2 pl-1">
                    {items.map((entry) => {
                      const badgeConf =
                        BADGE_CONFIG[entry.badge] || BADGE_CONFIG.update;
                      const Icon = badgeConf.icon;
                      return (
                        <div
                          key={entry.id}
                          className="flex gap-3 rounded-lg p-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="pt-0.5 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeConf.className}`}
                            >
                              <Icon className="w-3 h-3" />
                              {badgeConf.label}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold">
                              {entry.title}
                            </h4>
                            {entry.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {entry.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-center shrink-0">
          <p className="text-[11px] text-muted-foreground">
            Client Desk — Dibuat dengan ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if there are unread changelog entries.
 * Returns { hasUnread, checkUnread }
 */
export function useChangelogUnread() {
  const [hasUnread, setHasUnread] = React.useState(false);
  const supabase = createClient();

  React.useEffect(() => {
    checkUnread();
  }, []);

  async function checkUnread() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's last_seen_at
      const { data: readData } = await supabase
        .from("changelog_reads")
        .select("last_seen_at")
        .eq("user_id", user.id)
        .single();

      // Count entries newer than last_seen_at
      let query = supabase
        .from("changelog")
        .select("id", { count: "exact", head: true });

      if (readData?.last_seen_at) {
        query = query.gt("published_at", readData.last_seen_at);
      }

      const { count } = await query;
      setHasUnread((count || 0) > 0);
    } catch {
      // Table might not exist yet — ignore
    }
  }

  return { hasUnread, checkUnread };
}
