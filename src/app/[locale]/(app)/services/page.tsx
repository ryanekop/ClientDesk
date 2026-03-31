"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Save,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Clock,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  Layers,
  Eye,
  EyeOff,
  GripVertical,
  MoveVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityMultiSelect } from "@/components/ui/city-multi-select";
import { useSuccessToast } from "@/components/ui/success-toast";
import {
  PageHeader,
  PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME,
} from "@/components/ui/page-header";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { TablePagination } from "@/components/ui/table-pagination";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import {
  getActiveEventTypes,
  getBuiltInEventTypes,
  isShowAllPackagesEventType,
  normalizeEventTypeName,
  normalizeEventTypeList,
} from "@/lib/event-type-config";
import { CardListSkeleton } from "@/components/ui/data-skeletons";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import {
  buildCityDisplayName,
  normalizeCityCode,
  type CityReferenceItem,
} from "@/lib/city-references";
import {
  buildServiceSoftPalette,
  resolveHexColor,
} from "@/lib/service-colors";

type Service = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  price: number;
  original_price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  is_addon: boolean;
  affects_schedule: boolean | null;
  is_public: boolean | null;
  sort_order: number;
  created_at: string;
  event_types: string[] | null;
};

type ServiceGroupKey = "main" | "addon";

type ServiceCityScopeSummary = {
  isAllCities: boolean;
  visibleLabels: string[];
  hiddenCount: number;
};

type ServicesPageMetadata = {
  eventTypeOptions: string[];
  usedEventTypes: string[];
  hasAnyServices: boolean;
};

type ProfilePreferencesRow = {
  form_event_types: string[] | null;
  custom_event_types: string[] | null;
  form_brand_color: string | null;
};

const EVENT_TYPES = getBuiltInEventTypes();
const SERVICE_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const SERVICE_DEFAULT_ITEMS_PER_PAGE = 10;
const SERVICE_ITEMS_PER_PAGE_STORAGE_PREFIX =
  "clientdesk:services:itemsPerPage";
const ALL_CITIES_SCOPE_SUMMARY: ServiceCityScopeSummary = {
  isAllCities: true,
  visibleLabels: [],
  hiddenCount: 0,
};

function normalizeServiceItemsPerPage(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return SERVICE_PER_PAGE_OPTIONS.includes(
    parsed as (typeof SERVICE_PER_PAGE_OPTIONS)[number],
  )
    ? parsed
    : SERVICE_DEFAULT_ITEMS_PER_PAGE;
}

function getCityCodesFromFormData(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("city_codes")
        .map((value) => normalizeCityCode(String(value)))
        .filter(Boolean),
    ),
  );
}

function getServiceGroupKey(service: Pick<Service, "is_addon">): ServiceGroupKey {
  return service.is_addon ? "addon" : "main";
}

function compareServices(a: Service, b: Service) {
  const sortDiff = a.sort_order - b.sort_order;
  if (sortDiff !== 0) return sortDiff;

  const createdAtDiff =
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (createdAtDiff !== 0) return createdAtDiff;

  return a.name.localeCompare(b.name);
}

function serviceHasEventType(
  service: Pick<Service, "event_types">,
  eventType: string,
) {
  if (!service.event_types || service.event_types.length === 0) return false;
  const normalizedEventType = normalizeEventTypeName(eventType);
  if (!normalizedEventType) return false;
  return service.event_types.some(
    (serviceEventType) =>
      normalizeEventTypeName(serviceEventType) === normalizedEventType,
  );
}

function normalizeServiceOrder(group: Service[]) {
  return group.map((service, index) => ({
    ...service,
    sort_order: index,
  }));
}

function splitServicesByGroup(items: Service[]) {
  const sorted = [...items].sort(compareServices);
  return {
    main: sorted.filter((service) => !service.is_addon),
    addon: sorted.filter((service) => service.is_addon),
  };
}

function reorderGroup(
  items: Service[],
  targetGroup: ServiceGroupKey,
  normalizedGroup: Service[],
) {
  const orderMap = new Map(
    normalizedGroup.map((service) => [service.id, service.sort_order]),
  );

  return items.map((service) => {
    if (getServiceGroupKey(service) !== targetGroup) return service;

    const nextOrder = orderMap.get(service.id);
    return typeof nextOrder === "number"
      ? { ...service, sort_order: nextOrder }
      : service;
  });
}

function buildSortableId(service: Service) {
  return `${getServiceGroupKey(service)}:${service.id}`;
}

