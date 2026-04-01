"use client";

import * as React from "react";

const MONEY_VISIBILITY_STORAGE_KEY = "clientdesk:money:visible";
const MONEY_VISIBILITY_EVENT = "clientdesk:money-visibility:changed";

function readStoredMoneyVisibility(defaultValue: boolean) {
  if (typeof window === "undefined") return defaultValue;

  try {
    const rawValue = window.localStorage.getItem(MONEY_VISIBILITY_STORAGE_KEY);
    if (rawValue === null) return defaultValue;
    return rawValue !== "0";
  } catch {
    return defaultValue;
  }
}

export function useMoneyVisibility(defaultVisible = true) {
  const [isMoneyVisible, setIsMoneyVisible] = React.useState<boolean>(
    defaultVisible,
  );

  React.useEffect(() => {
    setIsMoneyVisible(readStoredMoneyVisibility(defaultVisible));
  }, [defaultVisible]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      setIsMoneyVisible(readStoredMoneyVisibility(defaultVisible));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== MONEY_VISIBILITY_STORAGE_KEY) return;
      syncFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(MONEY_VISIBILITY_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MONEY_VISIBILITY_EVENT, syncFromStorage);
    };
  }, [defaultVisible]);

  const setMoneyVisibility = React.useCallback((nextVisible: boolean) => {
    setIsMoneyVisible(nextVisible);

    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        MONEY_VISIBILITY_STORAGE_KEY,
        nextVisible ? "1" : "0",
      );
      window.dispatchEvent(new Event(MONEY_VISIBILITY_EVENT));
    } catch {
      // Keep UI responsive even if storage is unavailable.
    }
  }, []);

  const toggleMoneyVisibility = React.useCallback(() => {
    setMoneyVisibility(!isMoneyVisible);
  }, [isMoneyVisible, setMoneyVisibility]);

  return {
    isMoneyVisible,
    setMoneyVisibility,
    toggleMoneyVisibility,
  };
}
