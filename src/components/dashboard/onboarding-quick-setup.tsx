"use client";

import * as React from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  FolderKanban,
  ListOrdered,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  consumeOnboardingReviewModalRequest,
  clearOnboardingOverlaySessionDismiss,
  dismissOnboardingOverlayForSession,
  dismissOnboardingOverlayPermanently,
  getOnboardingStepMeta,
  isOnboardingStepCompleted,
  isOnboardingOverlayDismissedForSession,
  isOnboardingOverlayDismissedPermanently,
  ONBOARDING_REVIEW_MODAL_EVENT,
  ONBOARDING_STEP_COMPLETION_EVENT,
  type DashboardOnboardingState,
  type OnboardingCoreStepId,
  type OnboardingStepId,
  setOnboardingActiveStep,
} from "@/lib/onboarding";

const STEP_ICON_MAP: Record<OnboardingStepId, React.ComponentType<{ className?: string }>> = {
  profile: UserRound,
  services: BriefcaseBusiness,
  studioSettings: Building2,
  formBooking: FolderKanban,
  bookingFirst: Sparkles,
  bookingsOverview: ListOrdered,
  clientStatus: Activity,
  team: Users,
  googleCalendar: CalendarDays,
  googleDrive: FolderKanban,
};

type OnboardingQuickSetupProps = {
  onboarding: DashboardOnboardingState;
};

function applyStoredCompletion(
  onboarding: DashboardOnboardingState,
): DashboardOnboardingState {
  const localCompletionSteps = new Set<OnboardingCoreStepId>();
  if (isOnboardingStepCompleted("bookingsOverview")) {
    localCompletionSteps.add("bookingsOverview");
  }
  if (isOnboardingStepCompleted("clientStatus")) {
    localCompletionSteps.add("clientStatus");
  }

  if (localCompletionSteps.size === 0) {
    return onboarding;
  }

  const coreSteps = onboarding.coreSteps.map((step) =>
    localCompletionSteps.has(step.id as OnboardingCoreStepId)
      ? { ...step, completed: true }
      : step,
  );
  const completedCount = coreSteps.filter((step) => step.completed).length;
  const nextRecommendedStep =
    (coreSteps.find((step) => !step.completed)?.id as
      | OnboardingCoreStepId
      | undefined) ?? null;

  return {
    ...onboarding,
    coreSteps,
    completedCount,
    isCoreComplete: completedCount === onboarding.totalCoreSteps,
    nextRecommendedStep,
    shouldShowChecklist: completedCount !== onboarding.totalCoreSteps,
  };
}

function hasOtherOpenDialog() {
  const dialogs = Array.from(document.querySelectorAll("[role='dialog']"));
  return dialogs.some((dialog) => dialog.getAttribute("data-state") === "open");
}

