export const ONBOARDING_OVERLAY_DISMISS_STORAGE_KEY =
  "clientdesk:onboarding:overlay-dismissed:v1";
export const ONBOARDING_OVERLAY_SESSION_STORAGE_KEY =
  "clientdesk:onboarding:overlay-session-dismissed:v1";
export const ONBOARDING_ACTIVE_STEP_STORAGE_KEY =
  "clientdesk:onboarding:active-step:v1";
export const ONBOARDING_ACTIVE_STEP_EVENT =
  "clientdesk:onboarding-active-step-changed";
export const ONBOARDING_REVIEW_MODAL_REQUEST_STORAGE_KEY =
  "clientdesk:onboarding:review-modal-request:v1";
export const ONBOARDING_REVIEW_MODAL_EVENT =
  "clientdesk:onboarding-review-modal-requested";
export const ONBOARDING_STEP_UNLOCK_EVENT =
  "clientdesk:onboarding-step-unlocked";
export const ONBOARDING_STEP_COMPLETION_STORAGE_PREFIX =
  "clientdesk:onboarding:completed-step:v1:";
export const ONBOARDING_STEP_COMPLETION_EVENT =
  "clientdesk:onboarding-step-completed";

export type OnboardingCoreStepId =
  | "profile"
  | "studioSettings"
  | "services"
  | "team"
  | "formBooking"
  | "bookingFirst"
  | "bookingsOverview"
  | "clientStatus";

export type OnboardingOptionalStepId = "googleCalendar" | "googleDrive";

export type OnboardingStepId = OnboardingCoreStepId | OnboardingOptionalStepId;

export type OnboardingStepKind = "core" | "optional";

export type OnboardingStepState = {
  id: OnboardingStepId;
  completed: boolean;
  href: string;
  kind: OnboardingStepKind;
};

export type DashboardOnboardingState = {
  completedCount: number;
  coreSteps: OnboardingStepState[];
  isCoreComplete: boolean;
  nextRecommendedStep: OnboardingCoreStepId | null;
  optionalSteps: OnboardingStepState[];
  shouldShowChecklist: boolean;
  totalCoreSteps: number;
};

export type OnboardingTourStep = {
  href: string;
  id: OnboardingStepId;
  kind: OnboardingStepKind;
  route: string;
  targets: string[];
  sequence?: Array<{
    id: string;
    target: string;
  }>;
};

export const CORE_ONBOARDING_STEP_ORDER: OnboardingCoreStepId[] = [
  "profile",
  "studioSettings",
  "services",
  "team",
  "formBooking",
  "bookingFirst",
  "bookingsOverview",
  "clientStatus",
];

export const OPTIONAL_ONBOARDING_STEP_ORDER: OnboardingOptionalStepId[] = [
  "googleCalendar",
  "googleDrive",
];

export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  ...CORE_ONBOARDING_STEP_ORDER,
  ...OPTIONAL_ONBOARDING_STEP_ORDER,
];

export const ONBOARDING_STEP_META: Record<OnboardingStepId, OnboardingTourStep> = {
  profile: {
    id: "profile",
    href: "/profile",
    route: "/profile",
    targets: ["profile-name-field"],
    kind: "core",
  },
  services: {
    id: "services",
    href: "/services",
    route: "/services",
    targets: [
      "services-add-dialog",
      "services-add-button",
      "services-main-package-list",
    ],
    kind: "core",
  },
  studioSettings: {
    id: "studioSettings",
    href: "/settings",
    route: "/settings",
    targets: ["settings-studio-name"],
    kind: "core",
  },
  formBooking: {
    id: "formBooking",
    href: "/form-booking",
    route: "/form-booking",
    targets: ["form-booking-payment-methods"],
    kind: "core",
  },
  bookingFirst: {
    id: "bookingFirst",
    href: "/bookings/new",
    route: "/bookings/new",
    targets: ["booking-client-info"],
    sequence: [
      {
        id: "clientInfo",
        target: "booking-client-info",
      },
      {
        id: "sessionDetails",
        target: "booking-session-details",
      },
      {
        id: "submit",
        target: "booking-submit-actions",
      },
    ],
    kind: "core",
  },
  bookingsOverview: {
    id: "bookingsOverview",
    href: "/bookings",
    route: "/bookings",
    targets: ["bookings-overview-panel"],
    kind: "core",
  },
  clientStatus: {
    id: "clientStatus",
    href: "/client-status",
    route: "/client-status",
    targets: ["client-status-table"],
    kind: "core",
  },
  team: {
    id: "team",
    href: "/team",
    route: "/team",
    targets: ["team-add-dialog", "team-add-button"],
    kind: "core",
  },
  googleCalendar: {
    id: "googleCalendar",
    href: "/settings",
    route: "/settings",
    targets: ["settings-google-calendar"],
    kind: "optional",
  },
  googleDrive: {
    id: "googleDrive",
    href: "/settings",
    route: "/settings",
    targets: ["settings-google-drive"],
    kind: "optional",
  },
};

export type OnboardingCompletionFlags = {
  bookingFirstCompleted: boolean;
  bookingsOverviewCompleted: boolean;
  clientStatusCompleted: boolean;
  formBookingCompleted: boolean;
  googleCalendarCompleted: boolean;
  googleDriveCompleted: boolean;
  profileCompleted: boolean;
  servicesCompleted: boolean;
  studioSettingsCompleted: boolean;
  teamCompleted: boolean;
};

function buildStepState(
  id: OnboardingStepId,
  completed: boolean,
): OnboardingStepState {
  const meta = ONBOARDING_STEP_META[id];
  return {
    id,
    completed,
    href: meta.href,
    kind: meta.kind,
  };
}

