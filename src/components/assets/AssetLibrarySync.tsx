"use client";

import { useEffect } from "react";
import { startAssetSync } from "@/lib/assets/assetSync";

/** Loads the curated-asset library from the server on every page and keeps it in sync (renders nothing). */
export function AssetLibrarySync() {
  useEffect(() => {
    void startAssetSync();
  }, []);
  return null;
}
