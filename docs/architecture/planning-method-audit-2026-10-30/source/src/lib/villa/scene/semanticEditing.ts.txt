import { z } from 'zod';
import { OBJECT_REGISTRY, SemanticEditError, requestedCreationType, changedFields, resolveSemanticTarget, stable, type ObjectType, type SemanticObject } from '@/lib/semantic/vocabulary';
import { elementSchema, stageSceneOperations, type ArchitecturalScene, type SceneElement, type SceneOperation } from './model';
import { assemblyOperations } from './assemblies';
import { sceneSpatialGeometry } from './spatial';
import { v3NaturalGroundHeight } from '@/lib/v3/grading';

export const editContextSchema = z.object({selectedId: z.string().min(1).max(80).optional(), cameraRight: z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]).optional()}).strict();
export type EditContext = z.infer<typeof editContextSchema>;
const kindTypes: Partial<Record<SceneElement['kind'], ObjectType>> = {wall:'wall',roof:'roof',glazing:'window',entrance:'exterior-door',sofa:'outdoor-furniture',water:'pool',balcony:'balcony',plate:'floor',volume:'mass',pavilion:'building'};
export function sceneSemanticObjects(scene: ArchitecturalScene): SemanticObject[] {
    const {world} = sceneSpatialGeometry(scene);
    function members(id: string): string[] { return [id,...scene.elements.filter(e => e.parent === id).flatMap(e => members(e.id))]; }
    return scene.elements.map(e => {
        const text = `${e.id} ${e.label}`.replace(/-/g,' ').toLowerCase();
        const inferred = e.kind === 'entrance' && /\b(front door|main entrance|entry door)\b/.test(text) ? 'front-door' : e.assemblyKind === 'residential-wing' ? 'building' : e.assemblyKind === 'rectangular-pool' ? 'pool' : e.assemblyKind === 'straight-stair' ? 'stair' : kindTypes[e.kind];
        return {id:e.id,type:e.semanticType ?? inferred ?? 'mass',label:e.label,aliases:e.aliases ?? [],position:world(e).slice(0,3) as [number,number,number],yaw:world(e)[3],hostId:e.parent,memberIds:e.assemblyKind ? members(e.id) : [e.id],suppressTypeAliases:scene.elements.some(root => root.assemblyKind === 'rectangular-pool' && root.id !== e.id && members(root.id).includes(e.id))};
    });
}
export interface SceneEditScope {
    targetIds: string[];
    fields: string[];
    operations: SceneOperation['op'][];
    creationType?: ObjectType;
    /** Exact new IDs authorized by a bounded architectural review. */
    creationIds?: string[];
    widthOnly?: boolean;
}
const fail = (message: string): never => { throw new SemanticEditError('preservation', message); };
/** Scope is application-derived. Model output never supplies its own authority. */
export function planSceneEdit(scene: ArchitecturalScene, prompt: string, context: EditContext = {}): SceneEditScope {
    const text = prompt.toLowerCase();
    const objects = sceneSemanticObjects(scene);
    if (/^\s*(add|create|plant)\b/.test(text)) {
        const type = requestedCreationType(prompt);
        // Existing singular objects must be edited explicitly, never duplicated by accident.
        if (type === 'pool' && objects.some(o => o.type === 'pool') && !/\b(another|second|additional)\b/.test(text)) throw new SemanticEditError('ambiguous-target','A pool already exists. Specify another pool or edit the existing one.');
        return {targetIds:[], fields:[], operations:['add','assemble'], creationType:type};
    }
    const target = resolveSemanticTarget(objects, prompt, context);
    if (/\b(material|finish|colou?r|blue|red|green|timber|limestone|bronze|ivory|sage)\b/.test(text)) return {targetIds:[target.id],fields:['material','color'],operations:['finish','replace']};
    if (/\b(extend|enlarge|widen|wider|resize|bigger|smaller|size|width|depth|height|narrower)\b/.test(text)) return {targetIds:[...target.memberIds],fields:['size',...(target.type === 'pool' ? ['at','opening','overhang'] : [])],operations:target.type === 'pool' && target.memberIds.length > 1 ? ['scale-assembly'] : ['resize'],widthOnly:target.type === 'stair' && /\b(widen|wider|width)\b/.test(text)};
    if (/\b(move|relocate)\b/.test(text)) return {targetIds:[target.id],fields:['at'],operations:['move']};
    if (/\b(rotate|turn)\b/.test(text)) return {targetIds:[target.id],fields:['rotation'],operations:['rotate']};
    if (/\b(remove|delete)\b/.test(text)) return {targetIds:[...target.memberIds],fields:[],operations:['remove']};
    if (/\b(detach|attach)\b/.test(text)) return {targetIds:[target.id],fields:['parent','at'],operations:['attach']};
    if (/\b(opening)\b/.test(text) && scene.elements.find(e => e.id === target.id)?.kind === 'wall') return {targetIds:[target.id],fields:['opening'],operations:['replace']};
    throw new SemanticEditError('unsupported-edit','Specify the property and object to edit, or use explicit Redesign/Complete for architectural recomposition.');
}

