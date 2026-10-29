import type { KnowledgeRevision } from './model';

export const VALUE_BANDS = [
 ['100k-250k',100000,'Compact efficiency','Prioritize useful shared living, short circulation, private sleeping rooms and durable repairable finishes. A modest sheltered threshold and simple coherent roof can carry the identity.'],
 ['250k-500k',250000,'Comfortable family living','Improve kitchen-dining relationships, storage and household privacy; consider a useful sheltered garden room. Give arrival legibility and use better materials selectively.'],
 ['500k-1m',500000,'Refined residential identity','Develop deliberate room proportions, daylight and a clear primary living volume. Consider a more private principal suite and coordinated facade reveals rather than unnecessary size.'],
 ['1m-3m',1000000,'Premium villa experience','Consider generous suites, discreet utility circulation, substantial shared entertaining and sheltered terraces. Coordinate entrance shelter, roof hierarchy and quality material junctions.'],
 ['3m-5m',3000000,'Luxury residential composition','Resolve an impressive but residential arrival, spacious connected living, acoustically private suites and selected recreation. Build facade depth and a coherent hierarchy of roofs and outdoor rooms.'],
 ['5m-10m',5000000,'High-end estate relationships','Consider distinct everyday and formal living zones, private guest relationships and exceptional sheltered indoor-outdoor connections. Coordinate service arrival, bedroom privacy and detailed envelope craftsmanship.'],
 ['10m-25m',10000000,'Grand luxury residence','Explore signature primary and secondary volumes, substantial suites and entertaining spaces, and carefully selected amenities. Arrival should establish a residential hierarchy; roof setbacks and deep facades should reinforce it.'],
 ['25m-50m',25000000,'Exceptional estate architecture','Test whether massing, suite privacy, substantial living and sheltered entertaining justify the brief. Consider guest facilities only when useful; coordinate bespoke arrival, sophisticated roof sections, facade depth and material balance.'],
 ['50m-100m-plus',50000000,'Trophy estate ambition','Consider estate-wide privacy, guest and service relationships, extraordinary craftsmanship and personalized experiences. Connect differentiated residential volumes through intentional arrival, gardens and sheltered circulation; avoid an indiscriminate amenity collection.'],
] as const;

/** Explicit money signals are separate from area, programme and local market evidence.
 * Bare $ is an assumption, not proof of USD. Other dollar currencies are not converted. */
