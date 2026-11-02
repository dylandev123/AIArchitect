import { expect, it } from 'vitest';
import { ARCHITECTURAL_DESIGN_GUIDE } from './designGuide';
import { SCENE_SYSTEM_PROMPT } from './terra';
import { elementFieldsSchema, operationSchema } from './model';

it('includes one authoritative guide and documents every executable construction kind and operation', () => {
    expect(SCENE_SYSTEM_PROMPT.split(ARCHITECTURAL_DESIGN_GUIDE)).toHaveLength(2);
    for (const kind of elementFieldsSchema.shape.kind.options) expect(SCENE_SYSTEM_PROMPT).toContain(kind);
    for (const operation of operationSchema.options) expect(SCENE_SYSTEM_PROMPT).toContain(operation.shape.op.value);
    expect(SCENE_SYSTEM_PROMPT).not.toContain('compose a clear primary residence with subordinate connected wings');
    expect(SCENE_SYSTEM_PROMPT.length).toBeLessThan(20000);
});
