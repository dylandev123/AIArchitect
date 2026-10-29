import { z } from 'zod';
import {assemblySchema} from './assemblyContract';
import {assemblyOperations} from './assemblies';
import { assertSceneRelationships } from './relationships';
import { isApprovedBuilder } from '../component-registry';
import { pavilionPlacementSchema } from '../experimental/curved-pavilion';
const scalar = z.number().finite().min(-10000).max(10000);
const vector = z.array(scalar).length(3).transform(v => v as [
    number,
    number,
    number
]);
const size = z.array(z.number().finite().positive().max(10000)).length(3).transform(v => v as [
    number,
    number,
    number
]);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
export const elementSchema = z.object({
    id, label: z.string().max(120), kind: z.enum(['plate', 'wall', 'roof', 'glazing', 'balcony', 'entrance', 'screen', 'sofa', 'volume', 'water', 'pavilion']),
    assemblyKind:z.enum(['residential-wing','rectangular-pool']).optional(),
    parent: id.optional(), at: vector, rotation: scalar.default(0), size,
    material: z.enum(['ivory', 'limestone', 'timber', 'bronze', 'sage']).default('ivory'),
    roofForm: z.enum(['flat', 'gable', 'hip']).optional(), overhang: z.number().finite().min(0).max(10).optional(),
    panels: z.number().int().min(1).max(40).default(4),
    opening: z.object({ x: scalar, sill: z.number().finite().min(0).max(10000), width: z.number().finite().positive().max(10000), height: z.number().finite().positive().max(10000), glazed: z.boolean() }).strict().optional(),
}).strict();
export type SceneElement = z.infer<typeof elementSchema>;
// Optional site intent uses the existing V3 terrain compiler, independently of building validation.
export const sceneTerrainSchema = z.object({
    width: z.number().finite().min(10).max(200), depth: z.number().finite().min(10).max(200),
    elevation: z.number().finite().min(-100).max(100),
    grade: z.number().finite().min(0).max(1), fall: z.enum(['x', '-x', 'z', '-z']),
    cliff: z.object({at: z.number().finite().min(-100).max(100), drop: z.number().finite().min(0).max(100), run: z.number().finite().min(1).max(100)}).strict().optional(),
}).strict();
export const sceneSchema = z.object({ version: z.literal('architectural-scene-1'), name: z.string().max(120), generationResponseId: z.string().uuid().optional(), elements: z.array(elementSchema).max(400), terrain: sceneTerrainSchema.optional(), architecturalPlan: z.unknown().optional(), knowledgeEvidence: z.array(z.object({id:z.string().max(80),version:z.number().int().positive(),requiredKinds:z.array(elementSchema.shape.kind).max(12)}).strict()).max(24).optional() }).strict();
export type ArchitecturalScene = z.infer<typeof sceneSchema>;
export function validateScene(input: unknown): ArchitecturalScene {
    const scene = sceneSchema.parse(input), map = new Map(scene.elements.map(e => [e.id, e]));
    if (map.size !== scene.elements.length)
        throw Error('Duplicate element ID');
    for (const e of scene.elements) {
        if (e.kind === 'pavilion') scenePavilionPlacement(e);
        if ((e.roofForm !== undefined || e.overhang !== undefined) && e.kind !== 'roof')
            throw Error('Roof parameters require a roof element');
        if (e.roofForm && e.roofForm !== 'flat' && e.size[1] < .6)
            throw Error('Pitched roof rise must be at least 0.6 metres');
        const visited = new Set([e.id]);
        let parent = e.parent;
        while (parent) {
            if (visited.has(parent))
                throw Error('Cyclic attachment');
            visited.add(parent);
            const p = map.get(parent);
            if (!p)
                throw Error('Missing attachment');
            parent = p.parent;
        }
        if (e.opening) {
            const o = e.opening;
            if (e.kind !== 'wall' || Math.abs(o.x) + o.width / 2 > e.size[0] / 2 || o.sill + o.height > e.size[1])
                throw Error('Opening must fit wall');
        }
    }
    return scene;
}
// A plain union emits supported anyOf; unique literal op tags retain unambiguous parsing.
export const operationSchema = z.union([
    z.object({op:z.literal('assemble'),assembly:assemblySchema}).strict(),
    z.object({op:z.literal('scale-assembly'),id,factors:z.array(z.number().finite().min(.1).max(10)).length(3)}).strict(),
    z.object({op: z.literal('set-terrain'), terrain: sceneTerrainSchema.nullable()}).strict(),
    z.object({ op: z.literal('add'), element: elementSchema }).strict(),
    z.object({ op: z.literal('replace'), id, element: elementSchema }).strict(),
    z.object({ op: z.literal('remove'), id }).strict(),
    z.object({ op: z.literal('move'), id, at: vector }).strict(),
    z.object({ op: z.literal('rotate'), id, rotation: scalar }).strict(),
    z.object({ op: z.literal('resize'), id, size }).strict(),
    z.object({ op: z.literal('finish'), id, material: elementSchema.shape.material }).strict(),
    // Homogeneous fixed-length arrays avoid draft-7 tuple items: [schema, schema].
    z.object({ op: z.literal('place-on'), id, support: id, offset: z.array(scalar).length(2).transform(v => v as [number, number]), rotation: scalar.default(0) }).strict(),
    z.object({ op: z.literal('attach'), id, parent: id.optional(), at: vector }).strict(),
]);
export type SceneOperation = z.infer<typeof operationSchema>;
/** Atomic JSON-only transaction. Unaffected element objects retain identity. */
export function stageSceneOperations(scene: ArchitecturalScene, input: unknown, observe?: (index: number, before: SceneElement[], after: SceneElement[]) => void): ArchitecturalScene {
    const requested = z.array(operationSchema).max(800).parse(input);
    const expanded = requested.flatMap((op,index)=>(op.op==='assemble'?assemblyOperations(op.assembly):[op]).map(operation=>({operation,index})));
    const ops = expanded.map(item=>item.operation);
    if(ops.length>800) throw Error('Expanded assembly operation budget exceeded');
    let elements = scene.elements;
    let terrain = scene.terrain;
    for (const {operation: op, index} of expanded) {
        const before = elements;
        try {
        if(op.op==='assemble') throw Error('Nested assembly expansion is unsupported');
        if (op.op === 'set-terrain') { terrain = op.terrain ?? undefined; continue; }
        const target = 'id' in op ? elements.find(e => e.id === op.id) : undefined;
        if (op.op !== 'add' && !target)
            throw Error('Unknown element');
        if(op.op==='scale-assembly'){
            const ids=new Set([op.id]);
            for(let i=0;i<elements.length;i++)for(const e of elements)if(e.parent&&ids.has(e.parent))ids.add(e.id);
            if(ids.size===1)throw Error('scale-assembly requires an editable hierarchy');
            if(Math.abs(op.factors[0]-op.factors[2])>1e-8)throw Error('Nonuniform plan scaling of wall openings is unsupported; replace coordinated children explicitly');
            elements=elements.map(e=>!ids.has(e.id)?e:{...e,size:e.size.map((v,i)=>v*op.factors[i]) as SceneElement['size'],at:e.id===op.id?e.at:e.at.map((v,i)=>v*op.factors[i]) as SceneElement['at'],...(e.overhang!==undefined?{overhang:e.overhang*Math.max(op.factors[0],op.factors[2])}:{}),...(e.opening?{opening:{...e.opening,x:e.opening.x*op.factors[0],width:e.opening.width*op.factors[0],sill:e.opening.sill*op.factors[1],height:e.opening.height*op.factors[1]}}:{})});
            continue;
        }
        if (op.op === 'add')
            elements = [...elements, op.element];
        else if (op.op === 'remove')
            elements = elements.filter(e => e.id !== op.id);
        else
            elements = elements.map(e => {
                if (e.id !== op.id)
                    return e;
                switch (op.op) {
                    case 'replace':
                        if (op.element.id !== op.id)
                            throw Error('Stable ID required');
                        return op.element;
                    case 'rotate': return { ...e, rotation: op.rotation };
                    case 'move': return { ...e, at: op.at };
                    case 'resize': return { ...e, size: op.size };
                    case 'finish': return { ...e, material: op.material };
                    case 'place-on': {
                        const support = elements.find(item => item.id === op.support);
                        if (!support || !['plate', 'volume', 'roof'].includes(support.kind) ||
                            (support.kind === 'roof' && support.roofForm && support.roofForm !== 'flat'))
                            throw Error('place-on requires an existing horizontal plate, volume or flat roof');
                        if (e.kind === 'pavilion') throw Error('place-on requires a centre-origin element');
                        // Resolve once into the existing scene graph; no new renderer or saved format.
                        return { ...e, parent: support.id, at: [op.offset[0], (support.size[1] + e.size[1]) / 2, op.offset[1]] as [number, number, number], rotation: op.rotation };
                    }
                    case 'attach': return { ...e, parent: op.parent, at: op.at };
                }
            });
        } finally { observe?.(index, before, elements); }
    }
    const next = { ...scene, elements };
    if (terrain) next.terrain = terrain; else delete next.terrain;
    validateScene(next);
    return next;
}

/** Validated transactions remain atomic, including indirect support faults. */
export function applySceneOperations(scene: ArchitecturalScene, input: unknown): ArchitecturalScene {
    const next = stageSceneOperations(scene, input);
    assertSceneRelationships(next, scene);
    return next;
}

/** Local builder origin is 0.47m above its parent; scene at denotes the floor centre.
 * Placement/yaw belong to the scene graph, so old site/wing bounds never control it. */
export function scenePavilionPlacement(e: SceneElement) {
    if (!isApprovedBuilder('curved-pavilion@1')) throw Error('Pavilion builder is not approved.');
    return pavilionPlacementSchema.parse({ id: 'scene-pavilion', builder: 'curved-pavilion@1',
        x: 0, z: 0, orientation: 0, width: e.size[0], height: e.size[1], depth: e.size[2], material: e.material });
}
