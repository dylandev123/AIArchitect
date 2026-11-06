import {expect, it} from 'vitest';
import {z} from 'zod';
import {strictSchemaIssues} from './strictSchema';
import {exteriorProviderSchema} from './providerSchemas';
import {exteriorDesignV2Schema} from './exterior';
import {siteDesignV2Schema} from './siteContract';
const json = (s: z.ZodType) => z.toJSONSchema(s, {io: 'input', unrepresentable: 'any'});
it('accepts the strict v2 Stage 4/5 contracts and flags the old record-based Stage 4 schema', () => {
  expect(strictSchemaIssues(json(exteriorDesignV2Schema))).toEqual([]);
  expect(strictSchemaIssues(json(siteDesignV2Schema))).toEqual([]);
  expect(strictSchemaIssues(json(exteriorProviderSchema)).length).toBeGreaterThan(0);
  expect(strictSchemaIssues({type: 'object', properties: {a: {type: 'string'}}, required: [], additionalProperties: false})).toEqual(['$.a: every property must be required']);
});
