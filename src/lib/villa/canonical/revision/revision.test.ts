/** Offline verification of bounded canonical plan revision. Every "model response" here is a labelled mock;
 * nothing is evidence that a model can revise its own work. */
import {describe,expect,it,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const mocks=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>({})}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_m:unknown,call:()=>unknown)=>call()}));
import {Output} from 'ai';
import {analysePlan} from './analysis';
import {planViewModel,renderPlanSvg,renderPlanPng} from './planView';
import {diffPlans,checkProgramme,indicatorsOf} from './evaluate';
import {assessRevision,authorizeRevisionExperiment,buildRevisionRequest,reviseCanonicalPlan,sceneFromAcceptedRevision,aiSdkRevisionSubmit,RevisionBudgetExhausted,revisionResponseSchema,type RevisionSubmit} from './revise';
import {compileArchitecturalPlan,type ArchitecturalPlan} from '../plan';
import {mansionBytes,mansionOriginal,mansionCoordinateRepairMock,mansionStillInvalidMock,weakRowHouse,rowHouseRedesignMock,compactTwoLevelFaulty,compactTwoLevelRepairMock} from './revision.fixture';
import {stageSceneOperations,validateScene} from '../../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
import type {SchemaNode} from '../../scene/strictSchema';
const revised=(plan:ArchitecturalPlan,kind:'repair'|'redesign'='redesign')=>({status:'revised',revisionKind:kind,concept:'Mock concept',plan,addressed:[{group:'x',response:'mock'}],changes:[{entity:'mock',change:'mock',reason:'mock'}],retained:['programme'],limitations:[]});
const auth=(scope:'repair-only'|'redesign-permitted'='redesign-permitted',id='exp')=>authorizeRevisionExperiment({experimentId:id,authorizedBy:'test',scope});
afterEach(()=>vi.unstubAllGlobals());

describe('the saved mansion is read, never modified',()=>{
 it('the saved response is byte-identical to the diagnosed source',()=>{
  const findings=JSON.parse(readFileSync('docs/architecture/canonical-diagnosis-2026-11-02/findings.json','utf8'));
  expect(createHash('sha256').update(mansionBytes()).digest('hex')).toBe(findings.sourceProposalSha256);
 });
 it('analysis does not mutate the plan',()=>{const p=mansionOriginal(),before=JSON.stringify(p);analysePlan(p);renderPlanSvg(p);expect(JSON.stringify(p)).toBe(before);});
 it('groups all 14 findings by cause (53 before eaves were resolved per edge, 57 before explicit-side doors were fitted into the wall they share), with consequences kept apart from independent decisions',()=>{
  const a=analysePlan(mansionOriginal());
  expect(a.errorCount).toBe(14);expect(a.groups.flatMap(g=>g.findings).length).toBe(14); // the four explicit-side doors that missed their shared wall are no longer findings; 39 roof findings were overhangs on edges wholly against a neighbour (now built flush)
  const chain=a.groups.filter(g=>g.cause==='chain-collision');expect(chain).toHaveLength(1);
  expect(chain[0].findings).toHaveLength(3);expect(chain[0].id).toContain('west-private-hall');expect(chain[0].involves).toEqual(expect.arrayContaining(['kitchen','pantry','west-suite-1','west-suite-2']));
  expect(a.groups.find(g=>g.cause==='roof-eaves')!.findings).toHaveLength(5); // 44: the five left are partial abutments, a projection beside an arrival court and rooms that overlap
  expect(a.groups.filter(g=>g.cause==='consequence').length).toBeGreaterThan(0);
  expect(a.groups.filter(g=>g.cause!=='consequence').length).toBeLessThanOrEqual(5);
  for(const g of a.groups)expect(g.findings.length).toBeGreaterThan(0);
 });
 it('measured table reproduces the diagnosis extents and the site margin',()=>{
  const a=analysePlan(mansionOriginal()),k=a.rooms.find(r=>r.id==='kitchen')!,s=a.rooms.find(r=>r.id==='west-suite-1')!;
  expect([k.x0,k.x1,k.z0,k.z1]).toEqual([-14,-4,-21,-15]);expect([s.x0,s.x1,s.z0,s.z1]).toEqual([-10,-3,-21,-14]);
  expect(a.rooms).toHaveLength(21);expect(a.site.width).toBe(90);
  expect(a.dependencies.some(d=>d.kind==='stair')).toBe(false);
 });
 it('reports a later-stage compiler limit that the saved plan would hit, only when its values reach it',()=>{
  expect(analysePlan(mansionOriginal()).latentLimits.join(' ')).toMatch(/0\.45 m.*0\.36 m/);
  expect(analysePlan(mansionCoordinateRepairMock()).latentLimits).toEqual([]);
  expect(()=>compileArchitecturalPlan(mansionCoordinateRepairMock())).not.toThrow();
 });
 it('reads the concept as redesign-worthy and says why, without prescribing a layout',()=>{
  const a=analysePlan(mansionOriginal());
  expect(a.disposition.kind).toBe('redesign');
  const fired=a.signals.filter(s=>s.fired).map(s=>s.id);expect(fired).toEqual(expect.arrayContaining(['repeated-cells','uniform-roofs','no-section-variation']));
  expect(JSON.stringify(a.groups.map(g=>g.decisionRequired))).not.toMatch(/\bx -?\d|move .* to/i);
 });
});

