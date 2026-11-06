import {z} from 'zod';
import {BLOCK_HEIGHTS,BLOCK_RANKS,MAX_BLOCKS,MAX_OPEN_SPACES,MAX_DOORS,MAX_VERANDAS,scalePlanSchema,visionSchema,directionSchema,stageSchemas,exteriorSchema,exteriorDoorSchema,entranceSchema,verandaSchema,siteSchema} from './spec';
/** Transport accepts identifiers for deterministic canonicalization; internal schemas remain strict. */
const wireId=z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/).describe('Stable lowercase identifier, at most 40 characters; prefer hyphens, never spaces.');
// The structured vision is required from the provider (strict output); it stays optional in saved designs.
export const directionProviderSchema=directionSchema.extend({palette:directionSchema.shape.palette.extend({roofColor:directionSchema.shape.palette.shape.roofColor.unwrap().nullable()}),vision:visionSchema.extend({scale:scalePlanSchema.describe('Planned architectural scale, read from the brief: footprint, gross floor area, levels, major wings and principal spaces. Never inflate a modest brief; never shrink a grand one.')})});
export const massingProviderSchema=stageSchemas[2].extend({blocks:z.array(stageSchemas[2].shape.blocks.element.extend({id:wireId,open:z.boolean(),
 height:z.enum(BLOCK_HEIGHTS).describe('Clear wall height: low 2.7 m, standard 3.1 m, tall 4.3 m, double 6.5 m (one occupied level, two-storey void). Use standard for open spaces.'),
 rank:z.enum(BLOCK_RANKS).describe('Place of this volume in the composition hierarchy. Use secondary for open spaces.')})).min(1).max(MAX_BLOCKS+MAX_OPEN_SPACES)});
export const exteriorProviderSchema=stageSchemas[4].extend({roofs:z.record(wireId,stageSchemas[4].shape.roofs.valueType),exterior:exteriorSchema.extend({
 doors:z.array(exteriorDoorSchema.extend({id:wireId,room:wireId})).max(MAX_DOORS),entrance:entranceSchema.extend({door:wireId}),verandas:z.array(verandaSchema.extend({id:wireId,block:wireId})).max(MAX_VERANDAS),
})});
export const siteProviderSchema=stageSchemas[5].extend({finishes:z.record(wireId,stageSchemas[5].shape.finishes.valueType),siteWork:siteSchema.extend({pool:siteSchema.shape.pool.unwrap().extend({sourceIntent:wireId.optional()}),
 lawns:z.array(siteSchema.shape.lawns.element.extend({id:wireId})).max(16),beds:z.array(siteSchema.shape.beds.element.extend({id:wireId})).max(10),trees:z.array(siteSchema.shape.trees.element.extend({id:wireId})).max(40),hedges:z.array(siteSchema.shape.hedges.element.extend({id:wireId})).max(14),paths:z.array(siteSchema.shape.paths.element.extend({id:wireId})).max(16),
})});
