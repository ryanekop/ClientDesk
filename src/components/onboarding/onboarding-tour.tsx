"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  getNextOnboardingStep,
  getOnboardingActiveStep,
  getOnboardingStepMeta,
  getPreviousOnboardingStep,
  ONBOARDING_ACTIVE_STEP_STORAGE_KEY,
  isOnboardingRouteMatch,
  ONBOARDING_ACTIVE_STEP_EVENT,
  ONBOARDING_STEP_UNLOCK_EVENT,
  setOnboardingActiveStep,
  type OnboardingStepId,
} from "@/lib/onboarding";

const TARGET_LOOKUP_RETRIES = 12;
const TARGET_SYNC_INTERVAL_MS = 250;

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();

    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

export function OnboardingTour() {
  const t = useTranslations("Onboarding");
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobileViewport();
  const [activeStep, setActiveStep] = React.useState<OnboardingStepId | null>(null);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = React.useState(false);
  const [lookupDone, setLookupDone] = React.useState(false);
  const [activeSequenceIndex, setActiveSequenceIndex] = React.useState(0);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(
    null,
  );
  const [activeTargetId, setActiveTargetId] = React.useState<string | null>(null);
  const [unlockedSteps, setUnlockedSteps] = React.useState<Set<OnboardingStepId>>(
    () => new Set(),
  );
  const activeTargetRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  const syncActiveStep = React.useCallback(() => {
    setActiveStep(getOnboardingActiveStep());
  }, []);

  React.useEffect(() => {
    syncActiveStep();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        event.key !== null &&
        event.key !== ONBOARDING_ACTIVE_STEP_STORAGE_KEY
      ) {
        return;
      }

      syncActiveStep();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(ONBOARDING_ACTIVE_STEP_EVENT, syncActiveStep);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ONBOARDING_ACTIVE_STEP_EVENT, syncActiveStep);
    };
  }, [syncActiveStep]);

  const activeMeta = getOnboardingStepMeta(activeStep);
  const routeMatches = Boolean(activeStep && isOnboardingRouteMatch(pathname, activeStep));
  const activeSequence = activeMeta?.sequence ?? null;
  const activeSequenceStep =
    activeSequence && activeSequence.length > 0
      ? activeSequence[Math.min(activeSequenceIndex, activeSequence.length - 1)] ?? null
      : null;
  const sequenceStepId = activeSequenceStep?.id;
  const activeTargetIds = React.useMemo(
    () =>
      activeSequenceStep
        ? [activeSequenceStep.target]
        : (activeMeta?.targets ?? []),
    [activeMeta?.targets, activeSequenceStep],
  );

  React.useEffect(() => {
    setActiveSequenceIndex(0);
  }, [activeStep]);

  React.useEffect(() => {
    activeTargetRef.current = null;
  }, [activeSequenceStep?.id]);

  React.useEffect(() => {
    const handleUnlocked = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: OnboardingStepId }>).detail;
      const stepId = detail?.stepId;
      if (!stepId) return;

      setUnlockedSteps((current) => {
        const next = new Set(current);
        next.add(stepId);
        return next;
      });
    };

    window.addEventListener(
      ONBOARDING_STEP_UNLOCK_EVENT,
      handleUnlocked as EventListener,
    );

    return () => {
      window.removeEventListener(
        ONBOARDING_STEP_UNLOCK_EVENT,
        handleUnlocked as EventListener,
      );
    };
  }, []);

  React.useEffect(() => {
    if (!activeMeta || !routeMatches) {
      activeTargetRef.current = null;
      setActiveTargetId(null);
      setTargetFound(false);
      setTargetRect(null);
      setLookupDone(false);
      return;
    }

    let cancelled = false;
    let retries = 0;
    let intervalId: number | null = null;
    let mutationObserver: MutationObserver | null = null;

    const resolveTarget = () => {
      for (const targetId of activeTargetIds) {
        const target = document.querySelector<HTMLElement>(
          `[data-onboarding-target~="${targetId}"]`,
        );
        if (target) {
          return { target, targetId };
        }
      }

      return null;
    };

    const syncTarget = (shouldScroll = false) => {
      if (cancelled) return;

      const resolved = resolveTarget();

      if (resolved) {
        const { target, targetId } = resolved;
        const targetChanged = activeTargetRef.current !== targetId;
        retries = 0;
        activeTargetRef.current = targetId;
        setActiveTargetId(targetId);

        if (shouldScroll || targetChanged) {
          target.scrollIntoView({
            behavior: "smooth",
            block: isMobile ? "center" : "nearest",
            inline: "nearest",
          });
        }

        const nextRect = target.getBoundingClientRect();
        setTargetRect(nextRect);
        setTargetFound(true);
        setLookupDone(true);
        return;
      }

      const hadPreviousTarget = activeTargetRef.current !== null;
      activeTargetRef.current = null;
      setActiveTargetId(null);
      setTargetFound(false);
      setTargetRect(null);
      if (hadPreviousTarget) {
        retries = 0;
        setLookupDone(false);
        return;
      }

      retries += 1;
      if (retries >= TARGET_LOOKUP_RETRIES) {
        setLookupDone(true);
        return;
      }
    };

    setTargetFound(false);
    setTargetRect(null);
    setLookupDone(false);
    activeTargetRef.current = null;
    syncTarget(true);

    intervalId = window.setInterval(() => syncTarget(), TARGET_SYNC_INTERVAL_MS);
    mutationObserver = new MutationObserver(() => syncTarget());
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelled = true;
      activeTargetRef.current = null;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      mutationObserver?.disconnect();
    };
  }, [activeMeta, activeTargetIds, isMobile, routeMatches]);

  React.useEffect(() => {
    if (!activeMeta || !routeMatches || !targetFound) return;

    const updateRect = () => {
      const activeTargetId = activeTargetRef.current;
      if (!activeTargetId) {
        setTargetFound(false);
        setTargetRect(null);
        setActiveTargetId(null);
        return;
      }

      const target = document.querySelector<HTMLElement>(
        `[data-onboarding-target~="${activeTargetId}"]`,
      );
      if (!target) {
        activeTargetRef.current = null;
        setTargetFound(false);
        setTargetRect(null);
        setActiveTargetId(null);
        return;
      }

      setTargetRect(target.getBoundingClientRect());
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeMeta, routeMatches, targetFound]);

  const navigateToStep = React.useCallback(
    (stepId: OnboardingStepId | null) => {
      if (!stepId) {
        setOnboardingActiveStep(null);
        return;
      }

      const meta = getOnboardingStepMeta(stepId);
      if (!meta) return;

      setOnboardingActiveStep(stepId);
      if (!isOnboardingRouteMatch(pathname, stepId)) {
        router.push(meta.href);
      }
    },
    [pathname, router],
  );

  const goToPrevious = React.useCallback(() => {
    if (activeSequence && activeSequence.length > 0 && activeSequenceIndex > 0) {
      setActiveSequenceIndex((current) => Math.max(0, current - 1));
      return;
    }

    navigateToStep(getPreviousOnboardingStep(activeStep));
  }, [activeSequence, activeSequenceIndex, activeStep, navigateToStep]);

  const goToNext = React.useCallback(() => {
    if (
      activeSequence &&
      activeSequence.length > 0 &&
      activeSequenceIndex < activeSequence.length - 1
    ) {
      setActiveSequenceIndex((current) =>
        Math.min(activeSequence.length - 1, current + 1),
      );
      return;
    }

    navigateToStep(getNextOnboardingStep(activeStep));
  }, [activeSequence, activeSequenceIndex, activeStep, navigateToStep]);

  const handleSkip = React.useCallback(() => {
    setOnboardingActiveStep(null);
  }, []);

  const stepHasCompletionMarker = React.useMemo(() => {
    if (activeStep === "services") {
      return Boolean(
        document.querySelector('[data-onboarding-target~="services-main-package-list"]'),
      );
    }

    if (activeStep === "team") {
      return Boolean(
        document.querySelector('[data-onboarding-target~="team-members-list"]'),
      );
    }

    return false;
  }, [activeStep, targetFound, targetRect, activeTargetId]);

  const isSaveBlockedStep = activeStep === "services" || activeStep === "team";
  const isDialogTargetActive =
    activeTargetId === "services-add-dialog" || activeTargetId === "team-add-dialog";
  const isStepUnlocked =
    (activeStep ? unlockedSteps.has(activeStep) : false) || stepHasCompletionMarker;
  const isNextBlocked = Boolean(
    isSaveBlockedStep && (!isStepUnlocked || isDialogTargetActive),
  );

  if (!activeMeta || !routeMatches || !portalContainer) {
    return null;
  }

  const title = sequenceStepId
    ? t(`steps.${activeMeta.id}.sequence.${sequenceStepId}.tourTitle`)
    : t(`steps.${activeMeta.id}.tourTitle`);
  const body = sequenceStepId
    ? t(`steps.${activeMeta.id}.sequence.${sequenceStepId}.tourBody`)
    : t(`steps.${activeMeta.id}.tourBody`);
  const action = sequenceStepId
    ? t(`steps.${activeMeta.id}.sequence.${sequenceStepId}.tourAction`)
    : t(`steps.${activeMeta.id}.tourAction`);
  const blockingMessage = isSaveBlockedStep
    ? t(`steps.${activeMeta.id}.blockingMessage`)
    : null;
  const previousStep = getPreviousOnboardingStep(activeStep);
  const nextStep = getNextOnboardingStep(activeStep);
  const previousDisabled = !previousStep && (!activeSequence || activeSequenceIndex === 0);
  const isLastSequenceStep =
    !activeSequence || activeSequenceIndex === activeSequence.length - 1;

  return createPortal(
    <>
      {targetFound && targetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[120] rounded-2xl border-2 border-background shadow-[0_0_0_9999px_rgba(2,6,23,0.52)] transition-all duration-200"
          style={{
            top: Math.max(8, targetRect.top - 8),
            left: Math.max(8, targetRect.left - 8),
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      ) : null}

      <div
        className={`pointer-events-none fixed z-[121] ${
          isMobile
            ? "inset-x-3 bottom-3"
            : "bottom-6 right-6 w-full max-w-sm"
        }`}
      >
        <div className="pointer-events-auto rounded-2xl border bg-background/98 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {t("tourLabel")}
              </div>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("skip")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-sm text-foreground/90">{body}</p>
            <p className="text-sm text-muted-foreground">{action}</p>
            {!targetFound && lookupDone ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {t("fallbackMessage")}
              </div>
            ) : null}
            {isNextBlocked && blockingMessage ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                {blockingMessage}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={previousDisabled}
                onClick={goToPrevious}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t("back")}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                {t("skip")}
              </Button>
            </div>

            <Button size="sm" onClick={goToNext} disabled={isNextBlocked}>
              {nextStep || !isLastSequenceStep ? t("next") : t("finish")}
              {nextStep || !isLastSequenceStep ? (
                <ArrowRight className="ml-1 h-4 w-4" />
              ) : null}
            </Button>
          </div>
        </div>
      </div>
    </>,
    portalContainer,
  );
}