/** Complete before/after diff, including transforms inherited from untouched parents.
 * No inferred dependent repairs: only named assembly members receive permission. */
export function assertSceneEditPreserved(before: ArchitecturalScene, after: ArchitecturalScene, scope: SceneEditScope): void {
    const metadataBefore = {...before, elements:undefined}, metadataAfter = {...after,elements:undefined};
    if (stable(metadataBefore) !== stable(metadataAfter)) fail('Local edits cannot change scene metadata, terrain or architectural plan.');
    const old = new Map(before.elements.map(e => [e.id,e])); const next = new Map(after.elements.map(e => [e.id,e]));
    for (const [id,e] of old) {
        const n = next.get(id);
        if (!n) { if (!scope.targetIds.includes(id) || !scope.operations.includes('remove')) fail(`Deletion outside requested scope: ${id}`); continue; }
        const fields = changedFields(e,n);
        if (fields.length && (!scope.targetIds.includes(id) || fields.some(f => !scope.fields.includes(f)))) fail(`Unrequested change to ${id}: ${fields.join(', ')}`);
        if (scope.widthOnly && (e.size[1] !== n.size[1] || e.size[2] !== n.size[2])) fail('Widening stairs must preserve rise, run and endpoints.');
    }
    for (const e of after.elements.filter(e => !old.has(e.id))) {
        if (!scope.creationType && !scope.creationIds?.includes(e.id)) fail(`Unrequested creation: ${e.id}`);
    }
    if (scope.widthOnly) {
        const widths = scope.targetIds.flatMap(id => next.get(id) ? [next.get(id)!.size[0]] : []);
        if (widths.some(width => Math.abs(width-widths[0]) > 1e-6)) fail('Widen every tread in the selected staircase consistently.');
    }
    // A parent transform implicitly moves its entire subtree. Reject those effects
    // even when the child's local JSON is unchanged.
    const a = sceneSemanticObjects(before), b = sceneSemanticObjects(after);
    for (const o of a) {
        const n = b.find(v => v.id === o.id);
        if (n && (stable(o.position) !== stable(n.position) || o.yaw !== n.yaw) && !scope.targetIds.includes(o.id)) fail(`Indirect movement outside scope: ${o.id}`);
    }
    const geometry = sceneSpatialGeometry(after);
    const oldGeometry = sceneSpatialGeometry(before);
    for (const e of after.elements) {
        if (stable(old.get(e.id)) === stable(e)) continue;
        // Roofs/walls/glazing are constructive intersections, not solid boxes.
        // Existing surface-aware architecture validators own those relationships.
        if (['roof','wall','glazing','screen'].includes(e.kind)) continue;
        const semantic = b.find(o => o.id === e.id);
        if (semantic && OBJECT_REGISTRY[semantic.type].placement === 'ground' && !semantic.suppressTypeAliases) {
            const p = geometry.world(e), terrain = after.terrain;
            const ground = terrain ? v3NaturalGroundHeight({width:terrain.width,depth:terrain.depth,naturalGround:terrain},p[0],p[2]) : 0;
            const seated = after.elements.some(host => host.id !== e.id && ['plate','volume','roof'].includes(host.kind) && OBJECT_REGISTRY[semantic.type].hosts.includes(b.find(o => o.id === host.id)!.type) && Math.abs(geometry.bottom(e)-geometry.top(host)) <= .16 && geometry.contains(host,e));
            if (Math.abs(geometry.bottom(e)-ground) > .16 && !seated) fail(`Ground object ${e.id} needs ground contact or a permitted supporting host.`);
        }
        if (semantic && ['ground-cover','none','host-opening'].includes(OBJECT_REGISTRY[semantic.type].collision)) continue;
        for (const other of before.elements) {
            if (e.kind === 'screen' || other.kind === 'screen') continue;
            if (other.id === e.id || scope.targetIds.includes(other.id) || e.parent === other.id || other.parent === e.id) continue;
            const otherSemantic = b.find(o => o.id === other.id);
            if (otherSemantic && ['ground-cover','none'].includes(OBJECT_REGISTRY[otherSemantic.type].collision)) continue;
            const n = next.get(other.id)!;
            const overlap = Math.min(geometry.top(e),geometry.top(n)) - Math.max(geometry.bottom(e),geometry.bottom(n));
            if (overlap <= .01 || geometry.separation(e,n) >= -.01) continue;
            const prior = old.get(e.id);
            // Historical contacts are retained. Only new/worsened penetration is blocked.
            if (prior && oldGeometry.separation(prior,other) <= geometry.separation(e,n) + .001 && Math.min(oldGeometry.top(prior),oldGeometry.top(other)) - Math.max(oldGeometry.bottom(prior),oldGeometry.bottom(other)) >= overlap - .001) continue;
            fail(`New collision between ${e.id} and ${other.id}.`);
        }
    }
}

