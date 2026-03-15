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
  ToggleLeft,
  ToggleRight,
  Loader2,
  Clock,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  Layers,
  GripVertical,
  MoveVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import {
  getActiveEventTypes,
  getBuiltInEventTypes,
  normalizeEventTypeList,
} from "@/lib/event-type-config";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  is_addon: boolean;
  sort_order: number;
  created_at: string;
  event_types: string[] | null;
};

type ServiceGroupKey = "main" | "addon";

const EVENT_TYPES = getBuiltInEventTypes();

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
  formatCurrency,
  durationLabel,
  onMoveUp,
  onMoveDown,
}: {
  service: Service;
  formatCurrency: (n: number) => string;
  durationLabel: string | null;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const sortable = useSortable({ id: buildSortableId(service) });
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
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    service.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {service.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              {service.description ? (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {service.description}
                </p>
              ) : null}
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
                <span>Semua jenis acara</span>
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
  formatCurrency,
  durationLabel,
  onEdit,
  onToggleActive,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  service: Service;
  formatCurrency: (n: number) => string;
  durationLabel: string | null;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{service.name}</h3>
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
  const [loading, setLoading] = React.useState(true);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [mainPage, setMainPage] = React.useState(1);
  const [addonPage, setAddonPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedEventFilter, setSelectedEventFilter] = React.useState("");
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [savingOrderGroup, setSavingOrderGroup] =
    React.useState<ServiceGroupKey | null>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [pageError, setPageError] = React.useState("");
  const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = React.useState<{
    open: boolean;
    service: Service | null;
  }>({ open: false, service: null });

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

  const fetchServices = React.useCallback(async () => {
    setLoading(true);
    setPageError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setServices([]);
      setLoading(false);
      return;
    }

    const [servicesResult, profileResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("form_event_types, custom_event_types")
        .eq("id", user.id)
        .single(),
    ]);

    const { data, error } = servicesResult;
    const profile = profileResult.data;
    setEventTypeOptions(
      getActiveEventTypes({
        customEventTypes: normalizeEventTypeList(profile?.custom_event_types),
        activeEventTypes: profile?.form_event_types,
      }),
    );

    if (error) {
      setPageError(error.message);
      setServices([]);
    } else {
      setServices(((data || []) as Service[]).sort(compareServices));
    }

    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function persistNormalizedGroup(
    groupKey: ServiceGroupKey,
    nextGroup: Service[],
  ) {
    const previousServices = services;
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
      await fetchServices();
    }

    setSavingOrderGroup(null);
  }

  async function normalizeGroupAfterMutation(
    groupKey: ServiceGroupKey,
    sourceServices: Service[],
  ) {
    const group = splitServicesByGroup(sourceServices)[groupKey];
    const normalizedGroup = normalizeServiceOrder(group);
    await Promise.all(
      normalizedGroup.map((service) =>
        supabase
          .from("services")
          .update({ sort_order: service.sort_order })
          .eq("id", service.id),
      ),
    );
  }

  async function handleAdd(formData: FormData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isAddon = formData.get("is_addon") === "on";
    const nextSortOrder = splitServicesByGroup(services)[isAddon ? "addon" : "main"].length;

    const { error } = await supabase.from("services").insert({
      user_id: user.id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      price: parseFloat(formData.get("price") as string) || 0,
      original_price: parseFloat(formData.get("original_price") as string) || null,
      duration_minutes:
        parseInt((formData.get("duration_hours") as string) || "0", 10) * 60 +
        parseInt((formData.get("duration_mins") as string) || "0", 10),
      is_active: true,
      is_addon: isAddon,
      sort_order: nextSortOrder,
      event_types:
        formData.getAll("event_types").length > 0
          ? (formData.getAll("event_types") as string[])
          : null,
    });

    if (!error) {
      setIsAddOpen(false);
      await fetchServices();
    } else {
      setPageError(error.message);
    }
  }

  async function handleEdit(formData: FormData) {
    if (!editingService) return;

    const nextIsAddon = formData.get("is_addon") === "on";
    const previousGroupKey = getServiceGroupKey(editingService);
    const nextGroupKey: ServiceGroupKey = nextIsAddon ? "addon" : "main";
    const remainingServices = services.filter((service) => service.id !== editingService.id);
    const nextSortOrder =
      previousGroupKey === nextGroupKey
        ? editingService.sort_order
        : splitServicesByGroup(remainingServices)[nextGroupKey].length;

    const { error } = await supabase
      .from("services")
      .update({
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || null,
        price: parseFloat(formData.get("price") as string) || 0,
        original_price: parseFloat(formData.get("original_price") as string) || null,
        duration_minutes:
          parseInt((formData.get("duration_hours") as string) || "0", 10) * 60 +
          parseInt((formData.get("duration_mins") as string) || "0", 10),
        is_addon: nextIsAddon,
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

    if (previousGroupKey !== nextGroupKey) {
      await normalizeGroupAfterMutation(previousGroupKey, remainingServices);
    }

    setIsEditOpen(false);
    setEditingService(null);
    await fetchServices();
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

    await fetchServices();
  }

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

    const nextServices = services.filter(
      (service) => service.id !== currentService.id,
    );
    await normalizeGroupAfterMutation(getServiceGroupKey(currentService), nextServices);
    await fetchServices();
  }

  async function handleMove(service: Service, direction: "up" | "down") {
    const groupKey = getServiceGroupKey(service);
    const group = splitServicesByGroup(services)[groupKey];
    const currentIndex = group.findIndex((item) => item.id === service.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= group.length) return;

    await persistNormalizedGroup(groupKey, arrayMove(group, currentIndex, nextIndex));
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

  const filteredServices = React.useMemo(() => {
    let result = [...services];

    if (selectedEventFilter) {
      result = result.filter(
        (service) =>
          service.event_types && service.event_types.includes(selectedEventFilter),
      );
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (service) =>
          service.name.toLowerCase().includes(lowerQuery) ||
          (service.description || "").toLowerCase().includes(lowerQuery),
      );
    }

    return result.sort(compareServices);
  }, [searchQuery, selectedEventFilter, services]);

  React.useEffect(() => {
    setMainPage(1);
    setAddonPage(1);
  }, [searchQuery, selectedEventFilter]);

  const usedEventTypes = React.useMemo(() => {
    const set = new Set<string>();
    services.forEach((service) => service.event_types?.forEach((eventType) => set.add(eventType)));
    return eventTypeOptions.filter((eventType) => set.has(eventType));
  }, [eventTypeOptions, services]);

  const groupedServices = React.useMemo(() => splitServicesByGroup(services), [services]);
  const filteredGroupedServices = React.useMemo(
    () => splitServicesByGroup(filteredServices),
    [filteredServices],
  );

  const displayedMainServices = isReorderMode
    ? groupedServices.main
    : paginateArray(filteredGroupedServices.main, mainPage, itemsPerPage);
  const displayedAddonServices = isReorderMode
    ? groupedServices.addon
    : paginateArray(filteredGroupedServices.addon, addonPage, itemsPerPage);

  const reorderSaving = savingOrderGroup !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={isReorderMode ? "default" : "outline"}
            className="gap-2"
            onClick={() => {
              setIsReorderMode((current) => !current);
              setPageError("");
            }}
            disabled={loading || services.length === 0 || reorderSaving}
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
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> {t("tambah")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Acara</label>
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Kosongkan jika paket ini untuk semua jenis acara.
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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_addon"
                    id="add_is_addon"
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
                <DialogFooter>
                  <Button type="submit">{t("simpan")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {pageError}
        </div>
      ) : null}

      {!loading && services.length > 0 && !isReorderMode ? (
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
          <select
            value={selectedEventFilter}
            onChange={(event) => setSelectedEventFilter(event.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring cursor-pointer"
          >
            <option value="">{ts("allCategories")}</option>
            {usedEventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {isReorderMode && services.length > 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          {ts("reorderHint")}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-1 text-lg font-semibold">{t("belumAda")}</h3>
          <p className="text-sm text-muted-foreground">{t("belumAdaDesc")}</p>
        </div>
      ) : !isReorderMode &&
        filteredGroupedServices.main.length === 0 &&
        filteredGroupedServices.addon.length === 0 ? (
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
                        formatCurrency={formatCurrency}
                        durationLabel={formatDuration(service)}
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
                        formatCurrency={formatCurrency}
                        durationLabel={formatDuration(service)}
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
              count={filteredGroupedServices.main.length}
            />
            {displayedMainServices.length === 0 ? (
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
                    formatCurrency={formatCurrency}
                    durationLabel={formatDuration(service)}
                    onEdit={() => {
                      setEditingService(service);
                      setIsEditOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(service)}
                    onDelete={() => handleDelete(service.id)}
                    onMoveUp={() => handleMove(service, "up")}
                    onMoveDown={() => handleMove(service, "down")}
                  />
                ))}
              </div>
            )}
            {filteredGroupedServices.main.length > itemsPerPage ? (
              <TablePagination
                totalItems={filteredGroupedServices.main.length}
                currentPage={mainPage}
                itemsPerPage={itemsPerPage}
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
              count={filteredGroupedServices.addon.length}
              badge={
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                  <Layers className="h-2.5 w-2.5" /> Add-on
                </span>
              }
            />
            {displayedAddonServices.length === 0 ? (
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
                    formatCurrency={formatCurrency}
                    durationLabel={formatDuration(service)}
                    onEdit={() => {
                      setEditingService(service);
                      setIsEditOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(service)}
                    onDelete={() => handleDelete(service.id)}
                    onMoveUp={() => handleMove(service, "up")}
                    onMoveDown={() => handleMove(service, "down")}
                  />
                ))}
              </div>
            )}
            {filteredGroupedServices.addon.length > itemsPerPage ? (
              <TablePagination
                totalItems={filteredGroupedServices.addon.length}
                currentPage={addonPage}
                itemsPerPage={itemsPerPage}
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
          if (!open) setEditingService(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Jenis Acara</label>
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  Kosongkan jika paket ini untuk semua jenis acara.
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
                        defaultChecked={editingService.event_types?.includes(eventType)}
                        className="h-3 w-3 accent-foreground"
                      />
                      {eventType}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_addon"
                  id="edit_is_addon"
                  defaultChecked={editingService.is_addon}
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
              <DialogFooter>
                <Button type="submit">{t("perbarui")}</Button>
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
    </div>
  );
}
