import { sceneRequestSchema, type SceneRequest } from './terra';
import { validateScene, type ArchitecturalScene } from './model';

/** Opt-in request preparation only. Caller reviews/commits stage one before requesting two.
 * Uses the canonical endpoint and scene; never schedules requests or changes a project. */
export function compositionRequest(brief: string): SceneRequest {
    return sceneRequestSchema.parse({mode:'generate',prompt:`${brief}\nCOMPOSITION PASS: Construct a complete residence with explicit floors, enclosure, entrance and coordinated roofs. Resolve programme scale, spatial connections, primary/secondary volumes and setbacks first. Show residential identity from arrival and water. Do not defer enclosure or access to the development pass. Avoid equal repetitive roof plates. State remaining development needs.`});
}
export function developmentRequest(current: ArchitecturalScene, areas: string, options: { recompose?: boolean; intent?: 'refine' | 'redesign' } = {}): SceneRequest {
    validateScene(current);
    const editIntent = options.intent ?? (options.recompose ? 'redesign' : 'refine');
    const permission = editIntent === 'redesign'
        ? 'REDESIGN: Substantial changes to existing floors, walls, roofs, entrances, facades and architectural volumes are authorized. Replace or reorganize inadequate composition and spatial hierarchy, coordinating all supports and dependents in one atomic transaction. Preserve IDs for retained elements and unrelated site geometry and terrain. Explain the architectural changes and unresolved capabilities.'
        : 'REFINE: Preserve composition and spatial hierarchy. Apply targeted atomic changes to entrances, facade bays, openings, roof edges, shade and materials. Preserve unrelated elements, terrain and stable IDs. Repair related supports together. If massing needs substantial revision, explain it for an explicit Redesign request.';
    return sceneRequestSchema.parse({mode:'edit',editIntent,current,prompt:`ARCHITECTURAL DEVELOPMENT PASS: ${areas}\n${permission} Retrieve relevant architectural knowledge. Do not add repetitive decoration. Disclose unresolved circulation/enclosure.`});
}