function ServiceDragHandle({
  attributes,
  listeners,
  setActivatorNodeRef,
}: {
  attributes?: ReturnType<typeof useSortable>["attributes"];
  listeners?: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef?: ReturnType<typeof useSortable>["setActivatorNodeRef"];
}) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="touch-none cursor-grab rounded-md border border-dashed border-input bg-background p-2 text-muted-foreground transition-colors hover:bg-muted/50 active:cursor-grabbing"
      {...attributes}
      {...listeners}
      title="Drag untuk ubah urutan"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function SortableServiceRow({
  service,
  cityScopeSummary,
  formatCurrency,
  durationLabel,
  fallbackColor,
  onMoveUp,
  onMoveDown,
}: {
  service: Service;
  cityScopeSummary: ServiceCityScopeSummary;
  formatCurrency: (n: number) => string;
  durationLabel: string | null;
  fallbackColor: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const sortable = useSortable({ id: buildSortableId(service) });
  const serviceColor = resolveHexColor(service.color, fallbackColor);
  const softPalette = buildServiceSoftPalette({
    serviceColor,
    fallbackColor,
    selected: true,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  /* eslint-disable react-hooks/refs */
  return (
    <div ref={sortable.setNodeRef} style={style}>
      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <ServiceDragHandle
          attributes={sortable.attributes}
          listeners={sortable.listeners}
          setActivatorNodeRef={sortable.setActivatorNodeRef}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">{service.name}</h4>
                <span
                  className="inline-flex h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: softPalette.summaryBackgroundColor,
                    borderColor: softPalette.summaryBorderColor,
                  }}
                  title={`Warna paket: ${serviceColor}`}
                />
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    service.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {service.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    service.is_public !== false
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                  }`}
                >
                  {service.is_public !== false ? "Publik" : "Privat"}
                </span>
              </div>
              {service.description ? (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {service.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {cityScopeSummary.isAllCities ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Semua Kota/Kabupaten
                  </span>
                ) : (
                  <>
                    {cityScopeSummary.visibleLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        {label}
                      </span>
                    ))}
                    {cityScopeSummary.hiddenCount > 0 ? (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        +{cityScopeSummary.hiddenCount}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold">{formatCurrency(service.price)}</div>
              {service.original_price &&
              service.original_price > service.price ? (
                <div className="text-xs text-muted-foreground line-through">
                  {formatCurrency(service.original_price)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {durationLabel ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {durationLabel}
                </span>
              ) : null}
              {service.event_types?.length ? (
                <span>{service.event_types.join(", ")}</span>
              ) : (
                <span>Semua tipe acara</span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onMoveUp}
                title="Pindah ke atas"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onMoveDown}
                title="Pindah ke bawah"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}

function SectionDivider({
  title,
  description,
  count,
  badge,
}: {
  title: string;
  description: string;
  count: number;
  badge?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {count}
            </span>
            {badge}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

function ServiceCard({
  service,
  cityScopeSummary,
  formatCurrency,
  durationLabel,
  fallbackColor,
  onEdit,
  onToggleActive,
  onTogglePublic,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  service: Service;
  cityScopeSummary: ServiceCityScopeSummary;
  formatCurrency: (n: number) => string;
  durationLabel: string | null;
  fallbackColor: string;
  onEdit: () => void;
  onToggleActive: () => void;
  onTogglePublic: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const serviceColor = resolveHexColor(service.color, fallbackColor);
  const softPalette = buildServiceSoftPalette({
    serviceColor,
    fallbackColor,
    selected: true,
  });
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{service.name}</h3>
            <span
              className="inline-flex h-3 w-3 rounded-full border"
              style={{
                backgroundColor: softPalette.summaryBackgroundColor,
                borderColor: softPalette.summaryBorderColor,
              }}
              title={`Warna paket: ${serviceColor}`}
            />
          </div>
          {service.description ? (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {service.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              service.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            }`}
          >
            {service.is_active ? "Aktif" : "Nonaktif"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              service.is_public !== false
                ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
            }`}
          >
            {service.is_public !== false ? "Publik" : "Privat"}
          </span>
          {service.is_addon ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
              <Layers className="h-2.5 w-2.5" /> Add-on
            </span>
          ) : null}
        </div>
      </div>

      {service.event_types?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {service.event_types.map((eventType) => (
            <span
              key={eventType}
              className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            >
              {eventType}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-1">
        {cityScopeSummary.isAllCities ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Semua Kota/Kabupaten
          </span>
        ) : (
          <>
            {cityScopeSummary.visibleLabels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {label}
              </span>
            ))}
            {cityScopeSummary.hiddenCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                +{cityScopeSummary.hiddenCount}
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="text-xl font-bold">{formatCurrency(service.price)}</div>
        {service.original_price && service.original_price > service.price ? (
          <div className="text-sm text-muted-foreground line-through">
            {formatCurrency(service.original_price)}
          </div>
        ) : null}
        {durationLabel ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {durationLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onEdit}>
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onToggleActive}
          title={service.is_active ? "Nonaktifkan" : "Aktifkan"}
        >
          {service.is_active ? (
            <ToggleRight className="h-4 w-4 text-green-600" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onTogglePublic}
          title={service.is_public !== false ? "Jadikan privat" : "Jadikan publik"}
        >
          {service.is_public !== false ? (
            <Eye className="h-4 w-4 text-sky-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-amber-600" />
          )}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
        <div className="ml-auto flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onMoveUp}
            title="Pindah ke atas"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onMoveDown}
            title="Pindah ke bawah"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptySectionState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ServicesPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const t = useTranslations("Services");
  const ts = useTranslations("ServicesPage");
  const [services, setServices] = React.useState<Service[]>([]);
  const [mainServices, setMainServices] = React.useState<Service[]>([]);
  const [addonServices, setAddonServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isUpdatingService, setIsUpdatingService] = React.useState(false);
  const [addIsAddon, setAddIsAddon] = React.useState(false);
  const [addAffectsSchedule, setAddAffectsSchedule] = React.useState(true);
  const [addColorInput, setAddColorInput] = React.useState("#000000");
  const [editIsAddon, setEditIsAddon] = React.useState(false);
  const [editAffectsSchedule, setEditAffectsSchedule] = React.useState(true);
  const [editColorInput, setEditColorInput] = React.useState("#000000");
  const [mainPage, setMainPage] = React.useState(1);
  const [addonPage, setAddonPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(
    SERVICE_DEFAULT_ITEMS_PER_PAGE,
  );
  const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedEventFilter, setSelectedEventFilter] = React.useState("");
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [savingOrderGroup, setSavingOrderGroup] =
    React.useState<ServiceGroupKey | null>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [pageError, setPageError] = React.useState("");
  const [profileBrandColor, setProfileBrandColor] = React.useState("#000000");
  const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);
  const [usedEventTypeOptions, setUsedEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);
  const [cityOptions, setCityOptions] = React.useState<CityReferenceItem[]>([]);
  const [serviceCityCodesByServiceId, setServiceCityCodesByServiceId] = React.useState<
    Record<string, string[]>
  >({});
  const [addCityCodes, setAddCityCodes] = React.useState<string[]>([]);
  const [editCityCodes, setEditCityCodes] = React.useState<string[]>([]);
  const [mainTotalItems, setMainTotalItems] = React.useState(0);
  const [addonTotalItems, setAddonTotalItems] = React.useState(0);
  const [hasAnyServices, setHasAnyServices] = React.useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = React.useState<{
    open: boolean;
    service: Service | null;
  }>({ open: false, service: null });
  const hasLoadedPagedServicesRef = React.useRef(false);
  const { showSuccessToast, successToastNode } = useSuccessToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchCityOptions = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("region_city_references")
      .select("city_code, city_name, province_code, province_name")
      .order("province_code", { ascending: true })
      .order("city_name", { ascending: true });
    if (error) return;
    const nextCities = ((data || []) as CityReferenceItem[]).map((item) => ({
      city_code: normalizeCityCode(item.city_code),
      city_name: item.city_name,
      province_code: item.province_code,
      province_name: item.province_name,
    })).filter((item) => item.city_code);
    setCityOptions(nextCities);
  }, [supabase]);

  const fetchServiceCityScopeMap = React.useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("service_city_scopes")
        .select("service_id, city_code")
        .eq("user_id", userId);
      if (error) {
        setServiceCityCodesByServiceId({});
        return;
      }
      const nextMap: Record<string, string[]> = {};
      ((data || []) as Array<{ service_id: string; city_code: string }>).forEach(
        (row) => {
          const serviceId = row.service_id;
          const cityCode = normalizeCityCode(row.city_code);
          if (!serviceId || !cityCode) return;
          if (!nextMap[serviceId]) {
            nextMap[serviceId] = [];
          }
          if (!nextMap[serviceId].includes(cityCode)) {
            nextMap[serviceId].push(cityCode);
          }
        },
      );
      setServiceCityCodesByServiceId(nextMap);
    },
    [supabase],
  );

  const syncServiceCityScopes = React.useCallback(
    async (args: { userId: string; serviceId: string; cityCodes: string[] }) => {
      const normalizedCityCodes = Array.from(
        new Set(args.cityCodes.map((code) => normalizeCityCode(code)).filter(Boolean)),
      );
      const { error: deleteError } = await supabase
        .from("service_city_scopes")
        .delete()
        .eq("user_id", args.userId)
        .eq("service_id", args.serviceId);
      if (deleteError) {
        throw deleteError;
      }
      if (normalizedCityCodes.length === 0) {
        return;
      }
      const { error: insertError } = await supabase
        .from("service_city_scopes")
        .insert(
          normalizedCityCodes.map((cityCode) => ({
            user_id: args.userId,
            service_id: args.serviceId,
            city_code: cityCode,
          })),
        );
      if (insertError) {
        throw insertError;
      }
    },
    [supabase],
  );

  const hydrateServiceOrderSnapshot = React.useCallback(
    async (userId?: string | null) => {
      const resolvedUserId =
        userId ||
        currentUserId ||
        (await supabase.auth.getUser()).data.user?.id ||
        null;

      if (!resolvedUserId) {
        setServices([]);
        return [] as Service[];
      }

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", resolvedUserId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const normalizedServices = ((data || []) as Service[]).sort(compareServices);
      setServices(normalizedServices);
      await fetchServiceCityScopeMap(resolvedUserId);
      return normalizedServices;
    },
    [currentUserId, fetchServiceCityScopeMap, supabase],
  );

  const fetchAllServices = React.useCallback(async () => {
    setLoading(true);
    setPageError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId(null);
      setServices([]);
      setServiceCityCodesByServiceId({});
      setLoading(false);
      return;
    }
    setCurrentUserId(user.id);

    const [servicesResult, profileResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("form_event_types, custom_event_types, form_brand_color")
        .eq("id", user.id)
        .single(),
    ]);

    const { data, error } = servicesResult;
    const profile = (profileResult.data || null) as ProfilePreferencesRow | null;
    const resolvedBrandColor = resolveHexColor(profile?.form_brand_color, "#000000");
    setProfileBrandColor(resolvedBrandColor);
    setAddColorInput((currentValue) =>
      currentValue.trim().length > 0 ? currentValue : resolvedBrandColor,
    );
    setEventTypeOptions(
      getActiveEventTypes({
        customEventTypes: normalizeEventTypeList(profile?.custom_event_types),
        activeEventTypes: profile?.form_event_types,
      }),
    );

    if (error) {
      setPageError(error.message);
      setServices([]);
      setHasAnyServices(false);
      setServiceCityCodesByServiceId({});
    } else {
      const normalizedServices = ((data || []) as Service[]).sort(compareServices);
      const nextUsedEventTypes = Array.from(
        new Set(
          normalizedServices.flatMap((service) =>
            (service.event_types || [])
              .map((eventType) => normalizeEventTypeName(eventType))
              .filter((eventType): eventType is string => Boolean(eventType)),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right));
      setServices(normalizedServices);
      setUsedEventTypeOptions(nextUsedEventTypes);
      setHasAnyServices(normalizedServices.length > 0);
      await fetchServiceCityScopeMap(user.id);
    }

    setLoading(false);
  }, [fetchServiceCityScopeMap, supabase]);

  const fetchPagedServices = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (!itemsPerPageHydrated || isReorderMode) return;

    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setPageError("");

    try {
      const createParams = (group: ServiceGroupKey, page: number) => {
        const params = new URLSearchParams({
          group,
          page: String(page),
          perPage: String(itemsPerPage),
        });

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        if (selectedEventFilter) {
          params.set("eventType", selectedEventFilter);
        }

        return params;
      };

      const [mainResponse, addonResponse] = await Promise.all([
        fetchPaginatedJson<Service, ServicesPageMetadata>(
          `/api/internal/services?${createParams("main", mainPage).toString()}`,
        ),
        fetchPaginatedJson<Service, ServicesPageMetadata>(
          `/api/internal/services?${createParams("addon", addonPage).toString()}`,
        ),
      ]);

      setMainServices(mainResponse.items);
      setAddonServices(addonResponse.items);
      setMainTotalItems(mainResponse.totalItems);
      setAddonTotalItems(addonResponse.totalItems);

      const metadata = mainResponse.metadata || addonResponse.metadata;
      setEventTypeOptions(metadata?.eventTypeOptions || EVENT_TYPES);
      setUsedEventTypeOptions(metadata?.usedEventTypes || []);
      setHasAnyServices(Boolean(metadata?.hasAnyServices));
      await hydrateServiceOrderSnapshot();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load services.");
      setMainServices([]);
      setAddonServices([]);
      setMainTotalItems(0);
      setAddonTotalItems(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addonPage, hydrateServiceOrderSnapshot, isReorderMode, itemsPerPage, itemsPerPageHydrated, mainPage, searchQuery, selectedEventFilter]);

  React.useEffect(() => {
    async function hydrateCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    }

    void hydrateCurrentUser();
  }, [supabase]);

  React.useEffect(() => {
    void fetchCityOptions();
  }, [fetchCityOptions]);

  React.useEffect(() => {
    if (!currentUserId) {
      setItemsPerPage(SERVICE_DEFAULT_ITEMS_PER_PAGE);
      setItemsPerPageHydrated(false);
      return;
    }

    const storageKey = `${SERVICE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setItemsPerPage(normalizeServiceItemsPerPage(raw));
    } catch {
      setItemsPerPage(SERVICE_DEFAULT_ITEMS_PER_PAGE);
    } finally {
      setItemsPerPageHydrated(true);
    }
  }, [currentUserId]);

  React.useEffect(() => {
    if (!currentUserId || !itemsPerPageHydrated) return;

    const storageKey = `${SERVICE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
    try {
      window.localStorage.setItem(
        storageKey,
        String(normalizeServiceItemsPerPage(itemsPerPage)),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

  React.useEffect(() => {
    if (!currentUserId) return;

    const storageKey = `${SERVICE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== storageKey) return;
      setItemsPerPage(normalizeServiceItemsPerPage(event.newValue));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [currentUserId]);

  React.useEffect(() => {
    if (isReorderMode) {
      void fetchAllServices();
      return;
    }

    if (!itemsPerPageHydrated) return;
    const mode = hasLoadedPagedServicesRef.current ? "refresh" : "initial";
    hasLoadedPagedServicesRef.current = true;
    void fetchPagedServices(mode);
  }, [fetchAllServices, fetchPagedServices, isReorderMode, itemsPerPageHydrated]);

  async function getRequiredUserId() {
    if (currentUserId) return currentUserId;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }
    setCurrentUserId(user.id);
    return user.id;
  }

  async function normalizeGroupAfterMutation(groupKey: ServiceGroupKey) {
    const userId = await getRequiredUserId();
    const { data, error } = await supabase
      .from("services")
      .select("id")
      .eq("user_id", userId)
      .eq("is_addon", groupKey === "addon")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    await Promise.all(
      ((data || []) as Array<{ id: string }>).map((service, index) =>
        supabase
          .from("services")
          .update({ sort_order: index })
          .eq("id", service.id),
      ),
    );
  }

  async function refreshVisibleData() {
    if (isReorderMode) {
      await fetchAllServices();
      return;
    }

    await fetchPagedServices("refresh");
  }

  React.useEffect(() => {
    if (!isAddOpen) {
      setAddIsAddon(false);
      setAddAffectsSchedule(true);
      setAddCityCodes([]);
      setAddColorInput(profileBrandColor);
    }
  }, [isAddOpen, profileBrandColor]);

  async function persistNormalizedGroup(
    groupKey: ServiceGroupKey,
    nextGroup: Service[],
    sourceServices: Service[] = services,
  ) {
    const previousServices = sourceServices;
    const normalizedGroup = normalizeServiceOrder(nextGroup);
    const optimisticServices = reorderGroup(previousServices, groupKey, normalizedGroup);

    setPageError("");
    setSavingOrderGroup(groupKey);
    setServices(optimisticServices);

    const results = await Promise.all(
      normalizedGroup.map((service) =>
        supabase
          .from("services")
          .update({ sort_order: service.sort_order })
          .eq("id", service.id),
      ),
    );

    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) {
      setServices(previousServices);
      setPageError(failedResult.error.message);
    } else {
      await refreshVisibleData();
    }

    setSavingOrderGroup(null);
  }

  async function handleAdd(formData: FormData) {
    const userId = await getRequiredUserId();

    const isAddon = formData.get("is_addon") === "on";
    const isPublic = formData.get("is_public") === "on";
    const affectsSchedule = !isAddon || formData.get("affects_schedule") === "on";
    const cityCodes = getCityCodesFromFormData(formData);
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_addon", isAddon);
    const nextSortOrder = count || 0;

    const { data, error } = await supabase
      .from("services")
      .insert({
        user_id: userId,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || null,
        color: resolveHexColor(
          formData.get("color"),
          profileBrandColor,
          "#000000",
        ),
        price: parseFloat(formData.get("price") as string) || 0,
        original_price: parseFloat(formData.get("original_price") as string) || null,
        duration_minutes:
          parseInt((formData.get("duration_hours") as string) || "0", 10) * 60 +
          parseInt((formData.get("duration_mins") as string) || "0", 10),
        is_active: true,
        is_addon: isAddon,
        is_public: isPublic,
        affects_schedule: affectsSchedule,
        sort_order: nextSortOrder,
        event_types:
          formData.getAll("event_types").length > 0
            ? (formData.getAll("event_types") as string[])
            : null,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setPageError(error?.message || "Gagal menambahkan paket.");
      return;
    }

    try {
      await syncServiceCityScopes({
        userId,
        serviceId: data.id,
        cityCodes,
      });
      setIsAddOpen(false);
      await refreshVisibleData();
      showSuccessToast(ts("serviceCreatedSuccess"));
    } catch (scopeError) {
      setPageError(
        scopeError instanceof Error
          ? scopeError.message
          : "Gagal menyimpan scope kota/kabupaten paket.",
      );
    }
  }

  async function handleEdit(formData: FormData) {
    if (isUpdatingService || !editingService) return;

    setIsUpdatingService(true);
    try {
      const userId = await getRequiredUserId();
      const nextIsAddon = formData.get("is_addon") === "on";
      const nextIsPublic = formData.get("is_public") === "on";
      const nextAffectsSchedule =
        !nextIsAddon || formData.get("affects_schedule") === "on";
      const cityCodes = getCityCodesFromFormData(formData);
      const previousGroupKey = getServiceGroupKey(editingService);
      const nextGroupKey: ServiceGroupKey = nextIsAddon ? "addon" : "main";
      const nextSortOrder =
        previousGroupKey === nextGroupKey
          ? editingService.sort_order
          : (
              await supabase
                .from("services")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("is_addon", nextIsAddon)
            ).count || 0;

      const { error } = await supabase
        .from("services")
        .update({
          name: formData.get("name") as string,
          description: (formData.get("description") as string) || null,
          color: resolveHexColor(
            formData.get("color"),
            editingService.color,
            profileBrandColor,
          ),
          price: parseFloat(formData.get("price") as string) || 0,
          original_price: parseFloat(formData.get("original_price") as string) || null,
          duration_minutes:
            parseInt((formData.get("duration_hours") as string) || "0", 10) * 60 +
            parseInt((formData.get("duration_mins") as string) || "0", 10),
          is_addon: nextIsAddon,
          is_public: nextIsPublic,
          affects_schedule: nextAffectsSchedule,
          sort_order: nextSortOrder,
          event_types:
            formData.getAll("event_types").length > 0
              ? (formData.getAll("event_types") as string[])
              : null,
        })
        .eq("id", editingService.id);

      if (error) {
        setPageError(error.message);
        return;
      }

      try {
        await syncServiceCityScopes({
          userId,
          serviceId: editingService.id,
          cityCodes,
        });
      } catch (scopeError) {
        setPageError(
          scopeError instanceof Error
            ? scopeError.message
            : "Gagal menyimpan scope kota/kabupaten paket.",
        );
        return;
      }

      if (previousGroupKey !== nextGroupKey) {
        await normalizeGroupAfterMutation(previousGroupKey);
      }

      setIsEditOpen(false);
      setEditingService(null);
      await refreshVisibleData();
      showSuccessToast(ts("serviceUpdatedSuccess"));
    } finally {
      setIsUpdatingService(false);
    }
  }

  async function handleToggleActive(service: Service) {
    const { error } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);

    if (error) {
      setPageError(error.message);
      return;
    }

    await refreshVisibleData();
  }

  async function handleTogglePublic(service: Service) {
    const { error } = await supabase
      .from("services")
      .update({ is_public: service.is_public === false })
      .eq("id", service.id);

    if (error) {
      setPageError(error.message);
      return;
    }

    await refreshVisibleData();
  }

  function openEditDialog(service: Service) {
    setEditingService(service);
    setEditIsAddon(service.is_addon);
    setEditAffectsSchedule(service.affects_schedule !== false);
    setEditCityCodes(serviceCityCodesByServiceId[service.id] || []);
    setEditColorInput(resolveHexColor(service.color, profileBrandColor));
    setIsEditOpen(true);
  }

  React.useEffect(() => {
    if (!editingService || !isEditOpen) return;
    setEditCityCodes(serviceCityCodesByServiceId[editingService.id] || []);
  }, [editingService, isEditOpen, serviceCityCodesByServiceId]);

  function handleDelete(id: string) {
    const currentService = services.find((service) => service.id === id);
    if (!currentService) return;
    setDeleteConfirmDialog({ open: true, service: currentService });
  }

  async function confirmDeleteService() {
    const currentService = deleteConfirmDialog.service;
    if (!currentService) return;
    setDeleteConfirmDialog({ open: false, service: null });

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", currentService.id);
    if (error) {
      setPageError(error.message);
      return;
    }

    await normalizeGroupAfterMutation(getServiceGroupKey(currentService));
    await refreshVisibleData();
  }

  async function handleMove(service: Service, direction: "up" | "down") {
    let orderedServices = services;
    if (orderedServices.length === 0) {
      try {
        orderedServices = await hydrateServiceOrderSnapshot();
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Failed to load services order.",
        );
        return;
      }
    }

    const groupKey = getServiceGroupKey(service);
    const group = splitServicesByGroup(orderedServices)[groupKey];
    const currentIndex = group.findIndex((item) => item.id === service.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= group.length) return;

    await persistNormalizedGroup(
      groupKey,
      arrayMove(group, currentIndex, nextIndex),
      orderedServices,
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const [activeGroupKey, activeServiceId] = activeId.split(":") as [
      ServiceGroupKey,
      string,
    ];
    const [overGroupKey, overServiceId] = overId.split(":") as [
      ServiceGroupKey,
      string,
    ];

    if (activeGroupKey !== overGroupKey) return;

    const group = splitServicesByGroup(services)[activeGroupKey];
    const oldIndex = group.findIndex((service) => service.id === activeServiceId);
    const newIndex = group.findIndex((service) => service.id === overServiceId);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    await persistNormalizedGroup(activeGroupKey, arrayMove(group, oldIndex, newIndex));
  }

  const activeDragService = React.useMemo(() => {
    if (!activeDragId) return null;
    const [, serviceId] = activeDragId.split(":");
    return services.find((service) => service.id === serviceId) ?? null;
  }, [activeDragId, services]);

  const formatCurrency = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(value),
    [],
  );

  const formatDuration = React.useCallback(
    (service: Service) => {
      if (!service.duration_minutes) return null;
      if (service.duration_minutes >= 60) {
        const hours = Math.floor(service.duration_minutes / 60);
        const minutes = service.duration_minutes % 60;
        return `${hours} ${ts("hourShort")}${minutes ? ` ${minutes} ${ts("minuteShort")}` : ""}`;
      }

      return `${service.duration_minutes} ${ts("minuteShort")}`;
    },
    [ts],
  );

  const cityDisplayNameByCode = React.useMemo(() => {
    const map: Record<string, string> = {};
    cityOptions.forEach((city) => {
      const cityCode = normalizeCityCode(city.city_code);
      if (!cityCode) return;
      map[cityCode] = buildCityDisplayName(city);
    });
    return map;
  }, [cityOptions]);

  const cityScopeSummaryByServiceId = React.useMemo(() => {
    const summaryMap: Record<string, ServiceCityScopeSummary> = {};

    Object.entries(serviceCityCodesByServiceId).forEach(([serviceId, cityCodes]) => {
      const normalizedCityCodes = Array.from(
        new Set(cityCodes.map((code) => normalizeCityCode(code)).filter(Boolean)),
      );

      if (normalizedCityCodes.length === 0) {
        return;
      }

      const labels = normalizedCityCodes.map(
        (cityCode) => cityDisplayNameByCode[cityCode] || `Kode ${cityCode}`,
      );

      summaryMap[serviceId] = {
        isAllCities: false,
        visibleLabels: labels.slice(0, 2),
        hiddenCount: Math.max(0, labels.length - 2),
      };
    });

    return summaryMap;
  }, [cityDisplayNameByCode, serviceCityCodesByServiceId]);

  React.useEffect(() => {
    setMainPage(1);
    setAddonPage(1);
  }, [searchQuery, selectedEventFilter]);

  const usedEventTypes = React.useMemo(() => {
    const set = new Set<string>(usedEventTypeOptions);
    return eventTypeOptions.filter(
      (eventType) =>
        isShowAllPackagesEventType(eventType) || set.has(eventType),
    );
  }, [eventTypeOptions, usedEventTypeOptions]);
  const eventFilterOptions = React.useMemo(
    () => [
      { value: "", label: ts("allCategories") },
      ...usedEventTypes.map((eventType) => ({ value: eventType, label: eventType })),
    ],
    [ts, usedEventTypes],
  );

  const groupedServices = React.useMemo(() => splitServicesByGroup(services), [services]);
  const displayedMainServices = isReorderMode
    ? groupedServices.main
    : mainServices;
  const displayedAddonServices = isReorderMode
    ? groupedServices.addon
    : addonServices;

  const reorderSaving = savingOrderGroup !== null;
  const mainQueryState = React.useMemo<PaginatedQueryState>(() => ({
    page: mainPage,
    perPage: itemsPerPage,
    totalItems: isReorderMode ? groupedServices.main.length : mainTotalItems,
    isLoading: loading,
    isRefreshing: refreshing,
  }), [groupedServices.main.length, isReorderMode, itemsPerPage, loading, mainPage, mainTotalItems, refreshing]);
  const addonQueryState = React.useMemo<PaginatedQueryState>(() => ({
    page: addonPage,
    perPage: itemsPerPage,
    totalItems: isReorderMode ? groupedServices.addon.length : addonTotalItems,
    isLoading: loading,
    isRefreshing: refreshing,
  }), [addonPage, addonTotalItems, groupedServices.addon.length, isReorderMode, itemsPerPage, loading, refreshing]);

  return (
    <div className="space-y-6">
      <PageHeader
        actionsClassName={PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME}
        actions={
          <>
            <Button
              type="button"
              variant={isReorderMode ? "default" : "outline"}
              className="w-full lg:w-auto"
              onClick={() => {
                setIsReorderMode((current) => !current);
                setPageError("");
              }}
              disabled={loading || !hasAnyServices || reorderSaving}
            >
              {reorderSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoveVertical className="h-4 w-4" />
              )}
              {isReorderMode ? ts("finishReorder") : ts("reorderPackages")}
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="w-full lg:w-auto">
                  <Plus className="h-4 w-4" /> {t("tambah")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[680px]">
              <DialogHeader>
                <DialogTitle>{t("tambahTitle")}</DialogTitle>
                <DialogDescription>{t("tambahDesc")}</DialogDescription>
              </DialogHeader>
              <form action={(fd) => handleAdd(fd)} className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("namaLayanan")}</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g.: Wedding Photography"
                    className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("deskripsi")}</label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder={ts("descPlaceholder")}
                    className="placeholder:text-muted-foreground w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warna Paket</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={resolveHexColor(addColorInput, profileBrandColor)}
                      onChange={(event) => setAddColorInput(event.target.value)}
                      className="h-10 w-10 rounded-lg border p-0.5 cursor-pointer"
                    />
                    <input
                      name="color"
                      value={addColorInput}
                      onChange={(event) => setAddColorInput(event.target.value)}
                      placeholder="#000000"
                      className="placeholder:text-muted-foreground h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                    />
                    <div
                      className="h-9 w-24 rounded-md border"
                      style={{
                        backgroundColor: resolveHexColor(addColorInput, profileBrandColor),
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("harga")}</label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="1000"
                    required
                    placeholder="2500000"
                    className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Harga Coret{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (opsional)
                    </span>
                  </label>
                  <input
                    name="original_price"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="3500000"
                    className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ts("duration")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      name="duration_hours"
                      type="number"
                      min="0"
                      max="24"
                      defaultValue={2}
                      placeholder="0"
                      className="placeholder:text-muted-foreground h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                    />
                    <span className="text-sm text-muted-foreground">{ts("hours")}</span>
                    <input
                      name="duration_mins"
                      type="number"
                      min="0"
                      max="59"
                      step="5"
                      defaultValue={0}
                      placeholder="0"
                      className="placeholder:text-muted-foreground h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                    />
                    <span className="text-sm text-muted-foreground">{ts("minutes")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_addon"
                    id="add_is_addon"
                    checked={addIsAddon}
                    onChange={(event) => setAddIsAddon(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <label
                    htmlFor="add_is_addon"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Paket Add-on
                  </label>
                  <span className="text-xs text-muted-foreground">
                    (tambahan, bukan paket utama)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_public"
                    id="add_is_public"
                    defaultChecked
                    className="h-4 w-4 accent-primary"
                  />
                  <label
                    htmlFor="add_is_public"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Tampilkan di form publik
                  </label>
                  <span className="text-xs text-muted-foreground">
                    (jika mati, hanya bisa dipilih dari booking admin)
                  </span>
                </div>
                {addIsAddon ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="affects_schedule"
                      id="add_affects_schedule"
                      checked={addAffectsSchedule}
                      onChange={(event) =>
                        setAddAffectsSchedule(event.target.checked)
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <label
                      htmlFor="add_affects_schedule"
                      className="cursor-pointer text-sm font-medium"
                    >
                      {ts("affectsSchedule")}
                    </label>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipe Acara</label>
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Kosongkan jika paket ini untuk semua tipe acara.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {eventTypeOptions.map((eventType) => (
                      <label
                        key={eventType}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/50 has-[:checked]:border-foreground has-[:checked]:bg-foreground/5"
                      >
                        <input
                          type="checkbox"
                          name="event_types"
                          value={eventType}
                          className="h-3 w-3 accent-foreground"
                        />
                        {eventType}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kota / Kabupaten</label>
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Bisa pilih lebih dari satu. Kosongkan jika paket berlaku untuk semua kota/kabupaten.
                  </p>
                  <CityMultiSelect
                    options={cityOptions}
                    values={addCityCodes}
                    onChange={setAddCityCodes}
                    hiddenInputName="city_codes"
                    placeholder="Bebas semua kota / kabupaten"
                    searchPlaceholder="Cari kota / kabupaten..."
                    emptyText="Data kota / kabupaten tidak ditemukan."
                    mobileTitle="Kota / Kabupaten"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">{t("simpan")}</Button>
                </DialogFooter>
              </form>
              </DialogContent>
            </Dialog>
          </>
        }
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </PageHeader>

      {pageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {pageError}
        </div>
      ) : null}

      {!loading && hasAnyServices && !isReorderMode ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={ts("searchPlaceholder")}
              className="placeholder:text-muted-foreground h-10 w-full rounded-lg border border-input bg-transparent py-2 pl-9 pr-8 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <FilterSingleSelect
            value={selectedEventFilter}
            onChange={(nextValue) => setSelectedEventFilter(nextValue)}
            options={eventFilterOptions}
            placeholder={ts("allCategories")}
            className="w-full sm:w-[220px]"
            triggerClassName="h-10 rounded-lg bg-background px-3 shadow-xs"
            mobileTitle={ts("allCategories")}
          />
        </div>
      ) : null}

      {isReorderMode && services.length > 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          {ts("reorderHint")}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <CardListSkeleton count={3} withBadge />
        </div>
      ) : !hasAnyServices ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-1 text-lg font-semibold">{t("belumAda")}</h3>
          <p className="text-sm text-muted-foreground">{t("belumAdaDesc")}</p>
        </div>
      ) : !isReorderMode &&
        mainQueryState.totalItems === 0 &&
        addonQueryState.totalItems === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-1 text-lg font-semibold">{ts("noResults")}</h3>
          <p className="text-sm text-muted-foreground">{ts("noResultsDesc")}</p>
        </div>
      ) : isReorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionDivider
                title={ts("mainPackages")}
                description={ts("mainPackagesDesc")}
                count={groupedServices.main.length}
              />
              {groupedServices.main.length === 0 ? (
                <EmptySectionState
                  title={ts("emptyMainTitle")}
                  description={ts("emptyMainDesc")}
                />
              ) : (
                <SortableContext
                  items={groupedServices.main.map(buildSortableId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {groupedServices.main.map((service) => (
                      <SortableServiceRow
                        key={service.id}
                        service={service}
                        cityScopeSummary={
                          cityScopeSummaryByServiceId[service.id] ||
                          ALL_CITIES_SCOPE_SUMMARY
                        }
                        formatCurrency={formatCurrency}
                        durationLabel={formatDuration(service)}
                        fallbackColor={profileBrandColor}
                        onMoveUp={() => handleMove(service, "up")}
                        onMoveDown={() => handleMove(service, "down")}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </section>

            <section className="space-y-4">
              <SectionDivider
                title={ts("addonPackages")}
                description={ts("addonPackagesDesc")}
                count={groupedServices.addon.length}
                badge={
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                    <Layers className="h-2.5 w-2.5" /> Add-on
                  </span>
                }
              />
              {groupedServices.addon.length === 0 ? (
                <EmptySectionState
                  title={ts("emptyAddonTitle")}
                  description={ts("emptyAddonDesc")}
                />
              ) : (
                <SortableContext
                  items={groupedServices.addon.map(buildSortableId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {groupedServices.addon.map((service) => (
                      <SortableServiceRow
                        key={service.id}
                        service={service}
                        cityScopeSummary={
                          cityScopeSummaryByServiceId[service.id] ||
                          ALL_CITIES_SCOPE_SUMMARY
                        }
                        formatCurrency={formatCurrency}
                        durationLabel={formatDuration(service)}
                        fallbackColor={profileBrandColor}
                        onMoveUp={() => handleMove(service, "up")}
                        onMoveDown={() => handleMove(service, "down")}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </section>
          </div>

          <DragOverlay>
            {activeDragService ? (
              <div className="rounded-xl border bg-background px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/70" />
                  <div>
                    <div className="text-sm font-semibold">{activeDragService.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(activeDragService.price)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <SectionDivider
              title={ts("mainPackages")}
              description={ts("mainPackagesDesc")}
              count={mainQueryState.totalItems}
            />
            {mainQueryState.isLoading || mainQueryState.isRefreshing ? (
              <CardListSkeleton count={Math.min(mainQueryState.perPage, 3)} withBadge />
            ) : displayedMainServices.length === 0 ? (
              <EmptySectionState
                title={ts("emptyMainTitle")}
                description={ts("emptyMainDesc")}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayedMainServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    cityScopeSummary={
                      cityScopeSummaryByServiceId[service.id] ||
                      ALL_CITIES_SCOPE_SUMMARY
                    }
                    formatCurrency={formatCurrency}
                    durationLabel={formatDuration(service)}
                    fallbackColor={profileBrandColor}
                    onEdit={() => openEditDialog(service)}
                    onToggleActive={() => handleToggleActive(service)}
                    onTogglePublic={() => handleTogglePublic(service)}
                    onDelete={() => handleDelete(service.id)}
                    onMoveUp={() => handleMove(service, "up")}
                    onMoveDown={() => handleMove(service, "down")}
                  />
                ))}
              </div>
            )}
            {mainQueryState.totalItems > itemsPerPage ? (
              <TablePagination
                totalItems={mainQueryState.totalItems}
                currentPage={mainQueryState.page}
                itemsPerPage={mainQueryState.perPage}
                perPageOptions={[...SERVICE_PER_PAGE_OPTIONS]}
                onPageChange={setMainPage}
                onItemsPerPageChange={(value) => {
                  setItemsPerPage(value);
                  setMainPage(1);
                  setAddonPage(1);
                }}
              />
            ) : null}
          </section>

          <section className="space-y-4">
            <SectionDivider
              title={ts("addonPackages")}
              description={ts("addonPackagesDesc")}
              count={addonQueryState.totalItems}
              badge={
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                  <Layers className="h-2.5 w-2.5" /> Add-on
                </span>
              }
            />
            {addonQueryState.isLoading || addonQueryState.isRefreshing ? (
              <CardListSkeleton count={Math.min(addonQueryState.perPage, 3)} withBadge />
            ) : displayedAddonServices.length === 0 ? (
              <EmptySectionState
                title={ts("emptyAddonTitle")}
                description={ts("emptyAddonDesc")}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayedAddonServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    cityScopeSummary={
                      cityScopeSummaryByServiceId[service.id] ||
                      ALL_CITIES_SCOPE_SUMMARY
                    }
                    formatCurrency={formatCurrency}
                    durationLabel={formatDuration(service)}
                    fallbackColor={profileBrandColor}
                    onEdit={() => openEditDialog(service)}
                    onToggleActive={() => handleToggleActive(service)}
                    onTogglePublic={() => handleTogglePublic(service)}
                    onDelete={() => handleDelete(service.id)}
                    onMoveUp={() => handleMove(service, "up")}
                    onMoveDown={() => handleMove(service, "down")}
                  />
                ))}
              </div>
            )}
            {addonQueryState.totalItems > itemsPerPage ? (
              <TablePagination
                totalItems={addonQueryState.totalItems}
                currentPage={addonQueryState.page}
                itemsPerPage={addonQueryState.perPage}
                perPageOptions={[...SERVICE_PER_PAGE_OPTIONS]}
                onPageChange={setAddonPage}
                onItemsPerPageChange={(value) => {
                  setItemsPerPage(value);
                  setMainPage(1);
                  setAddonPage(1);
                }}
              />
            ) : null}
          </section>
        </div>
      )}

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingService(null);
            setEditIsAddon(false);
            setEditAffectsSchedule(true);
            setEditCityCodes([]);
            setEditColorInput(profileBrandColor);
          }
        }}
      >
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{ts("editDesc")}</DialogDescription>
          </DialogHeader>
          {editingService ? (
            <form action={(fd) => handleEdit(fd)} className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("namaLayanan")}</label>
                <input
                  name="name"
                  required
                  defaultValue={editingService.name}
                  className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("deskripsi")}</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingService.description || ""}
                  className="placeholder:text-muted-foreground w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Warna Paket</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={resolveHexColor(
                      editColorInput,
                      editingService.color,
                      profileBrandColor,
                    )}
                    onChange={(event) => setEditColorInput(event.target.value)}
                    className="h-10 w-10 rounded-lg border p-0.5 cursor-pointer"
                  />
                  <input
                    name="color"
                    value={editColorInput}
                    onChange={(event) => setEditColorInput(event.target.value)}
                    placeholder="#000000"
                    className="placeholder:text-muted-foreground h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                  <div
                    className="h-9 w-24 rounded-md border"
                    style={{
                      backgroundColor: resolveHexColor(
                        editColorInput,
                        editingService.color,
                        profileBrandColor,
                      ),
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("harga")}</label>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="1000"
                  required
                  defaultValue={editingService.price}
                  className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Harga Coret{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </label>
                <input
                  name="original_price"
                  type="number"
                  min="0"
                  step="1000"
                  defaultValue={editingService.original_price || ""}
                  className="placeholder:text-muted-foreground h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts("duration")}</label>
                <div className="flex items-center gap-2">
                  <input
                    name="duration_hours"
                    type="number"
                    min="0"
                    max="24"
                    defaultValue={Math.floor((editingService.duration_minutes || 120) / 60)}
                    className="placeholder:text-muted-foreground h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                  <span className="text-sm text-muted-foreground">{ts("hours")}</span>
                  <input
                    name="duration_mins"
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    defaultValue={(editingService.duration_minutes || 120) % 60}
                    className="placeholder:text-muted-foreground h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
                  />
                  <span className="text-sm text-muted-foreground">{ts("minutes")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_addon"
                  id="edit_is_addon"
                  checked={editIsAddon}
                  onChange={(event) => setEditIsAddon(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <label
                  htmlFor="edit_is_addon"
                  className="cursor-pointer text-sm font-medium"
                >
                  Paket Add-on
                </label>
                <span className="text-xs text-muted-foreground">
                  (tambahan, bukan paket utama)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_public"
                  id="edit_is_public"
                  defaultChecked={editingService.is_public !== false}
                  className="h-4 w-4 accent-primary"
                />
                <label
                  htmlFor="edit_is_public"
                  className="cursor-pointer text-sm font-medium"
                >
                  Tampilkan di form publik
                </label>
                <span className="text-xs text-muted-foreground">
                  (jika mati, hanya bisa dipilih dari booking admin)
                </span>
              </div>
              {editIsAddon ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="affects_schedule"
                    id="edit_affects_schedule"
                    checked={editAffectsSchedule}
                    onChange={(event) =>
                      setEditAffectsSchedule(event.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <label
                    htmlFor="edit_affects_schedule"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {ts("affectsSchedule")}
                  </label>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipe Acara</label>
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  Kosongkan jika paket ini untuk semua tipe acara.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {eventTypeOptions.map((eventType) => (
                    <label
                      key={eventType}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/50 has-[:checked]:border-foreground has-[:checked]:bg-foreground/5"
                    >
                      <input
                        type="checkbox"
                        name="event_types"
                        value={eventType}
                        defaultChecked={serviceHasEventType(editingService, eventType)}
                        className="h-3 w-3 accent-foreground"
                      />
                      {eventType}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Kota / Kabupaten</label>
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  Bisa pilih lebih dari satu. Kosongkan jika paket berlaku untuk semua kota/kabupaten.
                </p>
                <CityMultiSelect
                  options={cityOptions}
                  values={editCityCodes}
                  onChange={setEditCityCodes}
                  hiddenInputName="city_codes"
                  placeholder="Bebas semua kota / kabupaten"
                  searchPlaceholder="Cari kota / kabupaten..."
                  emptyText="Data kota / kabupaten tidak ditemukan."
                  mobileTitle="Kota / Kabupaten"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isUpdatingService}
                  className="gap-2"
                >
                  {isUpdatingService ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("perbarui")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ActionConfirmDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) =>
          setDeleteConfirmDialog((prev) => ({
            ...prev,
            open,
            service: open ? prev.service : null,
          }))
        }
        title="Konfirmasi"
        message={ts("deleteConfirm")}
        cancelLabel="Batal"
        confirmLabel="Hapus"
        confirmVariant="destructive"
        onConfirm={confirmDeleteService}
      />
      {successToastNode}
    </div>
  );
}
