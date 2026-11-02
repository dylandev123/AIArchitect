/** Offline postflight: exact replay, physical comparisons, usage and cost. No network. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveSceneResult,sceneRequestSchema} from '../src/lib/villa/scene/terra';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {computeCostUsd,DEFAULT_PRICING} from '../src/lib/ai/pricing';
globalThis.fetch=async()=>{throw Error('Postflight prohibits network');};
const dir='docs/architecture/complete-mansion-2026-10-30';
const read=(n:string)=>JSON.parse(readFileSync(`${dir}/${n}`,'utf8'));
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
const scene=read('scene.json'),input=sceneRequestSchema.parse(read('request.json')),output=read('normalized-output.json');
const replay=resolveSceneResult(input,output,scene.knowledgeEvidence);
assert.deepEqual(JSON.parse(JSON.stringify(replay.scene)),scene);
const wire=read('provider-response.exact.json'),usage=wire.usage,rate=DEFAULT_PRICING['gpt-5.6-terra'];
const localCostUsd=computeCostUsd('gpt-5.6-terra',{inputTokens:usage.input_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,outputTokens:usage.output_tokens},DEFAULT_PRICING)!;
const cacheWriteTokens=usage.input_tokens_details?.cache_write_tokens??0;
const cacheWritePremiumUsd=cacheWriteTokens*rate.input*.25/1e6;
save('usage-and-cost.json',{providerId:wire.id,model:wire.model,status:wire.status,usage,ratesUsdPerMillion:rate,localPricingEstimateUsd:localCostUsd,cacheWriteTokens,cacheWriteMultiplier:1.25,additionalCacheWritePremiumUsd:cacheWritePremiumUsd,estimatedBillIncludingCacheWritePremiumUsd:localCostUsd+cacheWritePremiumUsd,notes:['Actual provider token usage, not character estimates. Reasoning tokens are included in output_tokens and are not billed twice.','Local usage bookkeeping currently applies the standard input rate to cache writes; the separate estimate includes the 1.25x cache-write rate documented on the official model page during preparation.','Estimate only, not invoice reconciliation; no additional API calls made.']});
const g=sceneSpatialGeometry(scene),e=(id:string)=>g.map.get(id)!;
const privateDoors=['suite-west-glass-1','suite-east-glass-1'];
const plates=scene.elements.filter((p:typeof scene.elements[number])=>p.kind==='plate');
const historical=JSON.parse(readFileSync('docs/architecture/physical-programme/measurements.json','utf8')).results;
const baselines=historical.filter((x:{name:string})=>['25m-rejected-estate','massive-waterfront'].includes(x.name));
save('postflight.json',{
 paidProviderCalls:1,additionalPostflightProviderCalls:0,exactSceneReplay:true,sceneSha256:createHash('sha256').update(readFileSync(`${dir}/scene.json`)).digest('hex'),providerStatus:wire.status,finishReason:read('retained.diagnostics.json').providerMetadata.finishReason,
 construction:{authored:output.operations.length,expanded:read('expanded-operations.json').length,surviving:scene.elements.length,hardRelationshipFindings:read('relationship-findings.json').length,architecturalFindings:read('architecture-audit.json').findings.length},
 programme:read('measurements.json'),
 inspectedFloorClassification:{occupied:['main-living','suite-west','suite-east'],allPlates:plates.map((p:typeof scene.elements[number])=>({id:p.id,semanticType:p.semanticType,size:p.size,world:g.world(p)})),note:'All remaining plates are terrace, pool basin/coping/deck, drive or planting bed. No omitted upper occupied floor was found.'},
 coordination:{occupiedLevels:1,occupiedSlabTop:.2,mainSlabSize:e('main-living').size,privateSlabSizes:['suite-west','suite-east'].map(id=>({id,size:e(id).size,world:g.world(e(id))})),slabPlanGaps:3,roofEavePlanGaps:.7,privateDoors:privateDoors.map(id=>({id,world:g.world(e(id)),sill:g.bottom(e(id))})),privateRouteNote:'Suite doors exist in fitted front bays. No authored slab links or covered shared arrival court connects either side pavilion to the main pavilion or central drive. This does not claim walking across lawn is impossible.',terraceM2:28*2.35,canopyPlanM2:14*2.4,terraceToNearDeckGapM:0,poolWater:{size:e('infinity-pool-water').size,world:g.world(e('infinity-pool-water')),areaM2:11*15},poolFarWallTop:g.top(e('infinity-pool-wall-z-plus')),poolWaterTop:g.top(e('infinity-pool-water')),landscapeBedM2:2*3.5*10+2*3*15,landscapeNote:'Four flat sage plates, no planted/tree volumes.',centralRearWallWidth:28,centralRearDoorOpeningWidth:5.2,centralRearOpaqueWidth:22.8},
 comparison:baselines.map((b:{name:string;path:string;grossRectangleSumM2:number;principalFloorBoundsMetres:unknown;occupiedFloorDatums:number[]})=>({name:b.name,path:b.path,retainedGrossFloorM2:b.grossRectangleSumM2,occupiedBounds:b.principalFloorBoundsMetres,occupiedDatums:b.occupiedFloorDatums,areaDifferenceCurrentM2:776-b.grossRectangleSumM2,areaDifferencePercent:(776/b.grossRectangleSumM2-1)*100,measurementCaveat:'Historical totals are retained gross rectangular floor sums; current 776 m² is a unique union of three disjoint rectangular occupied slabs. None is certified net enclosed area.'})),
 firstDemonstratedLoss:'Architectural plan chooses a 776 m² single-level campus: one central pavilion and two identical subordinate suite pavilions, explicitly reserving rooms rather than constructing six suites and avoiding upper-level access. Authored first three operations select that composition through residential-wing assemblies. Exact replay shows no later massing loss. Numeric demand itself sums to 791 m², exceeding the plan and actual slabs by 15 m².',
 limitations:['No single-storey prohibition applies; the concern is repetitive massing, unconnected pavilions and undeveloped facades, not storey count alone.','15 m² demand discrepancy is 1.90% and is not by itself the reason for the unsuccessful luxury-design verdict.','Existing planted-volume semantic capabilities exist; this output did not use them. Model statements that planting geometry is unsupported are not established capability facts.','True pool hydraulics/engineering and accurate sloping/coastal terrain remain outside this experiment.']});
console.log(JSON.stringify({exactReplay:true,usage,localCostUsd,estimatedBillIncludingCacheWritePremiumUsd:localCostUsd+cacheWritePremiumUsd,areaM2:776,plannedDemandM2:791,paidProviderCalls:1}));