export function validateSceneEditOperations(scene: ArchitecturalScene, operations: SceneOperation[], scope: SceneEditScope): void {
    const existing = new Set(scene.elements.map(e => e.id));
    for (const op of operations) {
        if (!scope.operations.includes(op.op)) fail(`Operation ${op.op} is outside the requested edit scope.`);
        if ('id' in op && ((!existing.has(op.id) && !scope.creationIds?.includes(op.id)) || !scope.targetIds.includes(op.id))) fail(`Unknown or unrequested target outside scope: ${op.id}`);
        if (op.op === 'add' && existing.has(op.element.id)) fail(`Creation cannot replace existing ID: ${op.element.id}`);
        if (scope.creationType === 'pool' && (op.op !== 'assemble' || op.assembly.kind !== 'rectangular-pool')) fail('A new pool requires its coordinated basin, water and dry circuit assembly.');
        if (op.op === 'attach' && op.parent) {
            const objects = sceneSemanticObjects(scene), target = objects.find(o => o.id === op.id), host = objects.find(o => o.id === op.parent);
            if (!target || !host || !OBJECT_REGISTRY[target.type].hosts.includes(host.type)) fail('Invalid semantic host relationship.');
        }
        if (op.op === 'add' && scope.creationIds) {
            if (!scope.creationIds.includes(op.element.id)) fail('Creation exceeds declared new IDs.');
        }
        if (op.op === 'assemble' || op.op === 'add') {
            const elements = op.op === 'assemble' ? assemblyOperations(op.assembly).flatMap(o => o.op === 'add' ? [o.element] : []) : [op.element];
            if (elements.some(e => existing.has(e.id))) fail('Assembly collides with an existing stable ID.');
            const temporary = stageSceneOperations({version:'architectural-scene-1',name:'Creation check',elements:scene.elements},[op]);
            const added = sceneSemanticObjects(temporary).filter(o => !existing.has(o.id));
            for (const object of added) {
                if (!object.hostId || elements.some(e => e.id === object.hostId)) continue;
                const host = sceneSemanticObjects(temporary).find(o => o.id === object.hostId);
                if (!host || !OBJECT_REGISTRY[object.type].hosts.includes(host.type)) fail('Created object has an invalid semantic host.');
            }
            if (scope.creationIds) {
                if (added.some(o => !scope.creationIds!.includes(o.id))) fail('Creation exceeds declared new IDs.');
                continue;
            }
            const root = added[0];
            if (!root || root.type !== scope.creationType) fail(`Created object does not match requested ${scope.creationType}.`);
            if (op.op !== 'assemble' && added.some(o => o.type !== scope.creationType)) fail('Creation contains unrelated object types.');
        }
    }
}

