import type { GenerationReport } from '@/types/library';
export type AssetRenderOutcomes = Record<string, {
    status: 'Rendered' | 'Failed';
    note?: string;
}>;
/** Keep browser-observed rendering distinct from server-observed application. */
export function withAssetOutcomes(report: GenerationReport, outcomes: AssetRenderOutcomes): GenerationReport {
    return { ...report, assets: report.assets.map(a => {
            const states = (a.placementIds ?? []).map(id => outcomes[`${report.projectId}:${id}`]);
            const failed = states.find(s => s?.status === 'Failed');
            return { ...a, status: failed ? 'Failed' : states.length && states.every(s => s?.status === 'Rendered') ? 'Rendered' : a.status, note: failed?.note ?? (states.length && states.every(s => s?.status === 'Rendered') ? 'All placements rendered.' : a.note) };
        }) };
}