describe('planning drawing represents the authored geometry',()=>{
 it('every space appears once at its measured position and size',()=>{
  const p=mansionOriginal(),a=analysePlan(p),view=planViewModel(p,a),svg=renderPlanSvg(p,a);
  const rooms=view.levels.flatMap(l=>l.shapes.filter(s=>s.kind==='room'));expect(rooms).toHaveLength(p.spaces.length);
  for(const r of rooms){const m=a.rooms.find(x=>x.id===r.id)!;expect([r.x,r.z,r.width,r.depth]).toEqual([m.x0,m.z0,m.width,m.depth]);expect(svg).toContain(`data-room="${r.id}" data-x="${Number(r.x.toFixed(1))}" data-z="${Number(r.z.toFixed(1))}" data-w="${Number(r.width.toFixed(1))}" data-d="${Number(r.depth.toFixed(1))}"`);}
 });
 it('marks the three measured overlaps, the roof-eave conflicts, misfit openings and the site',()=>{
  const p=mansionOriginal(),a=analysePlan(p),shapes=planViewModel(p,a).levels[0].shapes;
  expect(shapes.filter(s=>s.kind==='overlap')).toHaveLength(3);
  const k=shapes.find(s=>s.kind==='overlap'&&s.id==='kitchen/west-suite-1')!;expect([k.width,k.depth]).toEqual([6,6]);
  expect(shapes.filter(s=>s.kind==='roof-conflict').length).toBeGreaterThan(10);
  expect(shapes.filter(s=>s.kind==='roof')).toHaveLength(p.roofs.length);
  expect(shapes.filter(s=>s.kind==='opening'&&s.flags?.includes('misfit')).map(s=>s.id)).toEqual(['living-east-window']); // explicit-side doors are now fitted into the wall they share; the window on a shared wall remains
  const site=shapes.find(s=>s.kind==='site')!;expect([site.width,site.depth]).toEqual([90,75]);
  expect(shapes.filter(s=>s.kind==='pool'||s.kind==='lawn').some(s=>s.flags?.includes('conflict'))).toBe(true);
 });
 it('shows every level, ghosts for stacked rooms, and stairs for a multilevel house',()=>{
  const p=compactTwoLevelRepairMock(),view=planViewModel(p);
  expect(view.levels.map(l=>l.id)).toEqual(['ground','upper']);
  expect(view.levels[1].shapes.some(s=>s.kind==='ghost')).toBe(true);
  expect(view.levels.every(l=>l.shapes.some(s=>s.kind==='stair'))).toBe(true);
  const svg=renderPlanSvg(p);expect(svg).toContain('data-level="upper"');expect(svg).toContain('UP ascent');expect(svg).toContain('DN ascent');
  expect(view.levels[1].shapes.filter(s=>s.kind==='room').map(s=>s.id).sort()).toEqual(['gallery','sleep-room']);
 });
 it('flags rooms that cannot be reached from the arrival',()=>{
  const p=compactTwoLevelRepairMock();p.portals=p.portals.filter(x=>x.id!=='day-door');
  const sh=planViewModel(p).levels[0].shapes.find(s=>s.id==='day-room'&&s.kind==='room')!;expect(sh.flags).toContain('unreachable');
 });
 it('renders a PNG for image-capable providers',async()=>{
  const {png}=await renderPlanPng(mansionOriginal());expect(png.subarray(0,4).toString('hex')).toBe('89504e47');expect(png.length).toBeGreaterThan(5000);
 });
});

