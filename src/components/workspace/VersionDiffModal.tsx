"use client";

import { Modal } from "@/components/Modal";
import { diffVersions, summarizeItem, type FieldChange } from "@/lib/house/diffVersions";
import { formatRelativeTime } from "@/lib/format";
import type { ProjectVersion } from "@/types/project";

function FieldRow({ change }: { change: FieldChange }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-neutral-500">{change.field}</span>
      <span className="flex items-center gap-1.5 font-mono">
        <span className="text-red-400/80 line-through">{JSON.stringify(change.before)}</span>
        <span className="text-neutral-600">→</span>
        <span className="text-emerald-400">{JSON.stringify(change.after)}</span>
      </span>
    </div>
  );
}

export function VersionDiffModal({
  older,
  newer,
  onClose,
}: {
  older: ProjectVersion;
  newer: ProjectVersion;
  onClose: () => void;
}) {
  const diff = diffVersions(older.houseConfigJson, newer.houseConfigJson);
  const hasSectionChanges = diff?.sections.some((s) => s.items.length > 0);
  const hasChanges = (diff && (diff.houseChanges.length > 0 || hasSectionChanges)) ?? false;

  return (
    <Modal title="Compare Versions" onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between text-xs text-neutral-500">
        <span>
          <span className="text-neutral-300">{older.summary}</span> · {formatRelativeTime(older.createdAt)}
        </span>
        <span className="text-neutral-600">→</span>
        <span>
          <span className="text-neutral-300">{newer.summary}</span> · {formatRelativeTime(newer.createdAt)}
        </span>
      </div>

      {!diff ? (
        <p className="text-sm text-neutral-500">Couldn&apos;t parse one of these versions.</p>
      ) : !hasChanges ? (
        <p className="text-sm text-neutral-500">No differences between these versions.</p>
      ) : (
        <div className="space-y-4">
          {diff.houseChanges.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">House</p>
              <div className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                {diff.houseChanges.map((c) => (
                  <FieldRow key={c.field} change={c} />
                ))}
              </div>
            </div>
          )}

          {diff.sections
            .filter((s) => s.items.length > 0)
            .map((section) => (
              <div key={section.key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {section.label}
                </p>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div
                      key={item.index}
                      className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
                    >
                      {item.type === "added" && (
                        <p className="text-xs text-emerald-400">
                          + Added — {summarizeItem(item.after)}
                        </p>
                      )}
                      {item.type === "removed" && (
                        <p className="text-xs text-red-400/80 line-through">
                          Removed — {summarizeItem(item.before)}
                        </p>
                      )}
                      {item.type === "changed" && (
                        <div className="space-y-1">
                          <p className="text-xs text-amber-400">
                            Changed — {summarizeItem(item.before)}
                          </p>
                          {item.fieldChanges?.map((c) => <FieldRow key={c.field} change={c} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}
