"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useLocale } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { getActiveEventTypes, normalizeEventTypeList } from "@/lib/event-type-config";
import { useSuccessToast } from "@/components/ui/success-toast";
import {
  normalizeBookingSpecialLinkRule,
  normalizeUuidList,
  toNonNegativeMoney,
  type BookingSpecialLinkRule,
} from "@/lib/booking-special-offer";

type ServiceOption = {
  id: string;
  name: string;
  price: number;
  is_addon: boolean;
  sort_order?: number | null;
  created_at?: string | null;
};

type ProfileEventTypeRow = {
  id: string;
  vendor_slug: string | null;
  form_event_types?: string[] | null;
  custom_event_types?: string[] | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

function compareServices(a: ServiceOption, b: ServiceOption) {
  const aSort =
    typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
  const bSort =
    typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
  if (aSort !== bSort) return aSort - bSort;
  const aCreated = a.created_at || "";
  const bCreated = b.created_at || "";
  if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
  return a.name.localeCompare(b.name);
}

export default function SpecialBookingFormPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const locale = useLocale();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null,
  );
  const [profileId, setProfileId] = React.useState("");
  const [vendorSlug, setVendorSlug] = React.useState("");
  const [availableEventTypes, setAvailableEventTypes] = React.useState<string[]>([]);
  const [links, setLinks] = React.useState<BookingSpecialLinkRule[]>([]);
  const [services, setServices] = React.useState<ServiceOption[]>([]);
  const [formError, setFormError] = React.useState("");
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = React.useState<{
    open: boolean;
    link: BookingSpecialLinkRule | null;
  }>({ open: false, link: null });

  const [name, setName] = React.useState("");
  const [eventTypeLocked, setEventTypeLocked] = React.useState(false);
  const [packageLocked, setPackageLocked] = React.useState(false);
  const [addonLocked, setAddonLocked] = React.useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(
    [],
  );
  const [selectedPackageIds, setSelectedPackageIds] = React.useState<string[]>(
    [],
  );
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
  const [accommodationFeeInput, setAccommodationFeeInput] = React.useState("0");
  const [discountAmountInput, setDiscountAmountInput] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const { showSuccessToast, successToastNode } = useSuccessToast();

  const packageOptions = React.useMemo(
    () => [...services].filter((item) => !item.is_addon).sort(compareServices),
    [services],
  );
  const addonOptions = React.useMemo(
    () => [...services].filter((item) => item.is_addon).sort(compareServices),
    [services],
  );

  const clearMessage = React.useCallback(() => {
    setFormError("");
  }, []);

  const resetForm = React.useCallback(() => {
    setEditingLinkId(null);
    setName("");
    setEventTypeLocked(false);
    setPackageLocked(false);
    setAddonLocked(false);
    setSelectedEventTypes([]);
    setSelectedPackageIds([]);
    setSelectedAddonIds([]);
    setAccommodationFeeInput("0");
    setDiscountAmountInput("0");
    setIsActive(true);
  }, []);

  const loadData = React.useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setFormError("Sesi login tidak ditemukan.");
      return;
    }

    const [{ data: profile, error: profileError }, { data: serviceRows, error: serviceError }, { data: linkRows, error: linkError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, vendor_slug, form_event_types, custom_event_types")
          .eq("id", user.id)
          .single(),
        supabase
          .from("services")
          .select("id, name, price, is_addon, sort_order, created_at")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .eq("is_public", true),
        supabase
          .from("booking_special_links")
          .select(
            "id, token, user_id, name, event_type_locked, event_types, package_locked, package_service_ids, addon_locked, addon_service_ids, accommodation_fee, discount_amount, is_active, consumed_at, consumed_booking_id, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    if (profileError || !profile) {
      setLoading(false);
      setFormError(profileError?.message || "Gagal memuat profil.");
      return;
    }
    if (serviceError) {
      setLoading(false);
      setFormError(serviceError.message || "Gagal memuat layanan.");
      return;
    }
    if (linkError) {
      setLoading(false);
      setFormError(linkError.message || "Gagal memuat link booking khusus.");
      return;
    }

    const profileData = profile as ProfileEventTypeRow;
    setProfileId(profileData.id);
    setVendorSlug(
      typeof profileData.vendor_slug === "string" ? profileData.vendor_slug : "",
    );
    setAvailableEventTypes(
      getActiveEventTypes({
        customEventTypes: normalizeEventTypeList(profileData.custom_event_types),
        activeEventTypes: profileData.form_event_types,
      }),
    );
    setServices(
      (serviceRows || []) as ServiceOption[],
    );
    setLinks(
      (linkRows || [])
        .map((row: unknown) => normalizeBookingSpecialLinkRule(row))
        .filter((row: BookingSpecialLinkRule | null): row is BookingSpecialLinkRule => Boolean(row)),
    );
    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  function togglePackageSelection(serviceId: string) {
    setSelectedPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return Array.from(next);
    });
  }

  function toggleAddonSelection(serviceId: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return Array.from(next);
    });
  }

  function toggleEventTypeSelection(eventTypeName: string) {
    setSelectedEventTypes((prev) => {
      const normalized = eventTypeName.trim();
      if (!normalized) return prev;
      const next = new Set(prev);
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      return Array.from(next);
    });
  }

  function editLink(link: BookingSpecialLinkRule) {
    clearMessage();
    setEditingLinkId(link.id);
    setName(link.name || "");
    setEventTypeLocked(link.eventTypeLocked);
    setPackageLocked(link.packageLocked);
    setAddonLocked(link.addonLocked);
    setSelectedEventTypes(link.eventTypes);
    setSelectedPackageIds(link.packageServiceIds);
    setSelectedAddonIds(link.addonServiceIds);
    setAccommodationFeeInput(String(Math.round(link.accommodationFee || 0)));
    setDiscountAmountInput(String(Math.round(link.discountAmount || 0)));
    setIsActive(link.isActive);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessage();

    if (!profileId) {
      setFormError("Profil admin belum siap.");
      return;
    }

    const normalizedName = name.trim() || "Special Booking";
    const normalizedEventTypes = normalizeEventTypeList(selectedEventTypes).filter(
      (item) => availableEventTypes.includes(item),
    );
    const normalizedPackageIds = normalizeUuidList(selectedPackageIds).filter((id) =>
      packageOptions.some((service) => service.id === id),
    );
    const normalizedAddonIds = normalizeUuidList(selectedAddonIds).filter((id) =>
      addonOptions.some((service) => service.id === id),
    );
    const accommodationFee = Math.round(
      toNonNegativeMoney(accommodationFeeInput),
    );
    const discountAmount = Math.round(toNonNegativeMoney(discountAmountInput));

    if (eventTypeLocked && normalizedEventTypes.length === 0) {
      setFormError("Saat Jenis Acara dikunci, pilih minimal satu jenis acara.");
      return;
    }
    if (packageLocked && normalizedPackageIds.length === 0) {
      setFormError("Saat Paket dikunci, pilih minimal satu paket.");
      return;
    }
    if (addonLocked && normalizedAddonIds.length === 0) {
      setFormError("Saat Add-on dikunci, pilih minimal satu add-on.");
      return;
    }

    setSaving(true);
    if (editingLinkId) {
      const { error } = await supabase
        .from("booking_special_links")
        .update({
          name: normalizedName,
          event_type_locked: eventTypeLocked,
          event_types: normalizedEventTypes,
          package_locked: packageLocked,
          package_service_ids: normalizedPackageIds,
          addon_locked: addonLocked,
          addon_service_ids: normalizedAddonIds,
          accommodation_fee: accommodationFee,
          discount_amount: discountAmount,
          is_active: isActive,
        })
        .eq("id", editingLinkId)
        .eq("user_id", profileId);

      setSaving(false);
      if (error) {
        setFormError(error.message || "Gagal menyimpan perubahan.");
        return;
      }

      resetForm();
      await loadData();
      showSuccessToast("Perubahan link berhasil disimpan.");
      return;
    }

    const { error } = await supabase.from("booking_special_links").insert({
      user_id: profileId,
      name: normalizedName,
      event_type_locked: eventTypeLocked,
      event_types: normalizedEventTypes,
      package_locked: packageLocked,
      package_service_ids: normalizedPackageIds,
      addon_locked: addonLocked,
      addon_service_ids: normalizedAddonIds,
      accommodation_fee: accommodationFee,
      discount_amount: discountAmount,
      is_active: isActive,
    });

    setSaving(false);
    if (error) {
      setFormError(error.message || "Gagal membuat link.");
      return;
    }

    resetForm();
    await loadData();
    showSuccessToast("Link booking khusus berhasil dibuat.");
  }

  function buildPublicOfferUrl(link: BookingSpecialLinkRule) {
    if (typeof window === "undefined") return null;
    if (!vendorSlug) return null;
    return `${window.location.origin}/${locale}/formbooking/${vendorSlug}?offer=${encodeURIComponent(link.token)}`;
  }

  async function copyLink(link: BookingSpecialLinkRule) {
    clearMessage();
    const url = buildPublicOfferUrl(link);
    if (!url) {
      setFormError("Vendor slug belum tersedia. Cek profil dulu.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showSuccessToast("URL link berhasil disalin.");
    } catch {
      setFormError("Gagal menyalin URL link.");
    }
  }

  function openLink(link: BookingSpecialLinkRule) {
    clearMessage();
    const url = buildPublicOfferUrl(link);
    if (!url) {
      setFormError("Vendor slug belum tersedia. Cek profil dulu.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function toggleActive(link: BookingSpecialLinkRule) {
    clearMessage();
    setActionLoadingId(link.id);
    const { error } = await supabase
      .from("booking_special_links")
      .update({ is_active: !link.isActive })
      .eq("id", link.id)
      .eq("user_id", profileId);
    setActionLoadingId(null);

    if (error) {
      setFormError(error.message || "Gagal memperbarui status link.");
      return;
    }
    await loadData();
  }

  async function reenableLink(link: BookingSpecialLinkRule) {
    clearMessage();
    setActionLoadingId(link.id);
    const { error } = await supabase
      .from("booking_special_links")
      .update({
        is_active: true,
        consumed_at: null,
        consumed_booking_id: null,
      })
      .eq("id", link.id)
      .eq("user_id", profileId);
    setActionLoadingId(null);

    if (error) {
      setFormError(error.message || "Gagal mengaktifkan ulang link.");
      return;
    }
    await loadData();
  }

  async function confirmDeleteLink() {
    const link = deleteConfirmDialog.link;
    if (!link) return;
    clearMessage();
    setActionLoadingId(link.id);
    const { error } = await supabase
      .from("booking_special_links")
      .delete()
      .eq("id", link.id)
      .eq("user_id", profileId);
    setActionLoadingId(null);

    if (error) {
      setFormError(error.message || "Gagal menghapus link.");
      return;
    }
    if (editingLinkId === link.id) {
      resetForm();
    }
    await loadData();
    setDeleteConfirmDialog({ open: false, link: null });
    showSuccessToast("Link booking khusus berhasil dihapus.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successToastNode}

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Form Booking Khusus</h2>
        <p className="text-muted-foreground">
          Buat link booking khusus dengan aturan lock/unlock Paket dan Add-on,
          plus biaya akomodasi dan diskon nominal.
        </p>
      </div>

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {editingLinkId ? "Edit Link" : "Buat Link Baru"}
            </h3>
            {editingLinkId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Batal Edit
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nama Link</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Wedding Luar Kota - Klien A"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Jenis Acara</p>
                <p className="text-xs text-muted-foreground">
                  Saat lock, klien hanya bisa memilih dari whitelist ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEventTypeLocked((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${eventTypeLocked ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
              >
                {eventTypeLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Lock
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5" /> Unlock
                  </>
                )}
              </button>
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {availableEventTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada jenis acara aktif.</p>
              ) : (
                availableEventTypes.map((eventTypeName) => {
                  const selected = selectedEventTypes.includes(eventTypeName);
                  return (
                    <label
                      key={eventTypeName}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{eventTypeName}</span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleEventTypeSelection(eventTypeName)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Paket</p>
                <p className="text-xs text-muted-foreground">
                  Saat unlock, pilihan di bawah jadi prefill opsional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPackageLocked((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${packageLocked ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
              >
                {packageLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Lock
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5" /> Unlock
                  </>
                )}
              </button>
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {packageOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada paket aktif publik.</p>
              ) : (
                packageOptions.map((service) => {
                  const selected = selectedPackageIds.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{service.name}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(service.price)}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePackageSelection(service.id)}
                          className="h-4 w-4 accent-primary"
                        />
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Add-on</p>
                <p className="text-xs text-muted-foreground">
                  Saat unlock, pilihan di bawah jadi prefill opsional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddonLocked((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${addonLocked ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
              >
                {addonLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Lock
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5" /> Unlock
                  </>
                )}
              </button>
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {addonOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada add-on aktif publik.</p>
              ) : (
                addonOptions.map((service) => {
                  const selected = selectedAddonIds.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{service.name}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(service.price)}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAddonSelection(service.id)}
                          className="h-4 w-4 accent-primary"
                        />
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Biaya Akomodasi (Rp)</label>
              <input
                type="number"
                min={0}
                value={accommodationFeeInput}
                onChange={(e) => setAccommodationFeeInput(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Diskon Nominal (Rp)</label>
              <input
                type="number"
                min={0}
                value={discountAmountInput}
                onChange={(e) => setDiscountAmountInput(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Link aktif
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingLinkId ? "Simpan Perubahan" : "Buat Link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Daftar Link Booking Khusus
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              URL akan mengarah ke form booking publik yang sama, dengan token
              `offer` sesuai link.
            </p>
          </div>

          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Belum ada link booking khusus.
            </div>
          ) : (
            links.map((link) => {
              const consumed = Boolean(link.consumedAt || link.consumedBookingId);
              const isBusy = actionLoadingId === link.id;
              return (
                <div key={link.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{link.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground break-all">
                        Token: {link.token}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {link.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Nonaktif
                        </span>
                      )}
                      {consumed ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Sudah Digunakan
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>
                      Jenis Acara: {link.eventTypeLocked ? "Lock" : "Unlock"} ·{" "}
                      {link.eventTypes.length} pilihan
                    </p>
                    <p>
                      Paket: {link.packageLocked ? "Lock" : "Unlock"} ·{" "}
                      {link.packageServiceIds.length} pilihan
                    </p>
                    <p>
                      Add-on: {link.addonLocked ? "Lock" : "Unlock"} ·{" "}
                      {link.addonServiceIds.length} pilihan
                    </p>
                    <p>
                      Akomodasi {formatCurrency(link.accommodationFee)} · Diskon{" "}
                      {formatCurrency(link.discountAmount)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void copyLink(link)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy URL
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => editLink(link)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openLink(link)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka Link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void toggleActive(link)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )}
                      {link.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    {consumed ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => void reenableLink(link)}
                        disabled={isBusy}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aktifkan Ulang
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        setDeleteConfirmDialog({ open: true, link })
                      }
                      disabled={isBusy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ActionConfirmDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) =>
          setDeleteConfirmDialog((prev) => ({
            open,
            link: open ? prev.link : null,
          }))
        }
        title="Konfirmasi"
        message={`Hapus link "${deleteConfirmDialog.link?.name || ""}"?`}
        cancelLabel="Batal"
        confirmLabel="Hapus"
        confirmVariant="destructive"
        onConfirm={confirmDeleteLink}
        loading={
          Boolean(deleteConfirmDialog.link) &&
          actionLoadingId === deleteConfirmDialog.link?.id
        }
      />
    </div>
  );
}
