"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Users, MessageCircle, X, Search, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { adminNativeSelectClass } from "@/components/ui/admin-native-form-controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import { ManageActionToolbar } from "@/components/ui/manage-action-toolbar";
import { useStickyTableColumns } from "@/components/ui/use-sticky-table-columns";
import { useResizableTableColumns } from "@/components/ui/use-resizable-table-columns";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import {
    PageHeader,
    PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME,
} from "@/components/ui/page-header";
import {
    areTableColumnPreferencesEqual,
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import { cn } from "@/lib/utils";
import {
    normalizeHexColor,
    resolveHexColor,
    withAlpha,
} from "@/lib/service-colors";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import {
    type BulkActionKind,
    areAllVisibleSelected,
    pruneSelection,
    toggleSelectAllVisible,
    toggleSelection,
} from "@/lib/manage-selection";
import { notifyOnboardingStepUnlocked } from "@/lib/onboarding";


type Freelancer = {
    id: string;
    name: string;
    role: string;
    whatsapp_number: string | null;
    google_email: string | null;
    status: string;
    tags: string[];
    pricelist: MemberPricelist | null;
    created_at: string;
};

type PricelistItem = {
    id: string;
    name: string;
    price: number;
};

type MemberPricelist = {
    items: PricelistItem[];
};

type BadgeColorMap = Record<string, string>;
type TeamBadgeColors = {
    roles: BadgeColorMap;
    tags: BadgeColorMap;
};

type TagInputProps = {
    label: string;
    tags: string[];
    setTags: (tags: string[]) => void;
    input: string;
    setInput: (value: string) => void;
    inputClass: string;
    badgeColors: BadgeColorMap;
};

type PricelistBuilderProps = {
    value: MemberPricelist;
    onChange: (next: MemberPricelist) => void;
    inputClass: string;
};

const roleOptions = ["Photographer", "Videographer", "MUA", "WCC", "Editor", "Asisten", "Lainnya"];

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩" },
    { code: "+60", flag: "🇲🇾" },
    { code: "+65", flag: "🇸🇬" },
    { code: "+66", flag: "🇹🇭" },
    { code: "+1", flag: "🇺🇸" },
    { code: "+44", flag: "🇬🇧" },
    { code: "+81", flag: "🇯🇵" },
    { code: "+82", flag: "🇰🇷" },
    { code: "+61", flag: "🇦🇺" },
];

const TEAM_COLUMN_DEFAULTS: TableColumnPreference[] = lockBoundaryColumns([
    { id: "row_number", label: "No.", visible: true, locked: true },
    { id: "name", label: "Nama", visible: true },
    { id: "role", label: "Peran", visible: true },
    { id: "tags", label: "Tags", visible: true },
    { id: "pricelist_summary", label: "Pricelist", visible: true },
    { id: "whatsapp", label: "Whatsapp", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true, pin: "right" },
]);
const TEAM_NON_RESIZABLE_COLUMN_IDS = ["select", "row_number", "actions"];
const TEAM_COLUMN_MIN_WIDTHS: Record<string, number> = {
    select: 52,
    name: 180,
    role: 128,
    tags: 160,
    pricelist_summary: 140,
    whatsapp: 145,
    status: 116,
};
const TEAM_MANAGE_SELECT_COLUMN: TableColumnPreference = {
    id: "select",
    label: "Select",
    visible: true,
    locked: true,
    pin: "left",
};
const TEAM_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:team:items_per_page";
const TEAM_FILTER_STORAGE_PREFIX = "clientdesk:team:filters";
const TEAM_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const TEAM_DEFAULT_ITEMS_PER_PAGE = 10;
const DEFAULT_TEAM_BADGE_COLORS: TeamBadgeColors = {
    roles: {},
    tags: {},
};

type TeamPageMetadata = {
    tags: string[];
    roles: string[];
    statuses: string[];
    tableColumnPreferences: TableColumnPreference[] | null;
    badgeColors?: {
        roles?: Record<string, string>;
        tags?: Record<string, string>;
    } | null;
};

type TeamFilterStoragePayload = {
    searchQuery: string;
    statusFilters: string[] | string;
    roleFilters: string[] | string;
    tagFilters: string[] | string;
    tagFilter?: string;
};

function normalizeTeamItemsPerPage(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return TEAM_PER_PAGE_OPTIONS.includes(
        parsed as (typeof TEAM_PER_PAGE_OPTIONS)[number],
    )
        ? parsed
        : TEAM_DEFAULT_ITEMS_PER_PAGE;
}

function normalizeTagList(values: string[]) {
    const unique = new Set<string>();
    const normalized: string[] = [];

    values.forEach((value) => {
        const nextValue = value.trim();
        if (!nextValue || unique.has(nextValue)) return;
        unique.add(nextValue);
        normalized.push(nextValue);
    });

    return normalized;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeSelectedFilterValues(values: string[], options: string[]) {
    const optionSet = new Set(options);
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const item of values) {
        if (!optionSet.has(item) || seen.has(item)) continue;
        seen.add(item);
        normalized.push(item);
    }

    return normalized;
}

function parseLegacyOrMultiFilterValue(value: unknown) {
    if (Array.isArray(value)) {
        const seen = new Set<string>();
        const normalized: string[] = [];
        value.forEach((item) => {
            if (typeof item !== "string") return;
            const trimmed = item.trim();
            if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
            seen.add(trimmed);
            normalized.push(trimmed);
        });
        return normalized;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed.toLowerCase() === "all") return [];
        return [trimmed];
    }

    return [] as string[];
}

function arraysAreEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

