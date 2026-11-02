import { assemblyOperations } from './assemblies';
import type { SceneOperation } from './model';

/** Generate-only preflight. Tracks occurrences rather than names so legal ID reuse
 * and one coordinated replacement remain possible. Never rewrites the transaction. */
export function assertGenerateConstruction(operations: SceneOperation[]) {
    const live = new Map<string, number>();
    const occurrences: { signature: string; remaining: Set<string> }[] = [];
    const erased = new Map<string, number>();
    for (const op of operations) {
        if (op.op === 'assemble') {
            const { id: _id, ...geometry } = op.assembly.parameters;
            void _id;
            // Parsed parameters have canonical key order and explicit defaults.
            const signature = JSON.stringify([op.assembly.kind, geometry]);
            if ((erased.get(signature) ?? 0) >= 2)
                throw Error('Generation construction loop: repeated identical assembly at identical coordinates after two complete deletions. Select one design and retain its construction.');
            if (occurrences.filter(o => o.signature === signature && o.remaining.size).length >= 2)
                throw Error('Generation construction loop: three identical assemblies overlap at identical coordinates.');
            const ids = assemblyOperations(op.assembly).flatMap(o => o.op === 'add' ? [o.element.id] : []);
            const index = occurrences.length;
            occurrences.push({ signature, remaining: new Set(ids) });
            ids.forEach(id => live.set(id, index));
        } else if (op.op === 'add') {
            live.delete(op.element.id);
        } else if (op.op === 'remove') {
            const index = live.get(op.id);
            if (index === undefined) continue;
            live.delete(op.id);
            const occurrence = occurrences[index];
            occurrence.remaining.delete(op.id);
            if (!occurrence.remaining.size)
                erased.set(occurrence.signature, (erased.get(occurrence.signature) ?? 0) + 1);
        } else if ('id' in op && op.op !== 'finish') {
            // A changed assembly is no longer an identical geometric experiment.
            const index = live.get(op.id);
            if (index !== undefined) occurrences[index].signature = `modified-${index}`;
        }
    }
}