describe('the revision request carries the whole picture and no proposed layout',()=>{
 it('contains brief, plan, measurements, dependencies, all findings, signals and the drawing',async()=>{
  const p=mansionOriginal(),req=await buildRevisionRequest({brief:'BRIEF-TEXT',plan:p,image:true}),c=req.context as Record<string,any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(c.brief).toBe('BRIEF-TEXT');expect(c.currentPlan).toEqual(p);
  expect(c.measured.rooms.rows).toHaveLength(21);expect(c.findings.groupedByCause.flatMap((g:{findings:unknown[]})=>g.findings)).toHaveLength(14);expect(c.findings.groupedByCause.length).toBeGreaterThan(3);
  expect(c.architecturalWeaknesses.disposition.kind).toBe('redesign');expect(c.dependencies.adjacencyAndConnections.length).toBeGreaterThan(20);
  expect(req.png!.subarray(0,4).toString('hex')).toBe('89504e47');expect(req.messages[0].content.some(x=>x.type==='image')).toBe(true);
  expect(req.system).toContain('PLAN REVISION');expect(req.system).toContain('architectural-plan-1');
  expect(JSON.stringify(c)).not.toMatch(/proposedPlan|suggestedPlan|correctedPlacement/);
  const again=await buildRevisionRequest({brief:'BRIEF-TEXT',plan:p,image:true});expect(again.sha256.text).toBe(req.sha256.text);
 });
 it('omits the image when the provider cannot take one',async()=>{
  const req=await buildRevisionRequest({brief:'b',plan:compactTwoLevelFaulty(),image:false});expect(req.png).toBeUndefined();expect(req.messages[0].content).toHaveLength(1);expect((req.context as {drawing:string}).drawing).toMatch(/No drawing/);
 });
});

describe('response parsing',()=>{
 it('accepts a revised plan and a decision-required answer, rejects anything else',()=>{
  expect(revisionResponseSchema.safeParse(revised(weakRowHouse())).success).toBe(true);
  expect(revisionResponseSchema.safeParse({status:'decision-required',decisions:['curved wall']}).success).toBe(true);
  expect(revisionResponseSchema.safeParse({status:'revised',plan:weakRowHouse()}).success).toBe(false);
  expect(revisionResponseSchema.safeParse({...revised(weakRowHouse()),operations:[]}).success).toBe(false);
 });
 it('malformed output stops with a schema reason and compiles nothing',()=>{
  const a=assessRevision(weakRowHouse(),{status:'revised',plan:{version:'x'}},'redesign-permitted');
  expect(a.stopReasons).toEqual(['schema-invalid']);expect(a.revisedAnalysis).toBeUndefined();
 });
 it('decision-required is preserved as an unrepresentable stop, not simplified',()=>{
  const a=assessRevision(mansionOriginal(),{status:'decision-required',decisions:['A curved gallery wall cannot be represented.']},'redesign-permitted');
  expect(a.stopReasons).toEqual(['unrepresentable']);expect(a.checks.find(c=>c.id==='representable')!.detail).toContain('curved');
 });
});