function splitTagInput(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function mergeTagsWithPendingInput(tags: string[], pendingInput: string) {
    return normalizeTagList([...tags, ...splitTagInput(pendingInput)]);
}

function createPricelistId(prefix: "col" | "item") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function createEmptyPricelist(): MemberPricelist {
    return { items: [] };
}

function formatRupiahNumber(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    const normalized = Math.max(0, Math.floor(value));
    return new Intl.NumberFormat("id-ID").format(normalized);
}

function parseRupiahNumber(rawValue: string) {
    const digitsOnly = rawValue.replace(/\D+/g, "");
    if (!digitsOnly) return 0;
    const parsed = Number(digitsOnly);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

function normalizeMemberPricelist(value: unknown): MemberPricelist {
    if (!value || typeof value !== "object") {
        return createEmptyPricelist();
    }
    const typed = value as { items?: unknown[]; columns?: unknown[] };
    const firstColumnId =
        Array.isArray(typed.columns) &&
        typed.columns.length > 0 &&
        typed.columns[0] &&
        typeof typed.columns[0] === "object" &&
        typeof (typed.columns[0] as { id?: unknown }).id === "string"
            ? String((typed.columns[0] as { id: string }).id).trim()
            : "";
    const rawItems = Array.isArray((value as { items?: unknown[] }).items)
        ? ((value as { items: unknown[] }).items)
        : [];
    const itemSeen = new Set<string>();
    const items: PricelistItem[] = [];

    rawItems.forEach((rawItem, index) => {
        if (!rawItem || typeof rawItem !== "object") return;
        const typedItem = rawItem as { id?: unknown; name?: unknown; price?: unknown; prices?: unknown };
        const rawId =
            typeof typedItem.id === "string" && typedItem.id.trim().length > 0
                ? typedItem.id.trim()
                : createPricelistId("item");
        const id = itemSeen.has(rawId) ? `${rawId}_${index + 1}` : rawId;
        itemSeen.add(id);
        const rawPrices =
            typedItem.prices && typeof typedItem.prices === "object"
                ? (typedItem.prices as Record<string, unknown>)
                : {};
        const rawPriceValue = typedItem.price;
        const firstColumnPrice =
            firstColumnId && rawPrices[firstColumnId] !== undefined
                ? rawPrices[firstColumnId]
                : null;
        const resolvedPrice = (() => {
            if (typeof rawPriceValue === "number" && Number.isFinite(rawPriceValue)) {
                return Math.max(0, Math.floor(rawPriceValue));
            }
            if (typeof rawPriceValue === "string") {
                return parseRupiahNumber(rawPriceValue);
            }
            if (typeof firstColumnPrice === "number" && Number.isFinite(firstColumnPrice)) {
                return Math.max(0, Math.floor(firstColumnPrice));
            }
            if (typeof firstColumnPrice === "string") {
                return parseRupiahNumber(firstColumnPrice);
            }
            return 0;
        })();
        items.push({
            id,
            name:
                typeof typedItem.name === "string" && typedItem.name.trim().length > 0
                    ? typedItem.name.trim()
                    : `Item ${items.length + 1}`,
            price: resolvedPrice,
        });
    });

    return { items };
}

function getPricelistSummary(pricelist: MemberPricelist | null | undefined) {
    const normalized = normalizeMemberPricelist(pricelist);
    if (normalized.items.length === 0) {
        return "-";
    }
    return `${normalized.items.length} item`;
}

function normalizeColorRecord(value: unknown): BadgeColorMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const next: BadgeColorMap = {};
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawColor]) => {
        const key = rawKey.trim();
        if (!key) return;
        const normalizedColor = normalizeHexColor(rawColor);
        if (!normalizedColor) return;
        next[key] = normalizedColor;
    });
    return next;
}

function normalizeTeamBadgeColors(value: unknown): TeamBadgeColors {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ...DEFAULT_TEAM_BADGE_COLORS };
    }
    const typed = value as { roles?: unknown; tags?: unknown };
    return {
        roles: normalizeColorRecord(typed.roles),
        tags: normalizeColorRecord(typed.tags),
    };
}

function areBadgeColorMapsEqual(a: BadgeColorMap, b: BadgeColorMap) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => b[key] === a[key]);
}

function areTeamBadgeColorsEqual(a: TeamBadgeColors, b: TeamBadgeColors) {
    return (
        areBadgeColorMapsEqual(a.roles, b.roles) &&
        areBadgeColorMapsEqual(a.tags, b.tags)
    );
}

function buildBadgeStyle(colorMap: BadgeColorMap, key: string | null | undefined) {
    if (!key) return undefined;
    const color = normalizeHexColor(colorMap[key]);
    if (!color) return undefined;
    return {
        color,
        backgroundColor: withAlpha(color, 0.12),
        borderColor: withAlpha(color, 0.35),
    } as React.CSSProperties;
}