export function monetaryBriefContext(brief: string) {
 const pattern = /(?:US\s*\$|USD\s*|\$)\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|m\b|k\b|b\b)?/gi;
 return [...brief.matchAll(pattern)].flatMap(match => {
  const before = brief.slice(Math.max(0, match.index! - 65), match.index).toLowerCase();
  const after = brief.slice(match.index! + match[0].length, match.index! + match[0].length + 65).toLowerCase();
  if (/(?:ec|ca|au|nz|sg|hk|xcd|cad|aud|nzd|sgd|hkd)\s*$/i.test(before)) return [];
  const unit = match[2]?.toLowerCase();
  const amount = Number(match[1].replace(/,/g, '')) * (/^(million|m)$/.test(unit ?? '') ? 1e6 : /^(billion|b)$/.test(unit ?? '') ? 1e9 : /^(thousand|k)$/.test(unit ?? '') ? 1e3 : 1);
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const labels = '(construction budget|construction cost|construction|building cost|build budget|build cost|building budget|land value|land cost|land|plot value|lot value|property market value|property value|market value|estate value|home value|property|budget)';
  const prefixLabel = before.match(new RegExp(labels + '\\s*(?:(?:of|is|around|approximately|about|worth|valued at)\\s*)?[:=]?\\s*$'))?.[1];
  const suffixLabel = after.match(new RegExp('^\\s*' + labels + '\\b'))?.[1];
  const label = prefixLabel ?? suffixLabel ?? '';
  const kind = /construction|building|build /.test(label) ? 'construction-budget' as const
   : /land|plot|lot /.test(label) ? 'land-value' as const
   : /property|market|estate value|home value/.test(label) ? 'property-value' as const
   : label === 'budget' ? 'budget-unspecified' as const : 'unspecified' as const;
  return [{amount, kind, currencyAssumption: /^\$/.test(match[0]) ? 'Bare $ assumed USD for qualitative guidance only; confirm currency and location.' : 'Explicit USD.', referenceOnly: true as const}];
 });
}
export function propertyValueContext(brief:string) {
 const signals = monetaryBriefContext(brief);
 const signal = signals.find(s => s.kind === 'property-value') ?? signals.find(s => s.kind === 'unspecified');
 if (!signal || signal.amount < 100000) return undefined;
 const band=[...VALUE_BANDS].reverse().find(b=>signal.amount>=b[1])!;
 return {...signal,profileId:`property-value-${band[0]}`};
}
export function propertyAmbitionGuidance(brief: string) {
 const money = monetaryBriefContext(brief);
 if (!money.length) return '';
 return '\nVALUE, COST AND PROGRAMME CONTEXT\n' + JSON.stringify(money) + '\nSeparate property market value, land value, construction budget, floor area, architectural ambition, material craftsmanship, amenities and regional costs. Never equate a $25m property with $25m of building work. When only value or an unspecified price is given, disclose the assumed ambition and currency in scaleRationale; choose programme from household, site and identity, without fixed area, storey or amenity requirements. A high land/location premium may coexist with a restrained home. Regional cost or valuation claims require dated reliable local evidence; asking prices and marketing are not verified transactions. Do not invent an exact valuation or cost allocation.\n';
}
export const PROPERTY_VALUE_GUIDANCE: KnowledgeRevision[] = VALUE_BANDS.map(([id,lower,title,detail],index)=>({
 id:`property-value-${id}`,title:`Property value reference: ${title}`,kind:'recipe',category:'property-value',recipeType:'principle',
 tags:['property value','residential ambition'],scales:[],
 when:`Approximate US$${lower.toLocaleString('en-US')}${index<8?`–${VALUE_BANDS[index+1][1].toLocaleString('en-US')}`:'–100,000,000+'} property market-value context; flexible design reference only.`,
 principles:detail+' Property market value includes land and location; it is not construction budget. Materials, craftsmanship and ambition are separate choices. Price alone determines neither floor area, bedrooms nor amenities. Avoid underdeveloped massing and unjustified scale; assess the actual household brief.',
 placement:'Connect arrival to shared living and sheltered outdoor space; protect suite privacy from guest and service routes. Scale and spatial complexity follow programme and site capacity, not a price formula.',
 combinations:'Compose with regional/style, room planning, entrance, facade, roof, materials and climate/site recipes. Waterfront entertaining may justify a pavilion, terraces or pool; urban sites may favor courts and privacy. Recreation, wellness, guest houses and garages are optional.',
 capabilities:'Build real supported floors, coordinated enclosures, room openings, entrance assemblies, roofs and terraces. A luxury label or collection of walls/windows/roof does not establish architectural completeness; cite changed element IDs and disclose missing access/interiors.',
 construction:{operations:['add','replace','move','resize','finish'],requiredKinds:['plate','wall','roof'],supports:'Coordinate supporting enclosure and roof/floor datums atomically; entrances and terraces need actual connections and access.',materials:'Select available materials and facade depth for local character and maintainability; conceptual finishes do not prove craftsmanship.',unsupported:'No valuation, construction-cost estimate, automatic programme, engineering, services, code or luxury certification.'},
 sources:[{reference:'User brief: AI Architect — Property Value Recipes & Live Architectural Development, 2026-10-28',kind:'curated',verified:true,note:'User-supplied qualitative expectations. Location, land value, waterfront access, market conditions and construction costs can dominate price; these bands are not market evidence.'}],
 status:'approved',supersedes:[],review:'Reviewed as qualitative design guidance for normal Generate under the root-cause generation request. Source provenance verified against the supplied brief; not market research, valuation or a construction-cost model.',version:1,updatedAt:'2026-10-28T00:00:00.000Z',
}));