describe('validation distinguishes repair from redesign and never mistakes validity for success',()=>{
 it('a valid coordinate-only repair of the mansion is physically fixed but architecturally unchanged',()=>{
  const mock=mansionCoordinateRepairMock();expect(() => compileArchitecturalPlan(mock)).not.toThrow();
  const a=assessRevision(mansionOriginal(),revised(mock,'repair'),'redesign-permitted');
  expect(a.revisedAnalysis!.errorCount).toBe(0);
  expect(a.checks.find(c=>c.id==='physical-validity')!.ok).toBe(true);expect(a.checks.find(c=>c.id==='programme-preserved')!.ok).toBe(true);
  expect(a.checks.find(c=>c.id==='improvement-demonstrated')!.ok).toBe(false);
  expect(a.status).toBe('stopped');expect(a.stopReasons).toEqual(['no-demonstrated-improvement']);
  expect(a.revisedAnalysis!.disposition.kind).toBe('redesign');
  expect(a.dimensions!.find(d=>d.dimension==='composition')!.verdict).toBe('unchanged');expect(a.dimensions!.find(d=>d.dimension==='ambition')!.verdict).not.toBe('improved');
 });
 it('an impossible revision is rejected with every remaining failure group reported',()=>{
  const a=assessRevision(mansionOriginal(),revised(mansionStillInvalidMock(),'repair'),'redesign-permitted');
  expect(a.stopReasons).toContain('physically-invalid');expect(a.revisedAnalysis!.errorCount).toBeGreaterThan(10);expect(a.remainingCauses).toEqual(expect.arrayContaining(['chain-collision']));
 });
 it('an unchanged plan demonstrates nothing',()=>{
  const a=assessRevision(mansionOriginal(),revised(mansionOriginal()),'redesign-permitted');expect(a.diff!.unchanged).toBe(true);expect(a.stopReasons).toContain('no-demonstrated-improvement');
 });
 it('a different concept with the same programme is accepted for construction, with dimensions reported separately',()=>{
  const original=weakRowHouse(),a0=analysePlan(original);expect(a0.errorCount).toBe(0);expect(a0.disposition.kind).toBe('redesign');
  const a=assessRevision(original,revised(rowHouseRedesignMock()),'redesign-permitted',a0);
  expect(a.stopReasons).toEqual([]);expect(a.status).toBe('accepted-for-construction');
  expect(a.dimensions!.map(d=>d.dimension)).toEqual(['composition','spatialCoherence','ambition']);
  expect(a.dimensions!.find(d=>d.dimension==='composition')!.verdict).toMatch(/improved|mixed/);
  expect(a.statement).toMatch(/NOT a finding of architectural success/);
  expect(a.diff!.changeShare).toBeGreaterThan(.8);expect(a.programme!.preserved).toBe(true);
  expect(a.before!.composition.repeatedCellShare).toBeGreaterThan(a.after!.composition.repeatedCellShare);
 });
 it('losing planned programme stops the revision even when the plan is valid and different',()=>{
  const p=rowHouseRedesignMock();p.spaces=p.spaces.filter(s=>s.id!=='bed-6');p.portals=p.portals.filter(x=>!x.id.startsWith('bed-6'));p.roofs=p.roofs.filter(r=>r.space!=='bed-6');
  const a=assessRevision(weakRowHouse(),revised(p),'redesign-permitted');
  expect(a.revisedAnalysis!.errorCount).toBe(0);expect(a.stopReasons).toEqual(['programme-not-preserved']);expect(a.programme!.lost).toEqual([{category:'bedroom',before:6,after:5}]);
 });
 it('a repair-only authorization refuses a redesign',()=>{
  const a=assessRevision(weakRowHouse(),revised(rowHouseRedesignMock()),'repair-only');expect(a.stopReasons).toContain('concept-exceeds-bounds');
 });
 it('an honest repair of a repair-worthy plan resolves its causes and may proceed',()=>{
  const original=compactTwoLevelFaulty(),a0=analysePlan(original);expect(a0.disposition.kind).toBe('repair');
  const a=assessRevision(original,revised(compactTwoLevelRepairMock(),'repair'),'repair-only',a0);
  expect(a.stopReasons).toEqual([]);expect(a.resolvedCauses).toEqual(expect.arrayContaining(['chain-collision']));expect(a.remainingCauses).toEqual([]);
 });
 it('diff and measured geometry change are computed from the plans',()=>{
  const d=diffPlans(compactTwoLevelFaulty(),compactTwoLevelRepairMock());
  expect(d.entities.spaces.changed.map(c=>c.id)).toEqual(['day-room']);expect(d.entities.portals.removed).toEqual(['bad-window']);
  expect(d.geometry.moved.map(m=>m.id)).toContain('day-room');
  expect(checkProgramme(weakRowHouse(),rowHouseRedesignMock()).gained.map(g=>g.category)).toContain('terrace');
  expect(indicatorsOf(weakRowHouse()).composition.repeatedCellShare).toBeGreaterThan(.5);
 });
});