/** Canonical operation names map to the established executor; no second mutation path. */
export const constrainedEditSchema = z.discriminatedUnion('op', [
    z.object({op:z.literal('create'),element:elementSchema}).strict(),
    z.object({op:z.literal('changeMaterial'),target:z.string(),material:z.enum(['ivory','limestone','timber','bronze','sage'])}).strict(),
    z.object({op:z.literal('move'),target:z.string(),at:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()])}).strict(),
    z.object({op:z.literal('resize'),target:z.string(),size:z.tuple([z.number().positive(),z.number().positive(),z.number().positive()])}).strict(),
    z.object({op:z.literal('rotate'),target:z.string(),rotation:z.number().finite()}).strict(),
    z.object({op:z.literal('delete'),target:z.string()}).strict(),
    z.object({op:z.literal('attach'),target:z.string(),host:z.string(),at:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()])}).strict(),
    z.object({op:z.literal('detach'),target:z.string(),at:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()])}).strict(),
    z.object({op:z.literal('editArchitecture'),target:z.string(),fields:z.object({size:z.tuple([z.number().positive(),z.number().positive(),z.number().positive()]).optional()}).strict()}).strict(),
    z.object({op:z.literal('editLandscape'),target:z.string(),fields:z.object({size:z.tuple([z.number().positive(),z.number().positive(),z.number().positive()]).optional()}).strict()}).strict(),
    z.object({op:z.literal('setConnectorEndpoints'),target:z.string(),from:z.string(),to:z.string()}).strict(),
    z.object({op:z.literal('editOpening'),target:z.string(),opening:z.object({x:z.number().finite(),sill:z.number().nonnegative(),width:z.number().positive(),height:z.number().positive(),glazed:z.boolean()}).strict()}).strict(),
]);
export function compileConstrainedEdit(scene: ArchitecturalScene, input: unknown): SceneOperation {
    const op = constrainedEditSchema.parse(input);
    if (op.op === 'create') {
        if (scene.elements.some(e => e.id === op.element.id)) throw new SemanticEditError('unknown-target','Creation ID already exists.');
        return {op:'add',element:op.element};
    }
    const target = scene.elements.find(e => e.id === op.target);
    if (!target) throw new SemanticEditError('unknown-target','Unknown target ID.');
    switch (op.op) {
        case 'changeMaterial': return {op:'finish',id:target.id,material:op.material};
        case 'move': return {op:'move',id:target.id,at:op.at};
        case 'resize': return {op:'resize',id:target.id,size:op.size};
        case 'rotate': return {op:'rotate',id:target.id,rotation:op.rotation};
        case 'delete': return {op:'remove',id:target.id};
        case 'attach': return {op:'attach',id:target.id,parent:op.host,at:op.at};
        case 'detach': return {op:'attach',id:target.id,at:op.at};
        case 'editArchitecture': case 'editLandscape':
            if (!op.fields.size) throw new SemanticEditError('unsupported-edit','A supported geometry field is required.');
            if (op.op === 'editLandscape' && OBJECT_REGISTRY[sceneSemanticObjects(scene).find(o => o.id === target.id)!.type].category !== 'landscape') throw new SemanticEditError('unsupported-edit','Landscape edits require a landscape object.');
            return {op:'resize',id:target.id,size:op.fields.size};
        case 'setConnectorEndpoints': throw new SemanticEditError('unsupported-edit','Direct-scene connectors have authored geometry; use V3 connector endpoint operations or explicitly coordinated geometry.');
        case 'editOpening':
            if (target.kind !== 'wall') throw new SemanticEditError('unsupported-edit','Openings require an existing wall.');
            return {op:'replace',id:target.id,element:{...target,opening:op.opening}};
    }
}

export function sceneEditContract(scene: ArchitecturalScene, prompt: string, context?: EditContext): string {
    let scope: SceneEditScope;
    try { scope = planSceneEdit(scene,prompt,context); } catch (error) {
        if (!(error instanceof SemanticEditError)) throw error;
        return `\nTARGET CLARIFICATION REQUIRED: ${error.message} Candidates: ${error.candidates.join(', ')}. Return operations:[] and explain the clarification in unsupported. Do not guess a target or regenerate.\n`;
    }
    return `\nLOCALLY ENFORCED EDIT SCOPE: ${JSON.stringify(scope)}. Use only these existing target IDs and operation/field allowlists. Omit architecturalPlan for local edits. New objects must have the requested semanticType; stable IDs, kinds and aliases of existing objects are protected. Assembly members must stay coordinated. No unrelated repairs.\n`;
}