export function buildDashboardOnboardingState(
  flags: OnboardingCompletionFlags,
): DashboardOnboardingState {
  const coreSteps = CORE_ONBOARDING_STEP_ORDER.map((id) =>
    buildStepState(id, flags[`${id}Completed` as keyof OnboardingCompletionFlags] === true),
  );
  const optionalSteps = OPTIONAL_ONBOARDING_STEP_ORDER.map((id) =>
    buildStepState(id, flags[`${id}Completed` as keyof OnboardingCompletionFlags] === true),
  );
  const completedCount = coreSteps.filter((step) => step.completed).length;
  const nextRecommendedStep =
    (coreSteps.find((step) => !step.completed)?.id as OnboardingCoreStepId | undefined) ??
    null;

  return {
    coreSteps,
    optionalSteps,
    completedCount,
    totalCoreSteps: coreSteps.length,
    isCoreComplete: completedCount === coreSteps.length,
    nextRecommendedStep,
    shouldShowChecklist: completedCount !== coreSteps.length,
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getLocalStorage() {
  if (!isBrowser()) return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isOnboardingStepId(value: unknown): value is OnboardingStepId {
  return (
    typeof value === "string" &&
    ONBOARDING_STEP_ORDER.includes(value as OnboardingStepId)
  );
}

export function getOnboardingActiveStep(): OnboardingStepId | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  const rawValue = storage.getItem(ONBOARDING_ACTIVE_STEP_STORAGE_KEY);
  return isOnboardingStepId(rawValue) ? rawValue : null;
}

export function setOnboardingActiveStep(stepId: OnboardingStepId | null) {
  const storage = getLocalStorage();
  if (!storage) return;

  if (stepId) {
    storage.setItem(ONBOARDING_ACTIVE_STEP_STORAGE_KEY, stepId);
  } else {
    storage.removeItem(ONBOARDING_ACTIVE_STEP_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(ONBOARDING_ACTIVE_STEP_EVENT));
}

export function requestOpenOnboardingReviewModal() {
  const storage = getSessionStorage();
  storage?.setItem(ONBOARDING_REVIEW_MODAL_REQUEST_STORAGE_KEY, "true");
  window.dispatchEvent(new CustomEvent(ONBOARDING_REVIEW_MODAL_EVENT));
}

export function consumeOnboardingReviewModalRequest() {
  const storage = getSessionStorage();
  if (!storage) return false;

  const requested =
    storage.getItem(ONBOARDING_REVIEW_MODAL_REQUEST_STORAGE_KEY) === "true";

  if (requested) {
    storage.removeItem(ONBOARDING_REVIEW_MODAL_REQUEST_STORAGE_KEY);
  }

  return requested;
}

export function notifyOnboardingStepUnlocked(stepId: OnboardingStepId) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(ONBOARDING_STEP_UNLOCK_EVENT, {
      detail: { stepId },
    }),
  );
}

export function getOnboardingStepCompletionStorageKey(stepId: OnboardingStepId) {
  return `${ONBOARDING_STEP_COMPLETION_STORAGE_PREFIX}${stepId}`;
}

export function markOnboardingStepCompleted(stepId: OnboardingStepId) {
  const storage = getLocalStorage();
  if (!storage) return;

  storage.setItem(getOnboardingStepCompletionStorageKey(stepId), "true");
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_STEP_COMPLETION_EVENT, {
      detail: { stepId },
    }),
  );
}

export function isOnboardingStepCompleted(stepId: OnboardingStepId) {
  const storage = getLocalStorage();
  if (!storage) return false;

  return storage.getItem(getOnboardingStepCompletionStorageKey(stepId)) === "true";
}

export function dismissOnboardingOverlayPermanently() {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(ONBOARDING_OVERLAY_DISMISS_STORAGE_KEY, "true");
}

export function dismissOnboardingOverlayForSession() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(ONBOARDING_OVERLAY_SESSION_STORAGE_KEY, "true");
}

export function isOnboardingOverlayDismissedPermanently() {
  const storage = getLocalStorage();
  return storage?.getItem(ONBOARDING_OVERLAY_DISMISS_STORAGE_KEY) === "true";
}

export function isOnboardingOverlayDismissedForSession() {
  const storage = getSessionStorage();
  return storage?.getItem(ONBOARDING_OVERLAY_SESSION_STORAGE_KEY) === "true";
}

export function clearOnboardingOverlaySessionDismiss() {
  const storage = getSessionStorage();
  storage?.removeItem(ONBOARDING_OVERLAY_SESSION_STORAGE_KEY);
}

export function getOnboardingStepMeta(
  stepId: OnboardingStepId | null | undefined,
) {
  if (!stepId) return null;
  return ONBOARDING_STEP_META[stepId] ?? null;
}

export function getNextOnboardingStep(
  stepId: OnboardingStepId | null | undefined,
) {
  if (!stepId) return null;

  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(stepId);
  if (currentIndex < 0 || currentIndex === ONBOARDING_STEP_ORDER.length - 1) {
    return null;
  }

  return ONBOARDING_STEP_ORDER[currentIndex + 1] ?? null;
}

export function getPreviousOnboardingStep(
  stepId: OnboardingStepId | null | undefined,
) {
  if (!stepId) return null;

  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(stepId);
  if (currentIndex <= 0) {
    return null;
  }

  return ONBOARDING_STEP_ORDER[currentIndex - 1] ?? null;
}

export function isOnboardingRouteMatch(
  pathname: string,
  stepId: OnboardingStepId | null | undefined,
) {
  const meta = getOnboardingStepMeta(stepId);
  if (!meta) return false;

  return pathname === meta.route || pathname.startsWith(`${meta.route}/`);
}

export function isOnboardingGoogleStep(
  stepId: OnboardingStepId | null | undefined,
) {
  return stepId === "googleCalendar" || stepId === "googleDrive";
}