describe('one model-produced revision per authorized experiment',()=>{
 it('spends the grant once; a second request never reaches the provider',async()=>{
  const submit=vi.fn<RevisionSubmit>(async()=>({output:revised(compactTwoLevelRepairMock(),'repair')})),grant=auth('repair-only','one');
  const record=await reviseCanonicalPlan({authorization:grant,brief:'b',plan:compactTwoLevelFaulty(),submit});
  expect(record.provenance.providerCalls).toBe(1);expect(record.accepted).toBe(true);
  await expect(reviseCanonicalPlan({authorization:grant,brief:'b',plan:compactTwoLevelFaulty(),submit})).rejects.toBeInstanceOf(RevisionBudgetExhausted);
  expect(submit).toHaveBeenCalledTimes(1);
 });
 it('a failed provider call still consumes the revision; there is no retry',async()=>{
  const submit=vi.fn<RevisionSubmit>(async()=>{throw Error('network down');}),grant=auth();
  const record=await reviseCanonicalPlan({authorization:grant,brief:'b',plan:mansionOriginal(),submit});
  expect(record.assessment.stopReasons).toEqual(['provider-failure']);expect(record.accepted).toBe(false);
  await expect(reviseCanonicalPlan({authorization:grant,brief:'b',plan:mansionOriginal(),submit})).rejects.toBeInstanceOf(RevisionBudgetExhausted);expect(submit).toHaveBeenCalledTimes(1);
 });
 it('an unauthenticated experiment cannot be created',()=>{expect(()=>authorizeRevisionExperiment({experimentId:' ',authorizedBy:'x',scope:'repair-only'})).toThrow();});
 it('a contract-invalid original costs nothing',async()=>{
  const submit=vi.fn<RevisionSubmit>(),record=await reviseCanonicalPlan({authorization:auth(),brief:'b',plan:{version:'nope'},submit});
  expect(submit).not.toHaveBeenCalled();expect(record.assessment.stopReasons).toEqual(['original-invalid-contract']);expect(record.provenance.providerCalls).toBe(0);
 });
 it('the record preserves the original unchanged, the raw response, the diff and provenance',async()=>{
  const original=mansionOriginal(),json=JSON.stringify(original),output=revised(mansionCoordinateRepairMock(),'repair');
  const record=await reviseCanonicalPlan({authorization:auth(),brief:'BRIEF',plan:original,model:'mock',submit:async()=>({output,raw:JSON.stringify(output),usage:{totalTokens:1}})});
  expect(JSON.stringify(record.original.plan)).toBe(json);expect(record.original.sha256).toBe(createHash('sha256').update(json).digest('hex'));expect(JSON.stringify(original)).toBe(json);
  expect(record.response.raw).toBe(JSON.stringify(output));expect(record.assessment.diff!.entities.spaces.changed.length).toBeGreaterThan(0);expect(record.analysis.errorCount).toBe(14);
  expect(record.provenance).toMatchObject({providerCalls:1,maxModelRevisions:1,model:'mock'});expect(record.request.sha256.all).toHaveLength(64);expect(record.accepted).toBe(false);
  expect(()=>sceneFromAcceptedRevision(record)).toThrow(/accepted/);
  expect(JSON.parse(JSON.stringify(record)).version).toBe('canonical-plan-revision-1');
 });
});

