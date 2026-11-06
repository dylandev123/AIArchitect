import {z} from 'zod';
import {directionSchema,stageSchemas,exteriorSchema,exteriorDoorSchema,entranceSchema,verandaSchema,siteSchema} from './spec';
/** Transport accepts identifiers for deterministic canonicalization; internal schemas remain strict. */
const wireId=z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/).describe('Stable lowercase identifier, at most 40 characters; prefer hyphens, never spaces.');
export const directionProviderSchema=directionSchema.extend({palette:directionSchema.shape.palette.extend({roofColor:directionSchema.shape.palette.shape.roofColor.unwrap().nullable()})});
export const massingProviderSchema=stageSchemas[2].extend({blocks:z.array(stageSchemas[2].shape.blocks.element.extend({id:wireId,open:z.boolean()})).min(1).max(12)});
export const exteriorProviderSchema=stageSchemas[4].extend({roofs:z.record(wireId,stageSchemas[4].shape.roofs.valueType),exterior:exteriorSchema.extend({
 doors:z.array(exteriorDoorSchema.extend({id:wireId,room:wireId})).max(8),entrance:entranceSchema.extend({door:wireId}),verandas:z.array(verandaSchema.extend({id:wireId,block:wireId})).max(4),
})});
export const siteProviderSchema=stageSchemas[5].extend({finishes:z.record(wireId,stageSchemas[5].shape.finishes.valueType),siteWork:siteSchema.extend({pool:siteSchema.shape.pool.unwrap().extend({sourceIntent:wireId.optional()}),
 lawns:z.array(siteSchema.shape.lawns.element.extend({id:wireId})).max(16),beds:z.array(siteSchema.shape.beds.element.extend({id:wireId})).max(10),trees:z.array(siteSchema.shape.trees.element.extend({id:wireId})).max(40),hedges:z.array(siteSchema.shape.hedges.element.extend({id:wireId})).max(14),paths:z.array(siteSchema.shape.paths.element.extend({id:wireId})).max(16),
})});
