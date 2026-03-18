"use client";

import * as React from "react";
import { CheckCircle2, X } from "lucide-react";

type SuccessToastState = {
  message: string;
  visible: boolean;
  closing: boolean;
};

type SuccessToastOptions = {
  autoHideMs?: number;
  closeMs?: number;
};

const DEFAULT_AUTO_HIDE_MS = 2600;
const DEFAULT_CLOSE_MS = 220;

export function SuccessToast({
  message,
  closing,
  onClose,
}: {
  message: string;
  closing: boolean;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50">
      <div
        className={[
          "pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg",
          closing
            ? "animate-out fade-out slide-out-to-right-8 duration-200"
            : "animate-in fade-in slide-in-from-right-8 duration-300",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="flex-1">{message}</p>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-emerald-700/80 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
          onClick={onClose}
          aria-label="Tutup notifikasi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function useSuccessToast(options?: SuccessToastOptions) {
  const autoHideMs = options?.autoHideMs ?? DEFAULT_AUTO_HIDE_MS;
  const closeMs = options?.closeMs ?? DEFAULT_CLOSE_MS;
  const [state, setState] = React.useState<SuccessToastState>({
    message: "",
    visible: false,
    closing: false,
  });
  const autoCloseRef = React.useRef<number | null>(null);
  const closeRef = React.useRef<number | null>(null);

  const clearTimers = React.useCallback(() => {
    if (autoCloseRef.current !== null) {
      window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    if (closeRef.current !== null) {
      window.clearTimeout(closeRef.current);
      closeRef.current = null;
    }
  }, []);

  const closeSuccessToast = React.useCallback(() => {
    clearTimers();
    setState((prev) => ({ ...prev, closing: true }));
    closeRef.current = window.setTimeout(() => {
      setState({ message: "", visible: false, closing: false });
      closeRef.current = null;
    }, closeMs);
  }, [clearTimers, closeMs]);

  const showSuccessToast = React.useCallback(
    (message: string) => {
      clearTimers();
      setState({ message, visible: true, closing: false });
      autoCloseRef.current = window.setTimeout(() => {
        closeSuccessToast();
      }, autoHideMs);
    },
    [autoHideMs, clearTimers, closeSuccessToast],
  );

  React.useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    showSuccessToast,
    closeSuccessToast,
    successToastNode: state.visible ? (
      <SuccessToast
        message={state.message}
        closing={state.closing}
        onClose={closeSuccessToast}
      />
    ) : null,
  };
}
