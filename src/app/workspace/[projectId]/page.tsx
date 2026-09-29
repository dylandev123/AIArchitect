"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useHydrated } from "@/lib/useHydrated";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useRenderFlightStore } from "@/store/useRenderFlightStore";

export default function WorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const loadedProjectId = project?.id;
  const touchProject = useProjectStore((s) => s.touchProject);
  const noteRenderWriter = useRenderFlightStore((s) => s.noteWrite);

  useEffect(() => {
    if (hydrated && !project) {
      router.replace("/");
    }
  }, [hydrated, project, router]);

  useEffect(() => {
    if (project) touchProject(project.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => { if (loadedProjectId) noteRenderWriter("workspace-route-load"); }, [loadedProjectId, noteRenderWriter]);

  if (!hydrated || !project) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">
        Loading workspace…
      </div>
    );
  }

  return <WorkspaceShell project={project} />;
}
