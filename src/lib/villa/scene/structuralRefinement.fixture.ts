/** Offline mock transaction, never Terra output or evidence of AI design quality. */
import { exteriorStudy } from './exteriorFirst.fixture';
import { REVIEW_CATEGORIES } from './generationReview';
export function structuralRefinementMock() {
 const scene = exteriorStudy(false).scene;
 const review = {
  assessments: REVIEW_CATEGORIES.map(category => ({ category, observation: 'OFFLINE MOCK: basic exterior study.' })),
  findings: [{ severity: 'major' as const, category: 'arrival facade' as const, targetIds: ['entry-canopy','gable-roof'], observation: 'OFFLINE MOCK: shallow entrance and undifferentiated roof.', suggestedChange: 'Construct a deeper supported entrance and facade layers; reprofile the roof.' }],
  refinement: { findingIndex: 0, targetIds: ['entry-canopy','gable-roof'], newIds: ['entry-roof','entry-west-pier','entry-east-pier','arrival-west-screen','arrival-east-screen'], instruction: 'OFFLINE MOCK: replace the canopy with a supported deeper portal, introduce paired timber facade screens and change the main roof to hip.' },
 };
 const output = { name: scene.name, summary: 'Offline structural refinement mock; no AI calls.', unsupported: [], operations: [
  { op: 'remove', id: 'entry-canopy' },
  { op: 'replace', id: 'gable-roof', element: { ...scene.elements.find(e=>e.id==='gable-roof')!, roofForm: 'hip' } },
  ...[
   {id:'entry-roof',kind:'roof',at:[0,3.2,-5.3],size:[5,.25,3.1],material:'limestone'},
   {id:'entry-west-pier',kind:'volume',at:[-2.15,1.6,-6.3],size:[.3,2.8,.3],material:'limestone'},
   {id:'entry-east-pier',kind:'volume',at:[2.15,1.6,-6.3],size:[.3,2.8,.3],material:'limestone'},
   {id:'arrival-west-screen',kind:'screen',at:[-3.3,1.65,-4.35],size:[2,2.9,.2],material:'timber',panels:8},
   {id:'arrival-east-screen',kind:'screen',at:[3.3,1.65,-4.35],size:[2,2.9,.2],material:'timber',panels:8},
  ].map(element => ({op:'add',element:{label:element.id,...element}})),
 ] };
 return {scene,review,output};
}