describe('an accepted revision compiles into an editable, saved, undoable scene',()=>{
 it('weak row house → redesign mock: original scene, revised scene, edit, reload, Undo/Redo',async()=>{
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  const original=weakRowHouse(),before=validateScene(compileArchitecturalPlan(original).scene);
  const record=await reviseCanonicalPlan({authorization:auth(),brief:'Six bedrooms, living, kitchen',plan:original,image:true,submit:async req=>{expect(req.png).toBeDefined();return {output:revised(rowHouseRedesignMock())};}});
  expect(record.accepted).toBe(true);expect(record.request.imageIncluded).toBe(true);
  const compiled=sceneFromAcceptedRevision(record),scene=validateScene(compiled.scene);
  expect(scene.architecturalPlan).toEqual(rowHouseRedesignMock());expect(scene.generationStatus).toBe('pending-visual-review');expect(Object.keys(compiled.provenance).length).toBe(scene.elements.length);
  expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  const target=scene.elements.find(e=>e.kind==='roof')!,edited=stageSceneOperations(scene,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const store=useProjectStore.getState(),project=store.createProject('Revision','house','direct-scene');
  store.appendVersion(project.id,'Original plan (compiled)',JSON.stringify(before));store.appendVersion(project.id,'Plan revision (redesign)',JSON.stringify(scene));store.appendVersion(project.id,'Edited roof',JSON.stringify(edited));
  const current=()=>validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson));
  expect(current()).toEqual(edited);store.undo(project.id);expect(current()).toEqual(scene);store.undo(project.id);expect(current()).toEqual(before);
  expect(current().architecturalPlan).toEqual(original);store.redo(project.id);store.redo(project.id);expect(current()).toEqual(edited);
 });
 it('compact two-level house: repair record compiles with its stair and levels intact',async()=>{
  const record=await reviseCanonicalPlan({authorization:auth('repair-only'),brief:'Compact two-level home',plan:compactTwoLevelFaulty(),submit:async()=>({output:revised(compactTwoLevelRepairMock(),'repair')})});
  expect(record.accepted).toBe(true);const scene=validateScene(sceneFromAcceptedRevision(record).scene),plan=scene.architecturalPlan as ArchitecturalPlan;
  expect(plan.levels).toHaveLength(2);expect(scene.elements.some(e=>/ascent/.test(e.id))).toBe(true);
 });
 it('a rejected revision yields no scene and keeps the failure as evidence',async()=>{
  const record=await reviseCanonicalPlan({authorization:auth(),brief:'b',plan:mansionOriginal(),submit:async()=>({output:revised(mansionStillInvalidMock(),'repair')})});
  expect(record.accepted).toBe(false);expect(record.revised!.plan).toEqual(mansionStillInvalidMock());expect(record.assessment.revisedErrorCount).toBeGreaterThan(10);expect(()=>sceneFromAcceptedRevision(record)).toThrow();
 });
});

describe('the live transport shape (mocked provider)',()=>{
 function encode(value:unknown,node:SchemaNode):unknown{
  if(node.anyOf){const branches=node.anyOf as SchemaNode[];const branch=branches.find(b=>{const p=b.properties as Record<string,SchemaNode>|undefined;return p?.status?.const===(value as SchemaNode)?.status;})??branches.find(b=>b.type!=='null')!;return encode(value,branch);}
  if(Array.isArray(value)&&node.items)return value.map(v=>encode(v,node.items as SchemaNode));
  if(value&&typeof value==='object'&&node.properties)return Object.fromEntries(Object.entries(node.properties as Record<string,SchemaNode>).map(([k,p])=>[k,(value as SchemaNode)[k]===undefined?null:encode((value as SchemaNode)[k],p)]));
  return value;
 }
 it('sends one strict-schema call with the drawing and parses the null-encoded wire response',async()=>{
  const usage={inputTokens:0,outputTokens:0,totalTokens:0,inputTokenDetails:{noCacheTokens:0,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:0,reasoningTokens:0}};
  let sent:{messages:{content:{type:string}[]}[];maxRetries:number;providerOptions:{openai:{strictJsonSchema:boolean}}}|undefined;mocks.generate.mockReset();
  mocks.generate.mockImplementation(async(args:{output:ReturnType<typeof Output.object>;messages:{content:{type:string}[]}[];maxRetries:number;providerOptions:{openai:{strictJsonSchema:boolean}}})=>{
   sent=args;const format=await args.output.responseFormat;if(format?.type!=='json'||!format.schema)throw Error('no schema');
   const raw=JSON.stringify(encode({result:revised(compactTwoLevelRepairMock(),'repair')},format.schema as SchemaNode));
   return {finishReason:'stop',totalUsage:usage,output:await args.output.parseCompleteOutput({text:raw},{response:{id:'o',timestamp:new Date(0),modelId:'m'},usage,finishReason:'stop'})};
  });
  const record=await reviseCanonicalPlan({authorization:auth('repair-only'),brief:'b',plan:compactTwoLevelFaulty(),image:true,model:'mock',submit:aiSdkRevisionSubmit({model:'mock',signal:new AbortController().signal})});
  expect(mocks.generate).toHaveBeenCalledTimes(1);expect(sent!.maxRetries).toBe(0);expect(sent!.providerOptions.openai.strictJsonSchema).toBe(true);
  expect(sent!.messages[0].content.map(c=>c.type)).toEqual(['text','image']);
  expect(record.assessment.checks.filter(c=>!c.ok),JSON.stringify(record.response)).toEqual([]);expect(record.accepted).toBe(true);
 });
});
