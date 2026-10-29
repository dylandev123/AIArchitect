import { describe, expect, it, vi } from 'vitest';
import { defaultVilla } from './design';
import { facadeExamples } from './facade-examples';
import { assertReviewBaseline, inspectCapture, requestReviewProposal, stageReviewEdit, reviewSchema, visualReviewRequestSchema } from './visual-review';
// Header fixture tests header validation; browser QA checks decoded, nonblank renders.
function pngHeader(width = 640, height = 360) {
  const header = Buffer.alloc(36);
  Buffer.from('\x89PNG\r\n\x1a\n', 'binary').copy(header);
  header.write('IHDR', 12); header.writeUInt32BE(width, 16); header.writeUInt32BE(height, 20);
  return `data:image/png;base64,${header.toString('base64')}`;
}
const output = { changes: { exterior: 'sand' }, summary: 'Finish study', unsupported: [] };
const review = { weaknesses: ['rhythm', 'hierarchy', 'arrival'], improvement: 'Change exterior to sand', scope: ['exterior'] };
const payload = () => ({ brief: 'Original island villa brief', current: defaultVilla('modern'), unresolved: ['Exterior massing only; no interior layout'], images: [pngHeader(), pngHeader(), pngHeader()] as [string, string, string] });
describe('visual review staging', () => {
  it('stages through the executor without changing the original; accepts route metadata', () => {
    const current = defaultVilla('modern'), before = structuredClone(current);
    const result = stageReviewEdit(current, 'sand finish', { ...output, config: {}, model: 'mock', usage: {} }, ['exterior']);
    expect(current).toEqual(before);
    expect(result.config).toEqual({ ...before, exterior: 'sand' });
  });
  it('rejects invalid and overbroad edits without mutating original', () => {
    const current = defaultVilla('modern'), before = structuredClone(current);
    expect(() => stageReviewEdit(current, 'invalid', { ...output, changes: { levels: 20 } }, ['levels'])).toThrow();
    expect(() => stageReviewEdit(current, 'finish', { ...output, changes: { exterior: 'sand', scale: 1.02 } }, ['exterior'])).toThrow(/scope/);
    expect(() => stageReviewEdit(current, 'broad', { ...output, changes: { exterior: 'sand', pool: { enabled: false } } }, ['exterior', 'pool.enabled'])).toThrow();
    expect(current).toEqual(before);
  });
  it('preserves every unrelated form, footprint edge, storey and site feature', () => {
    const current = facadeExamples()[0], original = structuredClone(current), form = structuredClone(current.forms![0]);
    form.facades![0].treatment = 'loggia';
    const result = stageReviewEdit(current, 'first section loggia', { ...output, changes: { forms: [{ type: 'put', form }] } }, ['forms.0.facades.0.treatment']);
    const expected = structuredClone(original); expected.forms![0].facades![0].treatment = 'loggia';
    expect(result.config).toEqual(expected); expect(current).toEqual(original);
    const broad = structuredClone(form); broad.upper!.height += .1;
    expect(() => stageReviewEdit(current, 'first section', { ...output, changes: { forms: [{ type: 'put', form: broad }] } }, ['forms.0.facades.0.treatment'])).toThrow(/scope/);
  });
  it('rejects component removal and identity changes even inside declared scope', () => {
    const current = facadeExamples()[0];
    expect(() => stageReviewEdit(current, 'remove', { ...output, changes: { forms: [{ type: 'remove', id: current.forms![1].id }] } }, ['forms'])).toThrow();
    expect(() => stageReviewEdit(defaultVilla('modern'), 'disable pool', { ...output, changes: { pool: { enabled: false } } }, ['pool.enabled'])).toThrow(/disable/);
  });
  it('rejects stale proposals including edits that restore the same configuration', () => {
    const current = defaultVilla('modern'), baseline = JSON.stringify(current);
    expect(() => assertReviewBaseline(current, 3, baseline, 2)).toThrow(/changed/);
    expect(() => assertReviewBaseline({ ...current, exterior: 'sand' }, 2, baseline, 2)).toThrow();
    expect(() => assertReviewBaseline(current, 2, baseline, 2)).not.toThrow();
  });
  it('validates capture dimensions and request contents', () => {
    expect(inspectCapture(pngHeader())).toEqual({ width: 640, height: 360 });
    expect(() => inspectCapture(pngHeader(320, 180))).toThrow(/640/);
    expect(() => inspectCapture('data:image/png;base64,YWJj')).toThrow();
    expect(visualReviewRequestSchema.parse(payload()).brief).toBe('Original island villa brief');
    expect(visualReviewRequestSchema.safeParse({ ...payload(), images: [pngHeader()] }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...review, weaknesses: ['one'] }).success).toBe(true);
  });
  it('uses exactly one review and one edit with mocks and retains the original brief', async () => {
    const input = payload(), original = structuredClone(input);
    const reviewCall = vi.fn(async () => review), editCall = vi.fn(async () => output);
    const result = await requestReviewProposal(input, reviewCall, editCall, () => true);
    expect(reviewCall).toHaveBeenCalledTimes(1); expect(editCall).toHaveBeenCalledTimes(1);
    expect(reviewCall.mock.calls[0]).toBeDefined();
    expect(result.staged!.config).toMatchObject({ exterior: 'sand' });
    expect(input).toEqual(original); // Rejecting/discarding this staged result leaves current intact.
  });
  it('never retries malformed reviews or failed staging', async () => {
    const editCall = vi.fn(async () => output), reviewCall = vi.fn(async () => ({}));
    await expect(requestReviewProposal(payload(), reviewCall, editCall, () => true)).rejects.toThrow();
    expect(reviewCall).toHaveBeenCalledTimes(1); expect(editCall).not.toHaveBeenCalled();
    const badEdit = vi.fn(async () => ({ ...output, changes: { exterior: 'sand', scale: 1.02 } }));
    await expect(requestReviewProposal(payload(), async () => review, badEdit, () => true)).rejects.toThrow(/scope/);
    expect(badEdit).toHaveBeenCalledTimes(1);
  });
  it('does not spend on an edit after the original changes during review', async () => {
    let current = true;
    const edit = vi.fn(async () => output);
    await expect(requestReviewProposal(payload(), async () => { current = false; return review; }, edit, () => current)).rejects.toThrow(/No edit/);
    expect(edit).not.toHaveBeenCalled();
  });
});

it('skips the paid edit when review finds no supported improvement',async()=>{
 const edit=vi.fn();const result=await requestReviewProposal(payload(),async()=>({weaknesses:[],improvement:null,scope:[]}),edit,()=>true);
 expect(result.staged).toBeNull();expect(edit).not.toHaveBeenCalled();expect(reviewSchema.safeParse({weaknesses:[],improvement:null,scope:['exterior']}).success).toBe(false);
});
