import {DIRECT_SCENE_KINDS} from '@/lib/semantic/vocabulary';
import { z } from 'zod';
import { elementFieldsSchema, operationSchema, sceneSchema } from './model';

/** Executable contracts, not a second catalogue. Derived afresh from the same
 * schemas used to parse transactions; renderer semantics stay in the design guide. */
export function constructionCapabilityReference() {
    const contract = (schema: z.ZodType) => {
        const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
        const properties = json.properties ?? {};
        return Object.entries(properties).map(([name, value]) => {
            const field = value as Record<string, unknown>;
            const rules = name === 'semanticType' ? {type:'string', rendererKinds:'semanticKinds'} : Object.fromEntries(Object.entries(field).filter(([key]) =>
                ['type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'minItems', 'maxItems', 'default', 'items', 'properties', 'required', 'pattern', 'maxLength', 'anyOf'].includes(key)));
            return [name, name === 'element' ? 'element contract above' : name === 'assembly' ? 'see assembly instructions and provider schema' : rules];
        });
    };
    return '\nEXECUTABLE CONSTRUCTION CONTRACT (derived from runtime schemas)\n' + JSON.stringify({
        element: Object.fromEntries(contract(elementFieldsSchema)),
        semanticKinds: Object.fromEntries(elementFieldsSchema.shape.kind.options.map(kind => [kind,Object.entries(DIRECT_SCENE_KINDS).filter(([,kinds])=>kinds.includes(kind)).map(([type])=>type).join(',')])),
        operations: operationSchema.options.map(schema => Object.fromEntries(contract(schema))),
        maxElements: z.toJSONSchema(sceneSchema.shape.elements, {io:'input',unrepresentable:'any'}).maxItems,
        note: 'Root transforms carry descendants; resize edits one part.',
    });
}
