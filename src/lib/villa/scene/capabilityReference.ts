import { z } from 'zod';
import { elementSchema, operationSchema, sceneSchema } from './model';

/** Executable contracts, not a second catalogue. Derived afresh from the same
 * schemas used to parse transactions; renderer semantics stay in the design guide. */
export function constructionCapabilityReference() {
    const contract = (schema: z.ZodType) => {
        const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
        const properties = json.properties ?? {};
        return Object.entries(properties).map(([name, value]) => {
            const field = value as Record<string, unknown>;
            const rules = Object.fromEntries(Object.entries(field).filter(([key]) =>
                ['type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'minItems', 'maxItems', 'default', 'items', 'properties', 'required', 'pattern', 'maxLength', 'anyOf'].includes(key)));
            return [name, name === 'element' ? 'element contract above' : name === 'assembly' ? 'wing/pool parameters documented in COORDINATED ASSEMBLIES; provider schema is authoritative' : rules];
        });
    };
    return '\nEXECUTABLE CONSTRUCTION CONTRACT (derived from runtime schemas)\n' + JSON.stringify({
        element: Object.fromEntries(contract(elementSchema)),
        operations: operationSchema.options.map(schema => Object.fromEntries(contract(schema))),
        maxElements: z.toJSONSchema(sceneSchema.shape.elements, {io:'input',unrepresentable:'any'}).maxItems,
        note: 'Dimensions are not an automatic layout solver. Use the renderer semantics and relationships above. Compose wings from a floor root and individually identified children; move/rotate the root to carry descendants. resize edits one part; scale-assembly scales descendants. Repair datums in the same transaction. Choose composition, voids, arrival, circulation and views before construction; names or material changes alone do not establish a different concept.',
    });
}
