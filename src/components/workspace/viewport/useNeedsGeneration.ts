"use client";

import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { needsInitialGeneration } from "@/lib/house/blank";

/** True for a never-designed project, whose viewport shows only the site until generation finishes. */
export function useNeedsGeneration(): boolean {
  const params = useParams<{ projectId: string }>();
  return useProjectStore((s) => {
    const project = s.getProject(params.projectId);
    return !!project && needsInitialGeneration(project);
  });
}