function ProgressBar({
  completedCount,
  totalCount,
}: {
  completedCount: number;
  totalCount: number;
}) {
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  return (
    <div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ReviewSetupDialogContent({
  onboarding,
  onClose,
  onStartTour,
  onOpenTutorial,
}: {
  onboarding: DashboardOnboardingState;
  onClose: () => void;
  onStartTour: (stepId: OnboardingStepId) => void;
  onOpenTutorial: () => void;
}) {
  const t = useTranslations("Onboarding");

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t("reviewModal.title")}</DialogTitle>
        <DialogDescription>{t("reviewModal.description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2">
        <div className="rounded-xl border bg-muted/20 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {t("progressLabel", {
                  done: onboarding.completedCount,
                  total: onboarding.totalCoreSteps,
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("reviewModal.progressDescription")}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {t("progressBadge", {
                percent: Math.round(
                  (onboarding.completedCount / onboarding.totalCoreSteps) * 100,
                ),
              })}
            </span>
          </div>
          <ProgressBar
            completedCount={onboarding.completedCount}
            totalCount={onboarding.totalCoreSteps}
          />
        </div>

        <div className="space-y-3">
          {onboarding.coreSteps.map((step, index) => {
            const Icon = STEP_ICON_MAP[step.id];

            return (
              <div
                key={step.id}
                className="flex flex-col gap-3 rounded-xl border bg-muted/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {index + 1}. {t(`steps.${step.id}.label`)}
                      </span>
                      {step.completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("done")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Circle className="h-3 w-3" />
                          {t("pending")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t(`steps.${step.id}.description`)}
                    </p>
                  </div>
                </div>
                <Button
                  variant={step.completed ? "outline" : "default"}
                  className="w-full sm:w-auto"
                  onClick={() => onStartTour(step.id)}
                >
                  {step.completed ? t("viewAgain") : t("openGuide")}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 px-4 py-4">
          <div>
            <p className="text-sm font-semibold">{t("optionalTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("optionalDescription")}
            </p>
          </div>
          <div className="grid gap-3">
            {onboarding.optionalSteps.map((step) => {
              const Icon = STEP_ICON_MAP[step.id];

              return (
                <div
                  key={step.id}
                  className="flex flex-col gap-3 rounded-xl border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {t(`steps.${step.id}.label`)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t("optionalBadge")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(`steps.${step.id}.description`)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onStartTour(step.id)}
                  >
                    {step.completed ? t("viewAgain") : t("openGuide")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onOpenTutorial}>
          {t("reviewModal.openTutorial")}
        </Button>
        <Button variant="outline" onClick={onClose}>
          {t("overlay.close")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function OnboardingQuickSetup({
  onboarding,
}: OnboardingQuickSetupProps) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [resolvedOnboarding, setResolvedOnboarding] = React.useState(() =>
    applyStoredCompletion(onboarding),
  );
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [pulseCard, setPulseCard] = React.useState(false);

  React.useEffect(() => {
    setResolvedOnboarding(applyStoredCompletion(onboarding));
  }, [onboarding]);

  React.useEffect(() => {
    const syncResolvedOnboarding = () => {
      setResolvedOnboarding(applyStoredCompletion(onboarding));
    };

    window.addEventListener("storage", syncResolvedOnboarding);
    window.addEventListener(
      ONBOARDING_STEP_COMPLETION_EVENT,
      syncResolvedOnboarding as EventListener,
    );

    return () => {
      window.removeEventListener("storage", syncResolvedOnboarding);
      window.removeEventListener(
        ONBOARDING_STEP_COMPLETION_EVENT,
        syncResolvedOnboarding as EventListener,
      );
    };
  }, [onboarding]);

  const openReviewModal = React.useCallback(() => {
    setOverlayOpen(false);
    setDontShowAgain(false);
    setReviewModalOpen(true);
  }, []);

  React.useEffect(() => {
    const syncReviewRequest = () => {
      if (!consumeOnboardingReviewModalRequest()) return;
      openReviewModal();
    };

    syncReviewRequest();
    window.addEventListener(
      ONBOARDING_REVIEW_MODAL_EVENT,
      syncReviewRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        ONBOARDING_REVIEW_MODAL_EVENT,
        syncReviewRequest as EventListener,
      );
    };
  }, [openReviewModal]);

  React.useEffect(() => {
    if (!resolvedOnboarding.shouldShowChecklist) {
      return;
    }

    if (reviewModalOpen) {
      return;
    }

    if (
      isOnboardingOverlayDismissedPermanently() ||
      isOnboardingOverlayDismissedForSession()
    ) {
      return;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;

      if (hasOtherOpenDialog()) {
        if (attempts >= 10) {
          window.clearInterval(timer);
        }
        return;
      }

      setOverlayOpen(true);
      window.clearInterval(timer);
    }, 500);

    return () => window.clearInterval(timer);
  }, [resolvedOnboarding.shouldShowChecklist, reviewModalOpen]);

  const focusChecklist = React.useCallback(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulseCard(true);
    window.setTimeout(() => setPulseCard(false), 1800);
  }, []);

  const startTour = React.useCallback(
    (stepId: OnboardingStepId) => {
      const meta = getOnboardingStepMeta(stepId);
      if (!meta) return;

      clearOnboardingOverlaySessionDismiss();
      setOnboardingActiveStep(stepId);
      router.push(meta.href);
    },
    [router],
  );

  const handleOverlayClose = React.useCallback(
    (persistPreference: boolean) => {
      if (persistPreference) {
        dismissOnboardingOverlayPermanently();
      } else {
        dismissOnboardingOverlayForSession();
      }
      setOverlayOpen(false);
    },
    [],
  );

  const handleOverlayStart = React.useCallback(() => {
    dismissOnboardingOverlayForSession();
    setOverlayOpen(false);
    focusChecklist();
  }, [focusChecklist]);

  const handleStartTourFromReview = React.useCallback(
    (stepId: OnboardingStepId) => {
      setReviewModalOpen(false);
      startTour(stepId);
    },
    [startTour],
  );

  const handleOpenTutorial = React.useCallback(() => {
    setReviewModalOpen(false);
    router.push("/tutorial");
  }, [router]);

  if (!resolvedOnboarding.shouldShowChecklist) {
    return (
      <>
        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <ReviewSetupDialogContent
            onboarding={resolvedOnboarding}
            onClose={() => setReviewModalOpen(false)}
            onStartTour={handleStartTourFromReview}
            onOpenTutorial={handleOpenTutorial}
          />
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div
        ref={cardRef}
        data-onboarding-target="dashboard-quick-setup"
        className={`rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 ${
          pulseCard ? "ring-2 ring-foreground/70 ring-offset-2" : ""
        }`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {t("badge")}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight">
                  {t("title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("description")}
                </p>
              </div>
            </div>

            <div className="min-w-full space-y-2 lg:min-w-[220px] lg:max-w-[240px]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {t("progressLabel", {
                    done: resolvedOnboarding.completedCount,
                    total: resolvedOnboarding.totalCoreSteps,
                  })}
                </p>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {t("progressBadge", {
                    percent: Math.round(
                      (resolvedOnboarding.completedCount /
                        resolvedOnboarding.totalCoreSteps) *
                        100,
                    ),
                  })}
                </span>
              </div>
              <ProgressBar
                completedCount={resolvedOnboarding.completedCount}
                totalCount={resolvedOnboarding.totalCoreSteps}
              />
              <Button
                className="w-full gap-2"
                onClick={() => {
                  if (resolvedOnboarding.nextRecommendedStep) {
                    startTour(resolvedOnboarding.nextRecommendedStep);
                  }
                }}
              >
                {t("continueSetup")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {resolvedOnboarding.coreSteps.map((step, index) => {
              const Icon = STEP_ICON_MAP[step.id];

              return (
                <div
                  key={step.id}
                  className="flex flex-col gap-3 rounded-xl border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {index + 1}. {t(`steps.${step.id}.label`)}
                        </span>
                        {step.completed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("done")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Circle className="h-3 w-3" />
                            {t("pending")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(`steps.${step.id}.description`)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={step.completed ? "outline" : "default"}
                    className="w-full sm:w-auto"
                    onClick={() => startTour(step.id)}
                  >
                    {step.completed ? t("viewAgain") : t("openGuide")}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 px-4 py-4">
            <div>
              <p className="text-sm font-semibold">{t("optionalTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("optionalDescription")}
              </p>
            </div>
            <div className="grid gap-3">
              {resolvedOnboarding.optionalSteps.map((step) => {
                const Icon = STEP_ICON_MAP[step.id];

                return (
                  <div
                    key={step.id}
                    className="flex flex-col gap-3 rounded-xl border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {t(`steps.${step.id}.label`)}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {t("optionalBadge")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t(`steps.${step.id}.description`)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => startTour(step.id)}
                    >
                      {step.completed ? t("viewAgain") : t("openGuide")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={overlayOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleOverlayClose(dontShowAgain);
            return;
          }
          setOverlayOpen(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("overlay.title")}</DialogTitle>
            <DialogDescription>{t("overlay.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {resolvedOnboarding.coreSteps.map((step, index) => {
              const Icon = STEP_ICON_MAP[step.id];

              return (
                <div
                  key={step.id}
                  className="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-3"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {index + 1}. {t(`steps.${step.id}.label`)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(`steps.${step.id}.description`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            <AppCheckbox
              id="clientdesk-onboarding-dismiss"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="clientdesk-onboarding-dismiss"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              {t("overlay.dismissForever")}
            </label>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => handleOverlayClose(dontShowAgain)}>
              {t("overlay.later")}
            </Button>
            <Button onClick={handleOverlayStart}>
              {t("overlay.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <ReviewSetupDialogContent
          onboarding={resolvedOnboarding}
          onClose={() => setReviewModalOpen(false)}
          onStartTour={handleStartTourFromReview}
          onOpenTutorial={handleOpenTutorial}
        />
      </Dialog>
    </>
  );
}
