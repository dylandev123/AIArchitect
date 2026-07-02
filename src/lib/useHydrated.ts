"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Guards against SSR/client mismatches for state hydrated from localStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