function TagInput({ label, tags, setTags, input, setInput, inputClass, badgeColors }: TagInputProps) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
                        e.preventDefault();
                        const nextTags = mergeTagsWithPendingInput(tags, input);
                        if (nextTags.length !== tags.length) {
                            setTags(nextTags);
                        }
                        setInput("");
                    }
                }}
                placeholder="Ketik tag lalu Enter..."
                className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
                Pisahkan tag dengan koma atau tekan Enter.
            </p>
            {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => {
                        const badgeStyle = buildBadgeStyle(badgeColors, tag);
                        return (
                            <span
                                key={i}
                                style={badgeStyle}
                                className={cn(
                                    "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                                    !badgeStyle && "bg-primary/10 border-transparent text-primary",
                                )}
                            >
                                {tag}
                                <button type="button" onClick={() => setTags(tags.filter((_, j) => j !== i))} className="hover:text-red-500 cursor-pointer"><X className="w-3 h-3" /></button>
                            </span>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

function PricelistBuilder({ value, onChange, inputClass }: PricelistBuilderProps) {
    const addItem = React.useCallback(() => {
        onChange({
            ...value,
            items: [
                ...value.items,
                {
                    id: createPricelistId("item"),
                    name: `Item ${value.items.length + 1}`,
                    price: 0,
                },
            ],
        });
    }, [onChange, value]);

    const updateItemName = React.useCallback((itemId: string, nextName: string) => {
        onChange({
            ...value,
            items: value.items.map((item) =>
                item.id === itemId ? { ...item, name: nextName } : item,
            ),
        });
    }, [onChange, value]);

    const updateItemPrice = React.useCallback((itemId: string, nextRawValue: string) => {
        const parsedPrice = parseRupiahNumber(nextRawValue);
        onChange({
            ...value,
            items: value.items.map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        price: parsedPrice,
                    }
                    : item,
            ),
        });
    }, [onChange, value]);

    const removeItem = React.useCallback((itemId: string) => {
        onChange({
            ...value,
            items: value.items.filter((item) => item.id !== itemId),
        });
    }, [onChange, value]);

    return (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium">Pricelist</p>
                    <p className="text-[11px] text-muted-foreground">
                        Tambah item dan isi harga. Harga otomatis format Rupiah (contoh: 700.000).
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={addItem}>
                        + Item
                    </Button>
                </div>
            </div>

            {value.items.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Belum ada item. Tambah item untuk mengisi harga.
                </p>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Item Pricelist</p>
                    <div className="space-y-2">
                        {value.items.map((item) => (
                            <div key={item.id} className="space-y-2 rounded-md border bg-background p-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        value={item.name}
                                        onChange={(event) => updateItemName(item.id, event.target.value)}
                                        placeholder="Nama item (contoh: Video Cinematic)"
                                        className={inputClass}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0 text-red-600 hover:text-red-700"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground">
                                        Harga
                                    </label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            Rp
                                        </span>
                                        <input
                                            value={formatRupiahNumber(item.price ?? 0)}
                                            onChange={(event) =>
                                                updateItemPrice(item.id, event.target.value)
                                            }
                                            inputMode="numeric"
                                            className={cn(inputClass, "pl-9")}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TeamPage() {
    const supabase = createClient();
    const locale = useLocale();
    const t = useTranslations("Team");
    const tt = useTranslations("TeamPage");
    const tc = useTranslations("Common");
    const [members, setMembers] = React.useState<Freelancer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [editingMember, setEditingMember] = React.useState<Freelancer | null>(null);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [addCountryCode, setAddCountryCode] = React.useState("+62");
    const [editCountryCode, setEditCountryCode] = React.useState("+62");
    const [addTags, setAddTags] = React.useState<string[]>([]);
    const [editTags, setEditTags] = React.useState<string[]>([]);
    const [addPricelist, setAddPricelist] = React.useState<MemberPricelist>(createEmptyPricelist());
    const [editPricelist, setEditPricelist] = React.useState<MemberPricelist>(createEmptyPricelist());
    const [tagInput, setTagInput] = React.useState("");
    const [editTagInput, setEditTagInput] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
    const [roleFilters, setRoleFilters] = React.useState<string[]>([]);
    const [tagFilters, setTagFilters] = React.useState<string[]>([]);
    const [availableTags, setAvailableTags] = React.useState<string[]>([]);
    const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);
    const [availableStatuses, setAvailableStatuses] = React.useState<string[]>([]);
    const [teamBadgeColors, setTeamBadgeColors] = React.useState<TeamBadgeColors>(
        DEFAULT_TEAM_BADGE_COLORS,
    );
    const [badgeColorDialogOpen, setBadgeColorDialogOpen] = React.useState(false);
    const [badgeColorDraft, setBadgeColorDraft] = React.useState<TeamBadgeColors>(
        DEFAULT_TEAM_BADGE_COLORS,
    );
    const [savingBadgeColors, setSavingBadgeColors] = React.useState(false);
    const [totalItems, setTotalItems] = React.useState(0);
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(TEAM_COLUMN_DEFAULTS);
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [resettingColumnWidths, setResettingColumnWidths] = React.useState(false);
    const [isManageMode, setIsManageMode] = React.useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
    const [bulkActionDialog, setBulkActionDialog] = React.useState<{
        open: boolean;
        action: BulkActionKind | null;
    }>({ open: false, action: null });
    const [bulkActionLoading, setBulkActionLoading] = React.useState(false);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = React.useState<{
        open: boolean;
        member: Freelancer | null;
    }>({ open: false, member: null });
    const hasLoadedMembersRef = React.useRef(false);
    const invalidateProfilePublicCache = React.useCallback(async () => {
        try {
            await fetch("/api/internal/cache/invalidate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "profile" }),
            });
        } catch {
            // Best effort cache invalidation.
        }
    }, []);
    const closeManageMode = React.useCallback(() => {
        setIsManageMode(false);
        setSelectedMemberIds([]);
        setBulkActionDialog({ open: false, action: null });
    }, []);

    const fetchMembers = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;

        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
            });

            if (searchQuery.trim()) {
                params.set("search", searchQuery.trim());
            }

            if (statusFilters.length > 0) {
                params.set("statusFilters", JSON.stringify(statusFilters));
            }

            if (roleFilters.length > 0) {
                params.set("roleFilters", JSON.stringify(roleFilters));
            }

            if (tagFilters.length > 0) {
                params.set("tagFilters", JSON.stringify(tagFilters));
                params.set("tag", tagFilters[0]);
            }

            const response = await fetchPaginatedJson<Freelancer, TeamPageMetadata>(
                `/api/internal/team?${params.toString()}`,
            );
            setMembers(
                response.items.map((member) => ({
                    ...member,
                    tags: Array.isArray(member.tags) ? member.tags : [],
                    pricelist: normalizeMemberPricelist(member.pricelist),
                })),
            );
            setTotalItems(response.totalItems);
            setAvailableTags(response.metadata?.tags || []);
            setAvailableRoles(response.metadata?.roles || []);
            setAvailableStatuses(response.metadata?.statuses || []);
            setTeamBadgeColors((current) => {
                const nextColors = normalizeTeamBadgeColors(response.metadata?.badgeColors);
                return areTeamBadgeColorsEqual(current, nextColors) ? current : nextColors;
            });
            setColumns((current) => {
                const nextColumns = mergeTableColumnPreferences(
                    TEAM_COLUMN_DEFAULTS,
                    response.metadata?.tableColumnPreferences || undefined,
                );
                return areTableColumnPreferencesEqual(current, nextColumns)
                    ? current
                    : nextColumns;
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [
        currentPage,
        itemsPerPage,
        itemsPerPageHydrated,
        filtersHydrated,
        roleFilters,
        searchQuery,
        statusFilters,
        tagFilters,
    ]);

    React.useEffect(() => {
        async function hydrateCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        }

        void hydrateCurrentUser();
    }, [supabase]);

    React.useEffect(() => {
        if (!currentUserId) {
            setFiltersHydrated(false);
            return;
        }

        setFiltersHydrated(false);
        const storageKey = `${TEAM_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setSearchQuery("");
                setStatusFilters([]);
                setRoleFilters([]);
                setTagFilters([]);
                return;
            }

            const parsed = JSON.parse(raw) as unknown;
            if (!isObjectRecord(parsed)) {
                setSearchQuery("");
                setStatusFilters([]);
                setRoleFilters([]);
                setTagFilters([]);
                return;
            }

            const readString = (key: keyof TeamFilterStoragePayload, fallback = "") => {
                const value = parsed[key];
                return typeof value === "string" ? value : fallback;
            };

            setSearchQuery(readString("searchQuery", ""));
            setStatusFilters(parseLegacyOrMultiFilterValue(parsed.statusFilters));
            setRoleFilters(parseLegacyOrMultiFilterValue(parsed.roleFilters));
            setTagFilters(parseLegacyOrMultiFilterValue(parsed.tagFilters ?? parsed.tagFilter));
        } catch {
            setSearchQuery("");
            setStatusFilters([]);
            setRoleFilters([]);
            setTagFilters([]);
        } finally {
            setFiltersHydrated(true);
        }
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId || !filtersHydrated) return;
        const storageKey = `${TEAM_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        const payload: TeamFilterStoragePayload = {
            searchQuery,
            statusFilters,
            roleFilters,
            tagFilters,
        };
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, filtersHydrated, roleFilters, searchQuery, statusFilters, tagFilters]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${TEAM_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;

            try {
                const raw = event.newValue;
                if (!raw) {
                    setSearchQuery("");
                    setStatusFilters([]);
                    setRoleFilters([]);
                    setTagFilters([]);
                    return;
                }

                const parsed = JSON.parse(raw) as unknown;
                if (!isObjectRecord(parsed)) return;
                setSearchQuery(typeof parsed.searchQuery === "string" ? parsed.searchQuery : "");
                setStatusFilters(parseLegacyOrMultiFilterValue(parsed.statusFilters));
                setRoleFilters(parseLegacyOrMultiFilterValue(parsed.roleFilters));
                setTagFilters(parseLegacyOrMultiFilterValue(parsed.tagFilters ?? parsed.tagFilter));
            } catch {
                // Ignore malformed storage updates.
            }
        }

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId]);

    React.useEffect(() => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;
        const mode = hasLoadedMembersRef.current ? "refresh" : "initial";
        hasLoadedMembersRef.current = true;
        void fetchMembers(mode);
    }, [fetchMembers, filtersHydrated, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!currentUserId) {
            setItemsPerPageHydrated(false);
            return;
        }
        const storageKey = `${TEAM_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            const raw = window.localStorage.getItem(storageKey);
            setItemsPerPage(normalizeTeamItemsPerPage(raw));
        } catch {
            setItemsPerPage(TEAM_DEFAULT_ITEMS_PER_PAGE);
        } finally {
            setItemsPerPageHydrated(true);
        }
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId || !itemsPerPageHydrated) return;
        const storageKey = `${TEAM_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            window.localStorage.setItem(storageKey, String(normalizeTeamItemsPerPage(itemsPerPage)));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${TEAM_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;
            setItemsPerPage(normalizeTeamItemsPerPage(event.newValue));
        }
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId]);

    async function handleAdd(formData: FormData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const rawWa = formData.get("whatsapp_number") as string;
        const fullWa = rawWa ? `${addCountryCode}${rawWa}`.replace(/[^0-9+]/g, "") : null;
        const normalizedTags = mergeTagsWithPendingInput(addTags, tagInput);

        const { error } = await supabase.from("freelance").insert({
            user_id: user.id,
            name: formData.get("name") as string,
            role: formData.get("role") as string,
            whatsapp_number: fullWa || null,
            google_email: formData.get("google_email") as string || null,
            status: "active",
            tags: normalizedTags,
            pricelist: normalizeMemberPricelist(addPricelist),
        });

        if (!error) {
            setIsAddOpen(false);
            setAddTags([]);
            setTagInput("");
            setAddPricelist(createEmptyPricelist());
            notifyOnboardingStepUnlocked("team");
            void fetchMembers("refresh");
        }
    }

    async function handleEdit(formData: FormData) {
        if (!editingMember) return;

        const rawWa = formData.get("whatsapp_number") as string;
        const fullWa = rawWa ? `${editCountryCode}${rawWa}`.replace(/[^0-9+]/g, "") : null;
        const normalizedTags = mergeTagsWithPendingInput(editTags, editTagInput);

        const { error } = await supabase
            .from("freelance")
            .update({
                name: formData.get("name") as string,
                role: formData.get("role") as string,
                whatsapp_number: fullWa || null,
                google_email: formData.get("google_email") as string || null,
                tags: normalizedTags,
                pricelist: normalizeMemberPricelist(editPricelist),
            })
            .eq("id", editingMember.id);

        if (!error) {
            setIsEditOpen(false);
            setEditingMember(null);
            setEditTags([]);
            setEditTagInput("");
            setEditPricelist(createEmptyPricelist());
            void fetchMembers("refresh");
        }
    }

    async function handleToggleStatus(member: Freelancer) {
        await supabase
            .from("freelance")
            .update({ status: member.status === "active" ? "inactive" : "active" })
            .eq("id", member.id);
        void fetchMembers("refresh");
    }

    function handleDelete(id: string) {
        const member = members.find((item) => item.id === id);
        if (!member) return;
        setDeleteConfirmDialog({ open: true, member });
    }

    async function deleteMemberById(id: string) {
        await supabase.from("freelance").delete().eq("id", id);
    }

    async function confirmDeleteMember() {
        const member = deleteConfirmDialog.member;
        if (!member) return;
        setDeleteConfirmDialog({ open: false, member: null });
        await deleteMemberById(member.id);
        void fetchMembers("refresh");
    }

    async function confirmBulkAction() {
        if (bulkActionDialog.action !== "delete" || selectedMemberIds.length === 0) return;
        setBulkActionLoading(true);
        const selectedMembers = members.filter((member) => selectedMemberIdSet.has(member.id));
        for (const member of selectedMembers) {
            await deleteMemberById(member.id);
        }
        setBulkActionLoading(false);
        setBulkActionDialog({ open: false, action: null });
        setSelectedMemberIds([]);
        void fetchMembers("refresh");
    }

    function sendWhatsApp(phone: string | null) {
        if (!phone) return;
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        openWhatsAppUrl(buildWhatsAppUrl(cleaned));
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
    const selectClass = adminNativeSelectClass;

    React.useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage, roleFilters, searchQuery, statusFilters, tagFilters]);

    React.useEffect(() => {
        if (loading) return;

        const normalizedStatusFilters = normalizeSelectedFilterValues(statusFilters, availableStatuses);
        if (!arraysAreEqual(normalizedStatusFilters, statusFilters)) {
            setStatusFilters(normalizedStatusFilters);
        }

        const normalizedRoleFilters = normalizeSelectedFilterValues(roleFilters, availableRoles);
        if (!arraysAreEqual(normalizedRoleFilters, roleFilters)) {
            setRoleFilters(normalizedRoleFilters);
        }

        const normalizedTagFilters = normalizeSelectedFilterValues(tagFilters, availableTags);
        if (!arraysAreEqual(normalizedTagFilters, tagFilters)) {
            setTagFilters(normalizedTagFilters);
        }
    }, [availableRoles, availableStatuses, availableTags, loading, roleFilters, statusFilters, tagFilters]);

    React.useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, itemsPerPage, totalItems]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );
    const tableVisibleColumns = React.useMemo(
        () =>
            isManageMode
                ? [TEAM_MANAGE_SELECT_COLUMN, ...orderedVisibleColumns]
                : orderedVisibleColumns,
        [isManageMode, orderedVisibleColumns],
    );
    const {
        getColumnWidthStyle,
        getResizeHandleProps,
        isColumnResizable,
        isColumnBeingResized,
        isResizing,
        cancelActiveResize,
        resetColumnWidths,
    } = useResizableTableColumns({
        enabled: !columnManagerOpen,
        menuKey: "team",
        userId: currentUserId,
        columns: tableVisibleColumns,
        nonResizableColumnIds: TEAM_NON_RESIZABLE_COLUMN_IDS,
        minWidthByColumnId: TEAM_COLUMN_MIN_WIDTHS,
    });
    const {
        tableRef,
        getStickyColumnStyle,
        getStickyColumnClassName,
    } = useStickyTableColumns(tableVisibleColumns, {
        enabled: !columnManagerOpen,
        isResizing,
    });
    const getDesktopHeaderClassName = React.useCallback(
        (columnId: string, className: string) =>
            cn(className, getStickyColumnClassName(columnId, { header: true })),
        [getStickyColumnClassName],
    );
    const getDesktopCellClassName = React.useCallback(
        (columnId: string, className: string) =>
            cn(className, getStickyColumnClassName(columnId)),
        [getStickyColumnClassName],
    );
    const getDesktopColumnStyle = React.useCallback(
        (columnId: string, options?: { header?: boolean }) => {
            const stickyStyle = getStickyColumnStyle(columnId, options);
            const widthStyle = getColumnWidthStyle(columnId);

            if (stickyStyle && widthStyle) {
                return { ...widthStyle, ...stickyStyle };
            }

            return widthStyle || stickyStyle;
        },
        [getColumnWidthStyle, getStickyColumnStyle],
    );
    const handleColumnManagerOpenChange = React.useCallback((nextOpen: boolean) => {
        setColumnManagerOpen(nextOpen);
    }, []);
    React.useEffect(() => {
        if (!badgeColorDialogOpen) return;
        setBadgeColorDraft(normalizeTeamBadgeColors(teamBadgeColors));
    }, [badgeColorDialogOpen, teamBadgeColors]);
    React.useEffect(() => {
        if (!columnManagerOpen) return;
        cancelActiveResize();
    }, [cancelActiveResize, columnManagerOpen]);
    const statusFilterOptions = React.useMemo(
        () =>
            availableStatuses.map((status) => ({
                value: status,
                label:
                    status === "active"
                        ? t("aktif")
                        : status === "inactive"
                            ? t("nonaktif")
                            : status,
            })),
        [availableStatuses, t],
    );
    const roleFilterOptions = React.useMemo(
        () => availableRoles.map((role) => ({ value: role, label: role })),
        [availableRoles],
    );
    const tagFilterOptions = React.useMemo(
        () => availableTags.map((tag) => ({ value: tag, label: tag })),
        [availableTags],
    );
    const hasActiveListFilters =
        searchQuery.trim().length > 0 ||
        statusFilters.length > 0 ||
        roleFilters.length > 0 ||
        tagFilters.length > 0;
    const multiCountSuffix = tt("selectedCountSuffix");
    const showListControls =
        !loading &&
        (
            totalItems > 0 ||
            hasActiveListFilters ||
            availableTags.length > 0 ||
            availableRoles.length > 0 ||
            availableStatuses.length > 0
        );
    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);
    const visibleMemberIds = React.useMemo(
        () => members.map((member) => member.id),
        [members],
    );
    const allVisibleSelected = React.useMemo(
        () => areAllVisibleSelected(selectedMemberIds, visibleMemberIds),
        [selectedMemberIds, visibleMemberIds],
    );
    const selectedCount = selectedMemberIds.length;
    const manageToolbarLabels = React.useMemo(
        () => ({
            manage: tc("kelola"),
            selectAll: tc("pilihSemua"),
            deleteSelected: tc("hapusTerpilih"),
            selectedCount: tc("nDipilih", { count: selectedCount }),
            closeManage: locale === "en" ? "Close manage mode" : "Tutup mode kelola",
        }),
        [locale, selectedCount, tc],
    );
    const selectedMemberIdSet = React.useMemo(
        () => new Set(selectedMemberIds),
        [selectedMemberIds],
    );
    React.useEffect(() => {
        setSelectedMemberIds((current) => {
            const next = pruneSelection(current, visibleMemberIds);
            return next.length === current.length ? current : next;
        });
    }, [visibleMemberIds]);
    const roleColorLabels = React.useMemo(
        () =>
            normalizeTagList([
                ...roleOptions,
                ...availableRoles,
                ...Object.keys(teamBadgeColors.roles),
                ...members
                    .map((member) => member.role)
                    .filter((role): role is string => typeof role === "string" && role.trim().length > 0),
            ]),
        [availableRoles, members, teamBadgeColors.roles],
    );
    const tagColorLabels = React.useMemo(
        () =>
            normalizeTagList([
                ...availableTags,
                ...Object.keys(teamBadgeColors.tags),
                ...members.flatMap((member) => member.tags),
            ]),
        [availableTags, members, teamBadgeColors.tags],
    );

    function updateBadgeColorDraft(
        type: "roles" | "tags",
        key: string,
        rawColor: string,
    ) {
        const normalizedKey = key.trim();
        if (!normalizedKey) return;
        const normalizedColor = normalizeHexColor(rawColor);
        setBadgeColorDraft((current) => {
            const nextMap = { ...current[type] };
            if (!normalizedColor) {
                delete nextMap[normalizedKey];
            } else {
                nextMap[normalizedKey] = normalizedColor;
            }
            return { ...current, [type]: nextMap };
        });
    }

    async function saveBadgeColors() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const normalizedPayload = normalizeTeamBadgeColors(badgeColorDraft);
        setSavingBadgeColors(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ team_badge_colors: normalizedPayload })
                .eq("id", user.id);

            if (error) return;

            setTeamBadgeColors(normalizedPayload);
            setBadgeColorDialogOpen(false);
            await invalidateProfilePublicCache();
        } finally {
            setSavingBadgeColors(false);
        }
    }

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setSavingColumns(true);
        const { data: profile } = await supabase
            .from("profiles")
            .select("table_column_preferences")
            .eq("id", user.id)
            .single();
        const payload = updateTableColumnPreferenceMap(
            profile?.table_column_preferences,
            "team",
            nextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        await invalidateProfilePublicCache();
        setColumns((current) =>
            areTableColumnPreferencesEqual(current, nextColumns)
                ? current
                : nextColumns,
        );
        setSavingColumns(false);
        setColumnManagerOpen(false);
    }

    async function handleResetColumnWidths() {
        setResettingColumnWidths(true);
        try {
            await new Promise<void>((resolve) =>
                window.requestAnimationFrame(() => resolve()),
            );
            resetColumnWidths();
            setColumnManagerOpen(false);
        } finally {
            setResettingColumnWidths(false);
        }
    }

    function renderDesktopHeaderLabel(column: TableColumnPreference, label: React.ReactNode) {
        const resizeHandleProps = getResizeHandleProps(column.id);
        const resizable = isColumnResizable(column.id);
        const resizing = isColumnBeingResized(column.id);

        return (
            <div className={cn("relative flex items-center", resizable && "pr-3")}>
                <span>{label}</span>
                {resizeHandleProps ? (
                    <button
                        type="button"
                        aria-label={`Resize ${column.label}`}
                        title="Geser untuk ubah lebar kolom"
                        className={cn(
                            "absolute -right-3 top-1/2 h-8 w-6 -translate-y-1/2 touch-none select-none cursor-col-resize rounded transition-colors",
                            resizing ? "bg-primary/15" : "hover:bg-muted/80",
                        )}
                        onPointerDown={resizeHandleProps.onPointerDown}
                    >
                        <span
                            className={cn(
                                "absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2",
                                resizing ? "bg-primary" : "bg-border",
                            )}
                        />
                    </button>
                ) : null}
            </div>
        );
    }

    function renderDesktopHeaderCell(
        column: TableColumnPreference,
        className: string,
        label: React.ReactNode,
    ) {
        return (
            <th
                key={column.id}
                data-column-id={column.id}
                style={getDesktopColumnStyle(column.id, { header: true })}
                className={getDesktopHeaderClassName(column.id, className)}
            >
                {renderDesktopHeaderLabel(column, label)}
            </th>
        );
    }

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "select":
                return renderDesktopHeaderCell(
                    column,
                    "w-12 px-3 py-4 font-medium text-muted-foreground text-center",
                    (
                        <div className="flex justify-center">
                            <AppCheckbox
                                checked={allVisibleSelected}
                                onCheckedChange={() =>
                                    setSelectedMemberIds((current) =>
                                        toggleSelectAllVisible(current, visibleMemberIds),
                                    )
                                }
                                aria-label={tc("pilihSemua")}
                            />
                        </div>
                    ),
                );
            case "name":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("nama"));
            case "row_number":
                return renderDesktopHeaderCell(column, "w-16 px-4 py-4 font-medium text-muted-foreground text-center", "No.");
            case "role":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("peran"));
            case "tags":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("tags"));
            case "pricelist_summary":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", "Pricelist");
            case "whatsapp":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("whatsapp"));
            case "status":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("status"));
            case "actions":
                return renderDesktopHeaderCell(column, "min-w-[120px] px-4 py-4 font-medium text-muted-foreground text-right", t("aksi"));
            default:
                return null;
        }
    }

    function renderDesktopCell(
        member: Freelancer,
        column: TableColumnPreference,
        rowNumber: number,
    ) {
        switch (column.id) {
            case "select":
                return (
                    <td
                        key={column.id}
                        style={getDesktopColumnStyle(column.id)}
                        className={getDesktopCellClassName(column.id, "w-12 px-3 py-4 text-center")}
                    >
                        <div className="flex justify-center">
                            <AppCheckbox
                                checked={selectedMemberIdSet.has(member.id)}
                                onCheckedChange={() =>
                                    setSelectedMemberIds((current) =>
                                        toggleSelection(current, member.id),
                                    )
                                }
                                aria-label={tc("modeKelola")}
                            />
                        </div>
                    </td>
                );
            case "name":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{member.name}</span>
                        </div>
                    </td>
                );
            case "row_number":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-4 text-center text-sm text-muted-foreground")}>
                        {rowNumber}
                    </td>
                );
            case "role":
                {
                    const roleStyle = buildBadgeStyle(teamBadgeColors.roles, member.role);
                    return (
                        <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                            <span
                                style={roleStyle}
                                className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full border",
                                    !roleStyle && "border-transparent bg-muted text-muted-foreground",
                                )}
                            >
                                {member.role}
                            </span>
                        </td>
                    );
                }
            case "tags":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4")}>
                        {member.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {member.tags.map((tag, i) => {
                                    const tagStyle = buildBadgeStyle(teamBadgeColors.tags, tag);
                                    return (
                                        <span
                                            key={i}
                                            style={tagStyle}
                                            className={cn(
                                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                                                !tagStyle && "border-transparent bg-primary/10 text-primary",
                                            )}
                                        >
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : "-"}
                    </td>
                );
            case "pricelist_summary":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                        {getPricelistSummary(member.pricelist)}
                    </td>
                );
            case "whatsapp":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>{member.whatsapp_number || "-"}</td>;
            case "status":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                        <button
                            onClick={() => handleToggleStatus(member)}
                            disabled={isManageMode}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer transition-colors ${member.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20"
                                : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20"
                                }`}
                        >
                            {member.status === "active" ? t("aktif") : t("nonaktif")}
                        </button>
                    </td>
                );
            case "actions":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "min-w-[120px] px-4 py-4 whitespace-nowrap text-right")}>
                        <div className="flex items-center justify-end gap-2.5 pr-2">
                            {isManageMode ? null : (
                                <>
                            <ActionIconButton tone="green" title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number)}>
                                <MessageCircle className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton tone="indigo" title="Edit" onClick={() => {
                                setEditingMember(member);
                                setEditTags(member.tags || []);
                                setEditTagInput("");
                                setEditPricelist(normalizeMemberPricelist(member.pricelist));
                                const wa = member.whatsapp_number || "";
                                const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                setEditCountryCode(match ? match.code : "+62");
                                setIsEditOpen(true);
                            }}>
                                <Edit2 className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton tone="red" title="Hapus" onClick={() => handleDelete(member.id)}>
                                <Trash2 className="w-4 h-4" />
                            </ActionIconButton>
                                </>
                            )}
                        </div>
                    </td>
                );
            default:
                return null;
        }
    }

    function renderMobileValue(member: Freelancer, column: TableColumnPreference) {
        switch (column.id) {
            case "role":
                return member.role;
            case "tags":
                return member.tags.length > 0 ? member.tags.join(", ") : "-";
            case "pricelist_summary":
                return getPricelistSummary(member.pricelist);
            case "whatsapp":
                return member.whatsapp_number || "-";
            case "status":
                return member.status === "active" ? t("aktif") : t("nonaktif");
            default:
                return "-";
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                actionsClassName={PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME}
                actions={(
                    <>
                        <Dialog
                            open={isAddOpen}
                            onOpenChange={(open) => {
                                setIsAddOpen(open);
                                if (!open) {
                                    setAddTags([]);
                                    setTagInput("");
                                    setAddPricelist(createEmptyPricelist());
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button
                                    className="order-2 w-full lg:order-1 lg:w-auto"
                                    data-onboarding-target="team-add-button"
                                >
                                    <Plus className="w-4 h-4" /> {t("tambah")}
                                </Button>
                            </DialogTrigger>
                            <DialogContent
                                className="sm:max-w-[780px]"
                                data-onboarding-target="team-add-dialog"
                            >
                                <DialogHeader>
                                    <DialogTitle>{t("tambahTitle")}</DialogTitle>
                                    <DialogDescription>{t("tambahDesc")}</DialogDescription>
                                </DialogHeader>
                                <form action={(fd) => handleAdd(fd)} className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t("nama")}</label>
                                        <input
                                            name="name"
                                            required
                                            placeholder={tt("namePlaceholder")}
                                            className={inputClass}
                                            data-onboarding-target="team-add-dialog-name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t("peran")}</label>
                                        <select name="role" required className={selectClass}>
                                            <option value="">{t("pilihPeran")}</option>
                                            {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t("whatsapp")}</label>
                                        <div className="flex gap-2">
                                            <select value={addCountryCode} onChange={e => setAddCountryCode(e.target.value)} className={selectClass + " !w-28 shrink-0"}>
                                                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                            </select>
                                            <input name="whatsapp_number" type="tel" placeholder="8123456789"
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                                    e.target.value = val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val;
                                                }}
                                                className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Google Email</label>
                                        <input name="google_email" type="email" placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                                    </div>
                                    <TagInput label={t("tags")} tags={addTags} setTags={setAddTags} input={tagInput} setInput={setTagInput} inputClass={inputClass} badgeColors={teamBadgeColors.tags} />
                                    <PricelistBuilder
                                        value={addPricelist}
                                        onChange={setAddPricelist}
                                        inputClass={inputClass}
                                    />
                                    <DialogFooter><Button type="submit">{t("simpan")}</Button></DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={badgeColorDialogOpen} onOpenChange={setBadgeColorDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="order-1 w-full lg:w-auto">
                                    <Palette className="w-4 h-4" />
                                    Warna Role & Tag
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[720px]">
                                <DialogHeader>
                                    <DialogTitle>Warna Role & Tag</DialogTitle>
                                    <DialogDescription>
                                        Atur warna global berdasarkan label role dan tag. Warna akan otomatis dipakai di seluruh anggota yang memiliki label sama.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-5 py-2">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Role</h4>
                                        {roleColorLabels.length > 0 ? (
                                            <div className="space-y-2">
                                                {roleColorLabels.map((roleLabel) => {
                                                    const currentColor = resolveHexColor(
                                                        badgeColorDraft.roles[roleLabel],
                                                        "#000000",
                                                    );
                                                    const previewStyle = buildBadgeStyle(
                                                        badgeColorDraft.roles,
                                                        roleLabel,
                                                    );
                                                    return (
                                                        <div key={`role:${roleLabel}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                                                            <div className="min-w-0 flex-1">
                                                                <span
                                                                    style={previewStyle}
                                                                    className={cn(
                                                                        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                                                        !previewStyle && "border-transparent bg-muted text-muted-foreground",
                                                                    )}
                                                                >
                                                                    {roleLabel}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="color"
                                                                value={currentColor}
                                                                onChange={(event) =>
                                                                    updateBadgeColorDraft("roles", roleLabel, event.target.value)
                                                                }
                                                                className="h-9 w-10 cursor-pointer rounded-md border p-0.5"
                                                            />
                                                            <input
                                                                value={badgeColorDraft.roles[roleLabel] || ""}
                                                                onChange={(event) =>
                                                                    updateBadgeColorDraft("roles", roleLabel, event.target.value)
                                                                }
                                                                placeholder="#000000"
                                                                className={cn(inputClass, "h-9 w-28")}
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => updateBadgeColorDraft("roles", roleLabel, "")}
                                                            >
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                                Belum ada role untuk diatur warnanya.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Tag</h4>
                                        {tagColorLabels.length > 0 ? (
                                            <div className="space-y-2">
                                                {tagColorLabels.map((tagLabel) => {
                                                    const currentColor = resolveHexColor(
                                                        badgeColorDraft.tags[tagLabel],
                                                        "#000000",
                                                    );
                                                    const previewStyle = buildBadgeStyle(
                                                        badgeColorDraft.tags,
                                                        tagLabel,
                                                    );
                                                    return (
                                                        <div key={`tag:${tagLabel}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                                                            <div className="min-w-0 flex-1">
                                                                <span
                                                                    style={previewStyle}
                                                                    className={cn(
                                                                        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                                                        !previewStyle && "border-transparent bg-primary/10 text-primary",
                                                                    )}
                                                                >
                                                                    {tagLabel}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="color"
                                                                value={currentColor}
                                                                onChange={(event) =>
                                                                    updateBadgeColorDraft("tags", tagLabel, event.target.value)
                                                                }
                                                                className="h-9 w-10 cursor-pointer rounded-md border p-0.5"
                                                            />
                                                            <input
                                                                value={badgeColorDraft.tags[tagLabel] || ""}
                                                                onChange={(event) =>
                                                                    updateBadgeColorDraft("tags", tagLabel, event.target.value)
                                                                }
                                                                placeholder="#000000"
                                                                className={cn(inputClass, "h-9 w-28")}
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => updateBadgeColorDraft("tags", tagLabel, "")}
                                                            >
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                                Belum ada tag untuk diatur warnanya.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setBadgeColorDialogOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={() => void saveBadgeColors()} disabled={savingBadgeColors}>
                                        {savingBadgeColors ? "Menyimpan..." : "Simpan Warna"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {!loading && totalItems > 0 ? (
                            <TableColumnManager
                                title="Kelola Kolom Tim/Freelance"
                                description="Atur kolom yang tampil di tabel tim atau freelance. Kolom Nama dan Aksi selalu tampil, serta lock-nya bisa diaktifkan atau dimatikan."
                                columns={columns}
                                open={columnManagerOpen}
                                onOpenChange={handleColumnManagerOpenChange}
                                onChange={setColumns}
                                onSave={() => saveColumnPreferences(columns)}
                                onResetWidths={() => handleResetColumnWidths()}
                                saving={savingColumns}
                                resettingWidths={resettingColumnWidths}
                                triggerClassName="order-1 w-full lg:order-2 lg:w-auto"
                            />
                        ) : null}
                    </>
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
            </PageHeader>

            {/* Search + Filter */}
            {showListControls && (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cari nama atau peran..."
                            className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-lg border bg-transparent pl-9 pr-8 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <FilterMultiSelect
                        values={statusFilters}
                        onChange={setStatusFilters}
                        options={statusFilterOptions}
                        placeholder={tt("allStatuses")}
                        allLabel={tt("allStatuses")}
                        countSuffix={multiCountSuffix}
                        className="w-full sm:w-[220px]"
                        mobileTitle={tt("filterStatusTitle")}
                        disabled={statusFilterOptions.length === 0}
                    />
                    <FilterMultiSelect
                        values={roleFilters}
                        onChange={setRoleFilters}
                        options={roleFilterOptions}
                        placeholder={tt("allRoles")}
                        allLabel={tt("allRoles")}
                        countSuffix={multiCountSuffix}
                        className="w-full sm:w-[220px]"
                        mobileTitle={tt("filterRoleTitle")}
                        disabled={roleFilterOptions.length === 0}
                    />
                    <FilterMultiSelect
                        values={tagFilters}
                        onChange={setTagFilters}
                        options={tagFilterOptions}
                        placeholder={tt("allTags")}
                        allLabel={tt("allTags")}
                        countSuffix={multiCountSuffix}
                        className="w-full sm:w-[220px]"
                        mobileTitle={tt("filterTagsTitle")}
                        disabled={tagFilterOptions.length === 0}
                    />
                    <ManageActionToolbar
                        variant="simple-manage"
                        isManageMode={isManageMode}
                        labels={manageToolbarLabels}
                        selectedCount={selectedCount}
                        className={isManageMode ? "flex w-full flex-wrap items-center gap-2" : "contents"}
                        manageButtonClassName="w-full sm:w-auto"
                        deleteDisabled={selectedCount === 0}
                        onEnterManage={() => setIsManageMode(true)}
                        onToggleSelectAll={() =>
                            setSelectedMemberIds((current) =>
                                toggleSelectAllVisible(current, visibleMemberIds),
                            )
                        }
                        onDelete={() => setBulkActionDialog({ open: true, action: "delete" })}
                        onCloseManage={closeManageMode}
                    />
                </div>
            )}

            {queryState.isLoading || queryState.isRefreshing ? (
                <>
                    <div className="md:hidden">
                        <CardListSkeleton count={Math.min(queryState.perPage, 4)} withBadge={false} />
                    </div>
                    <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                        <div className="relative overflow-x-auto">
                            <table ref={tableRef} className="min-w-full w-max border-separate border-spacing-0 text-left text-sm">
                                <thead className="text-xs uppercase bg-card border-b">
                                    <tr>
                                        {tableVisibleColumns.map((column) => renderDesktopHeader(column))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    <TableRowsSkeleton
                                        rows={Math.min(queryState.perPage, 6)}
                                        columns={tableVisibleColumns.length}
                                    />
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : queryState.totalItems === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{hasActiveListFilters ? tt("noResults") : t("belumAda")}</h3>
                    <p className="text-muted-foreground text-sm">{hasActiveListFilters ? tt("noResultsDesc") : t("belumAdaDesc")}</p>
                </div>
            ) : (
                <div data-onboarding-target="team-members-list">
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {members.map((member) => {
                            const roleStyle = buildBadgeStyle(teamBadgeColors.roles, member.role);
                            return (
                            <div
                                key={member.id}
                                className={cn(
                                    "rounded-xl border bg-card shadow-sm p-4 space-y-3",
                                    isManageMode && selectedMemberIdSet.has(member.id) && "ring-1 ring-foreground/20",
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {isManageMode ? (
                                        <AppCheckbox
                                            checked={selectedMemberIdSet.has(member.id)}
                                            onCheckedChange={() =>
                                                setSelectedMemberIds((current) =>
                                                    toggleSelection(current, member.id),
                                                )
                                            }
                                            aria-label={tc("modeKelola")}
                                        />
                                    ) : null}
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{member.name}</p>
                                        <span
                                            style={roleStyle}
                                            className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full border",
                                                !roleStyle && "border-transparent bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {member.role}
                                        </span>
                                    </div>
                                    <button onClick={() => handleToggleStatus(member)}
                                        disabled={isManageMode}
                                        className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer ${member.status === "active"
                                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                            : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                                        {member.status === "active" ? t("aktif") : t("nonaktif")}
                                    </button>
                                </div>
                                <div className="space-y-1 text-sm">
                                    {orderedVisibleColumns
                                        .filter((column) => !["name", "row_number", "actions"].includes(column.id))
                                        .map((column) => (
                                            <div key={column.id} className="flex items-start justify-between gap-3">
                                                <span className="text-muted-foreground">{column.label}</span>
                                                {column.id === "role" ? (
                                                    (() => {
                                                        const roleStyle = buildBadgeStyle(teamBadgeColors.roles, member.role);
                                                        return (
                                                            <span
                                                                style={roleStyle}
                                                                className={cn(
                                                                    "text-xs font-medium px-2 py-0.5 rounded-full border",
                                                                    !roleStyle && "border-transparent bg-muted text-muted-foreground",
                                                                )}
                                                            >
                                                                {member.role}
                                                            </span>
                                                        );
                                                    })()
                                                ) : column.id === "tags" ? (
                                                    <div className="flex max-w-[180px] flex-wrap justify-end gap-1">
                                                        {member.tags.length > 0 ? member.tags.map((tag, index) => {
                                                            const tagStyle = buildBadgeStyle(teamBadgeColors.tags, tag);
                                                            return (
                                                                <span
                                                                    key={`${member.id}:${tag}:${index}`}
                                                                    style={tagStyle}
                                                                    className={cn(
                                                                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                                                                        !tagStyle && "border-transparent bg-primary/10 text-primary",
                                                                    )}
                                                                >
                                                                    {tag}
                                                                </span>
                                                            );
                                                        }) : (
                                                            <span className="text-right text-foreground">-</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="max-w-[180px] truncate text-right text-foreground" title={String(renderMobileValue(member, column) ?? "-")}>
                                                        {renderMobileValue(member, column)}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                </div>
                                {!isManageMode ? (
                                <div className="flex items-center gap-2.5 pt-1 border-t">
                                    <ActionIconButton tone="green" title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number)}>
                                        <MessageCircle className="w-4 h-4" />
                                    </ActionIconButton>
                                    <ActionIconButton tone="indigo" title="Edit" onClick={() => {
                                        setEditingMember(member);
                                        setEditTags(member.tags || []);
                                        setEditTagInput("");
                                        setEditPricelist(normalizeMemberPricelist(member.pricelist));
                                        const wa = member.whatsapp_number || "";
                                        const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                        setEditCountryCode(match ? match.code : "+62");
                                        setIsEditOpen(true);
                                    }}>
                                        <Edit2 className="w-4 h-4" />
                                    </ActionIconButton>
                                    <ActionIconButton tone="red" title="Hapus" onClick={() => handleDelete(member.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </ActionIconButton>
                                </div>
                                ) : null}
                            </div>
                            );
                        })}
                    </div>
                    <div className="md:hidden">
                        <TablePagination
                            totalItems={queryState.totalItems}
                            currentPage={queryState.page}
                            itemsPerPage={queryState.perPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            perPageOptions={[...TEAM_PER_PAGE_OPTIONS]}
                        />
                    </div>

                    {/* Desktop Table */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                        <div className="relative overflow-x-auto">
                            <table ref={tableRef} className="min-w-full w-max border-separate border-spacing-0 text-left text-sm">
                                <thead className="text-xs uppercase bg-card border-b">
                                    <tr>
                                        {tableVisibleColumns.map((column) => renderDesktopHeader(column))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {members.map((member, rowIndex) => {
                                        const rowNumber =
                                            (currentPage - 1) * itemsPerPage + rowIndex + 1;
                                        return (
                                            <tr key={member.id} className="group hover:bg-muted/50 transition-colors">
                                                {tableVisibleColumns.map((column) =>
                                                    renderDesktopCell(member, column, rowNumber),
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination totalItems={queryState.totalItems} currentPage={queryState.page} itemsPerPage={queryState.perPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...TEAM_PER_PAGE_OPTIONS]} />
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog
                open={isEditOpen}
                onOpenChange={(open) => {
                    setIsEditOpen(open);
                    if (!open) {
                        setEditingMember(null);
                        setEditTags([]);
                        setEditTagInput("");
                        setEditPricelist(createEmptyPricelist());
                    }
                }}
            >
                <DialogContent className="sm:max-w-[780px]">
                    <DialogHeader>
                        <DialogTitle>{t("editTitle")}</DialogTitle>
                        <DialogDescription>{tt("editDesc")}</DialogDescription>
                    </DialogHeader>
                    {editingMember && (
                        <form action={(fd) => handleEdit(fd)} className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("nama")}</label>
                                <input name="name" required defaultValue={editingMember.name} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("peran")}</label>
                                <select name="role" required defaultValue={editingMember.role} className={selectClass}>
                                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("whatsapp")}</label>
                                <div className="flex gap-2">
                                    <select value={editCountryCode} onChange={e => setEditCountryCode(e.target.value)} className={selectClass + " !w-28 shrink-0"}>
                                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                    </select>
                                    <input name="whatsapp_number" type="tel" placeholder="8123456789"
                                        defaultValue={(() => {
                                            const wa = editingMember?.whatsapp_number || "";
                                            const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                            return match ? wa.slice(match.code.length) : wa.replace(/^0/, "");
                                        })()}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            e.target.value = val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val;
                                        }}
                                        className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Google Email</label>
                                <input name="google_email" type="email" defaultValue={editingMember.google_email || ""} placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                            </div>
                            <TagInput label={t("tags")} tags={editTags} setTags={setEditTags} input={editTagInput} setInput={setEditTagInput} inputClass={inputClass} badgeColors={teamBadgeColors.tags} />
                            <PricelistBuilder
                                value={editPricelist}
                                onChange={setEditPricelist}
                                inputClass={inputClass}
                            />
                            <DialogFooter><Button type="submit">{t("perbarui")}</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={bulkActionDialog.open}
                onOpenChange={(open) =>
                    setBulkActionDialog({
                        open,
                        action: open ? bulkActionDialog.action : null,
                    })
                }
                title={locale === "en" ? "Confirmation" : "Konfirmasi"}
                message={
                    locale === "en"
                        ? `${selectedCount} team member(s) will be deleted.`
                        : `${selectedCount} anggota tim akan dihapus.`
                }
                cancelLabel={tc("batal")}
                confirmLabel={bulkActionLoading ? (locale === "en" ? "Deleting..." : "Menghapus...") : tc("hapusTerpilih")}
                confirmVariant="destructive"
                onConfirm={() => { void confirmBulkAction(); }}
                loading={bulkActionLoading}
            />
            <ActionConfirmDialog
                open={deleteConfirmDialog.open}
                onOpenChange={(open) =>
                    setDeleteConfirmDialog((prev) => ({
                        ...prev,
                        open,
                        member: open ? prev.member : null,
                    }))
                }
                title="Konfirmasi"
                message={tt("deleteConfirm")}
                cancelLabel="Batal"
                confirmLabel="Hapus"
                confirmVariant="destructive"
                onConfirm={confirmDeleteMember}
            />
        </div>
    );
}
