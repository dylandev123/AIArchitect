/** Offline interpretation fixtures, never design templates or generated geometry. */
export const requestPipelineFixtures = [
 {id:'compact-st-lucia',brief:'Design a $150,000 family house in Saint Lucia.',profile:'property-value-100k-250k'},
 {id:'family',brief:'Design a $450,000 traditional family residence in London with 4 bedrooms and 3 bathrooms, without pool or gym.',profile:'property-value-250k-500k'},
 {id:'mediterranean',brief:'Design a $2 million Mediterranean villa overlooking the ocean.',profile:'property-value-1m-3m'},
 {id:'caribbean-estate',brief:'Design a $25 million contemporary Caribbean waterfront estate with six bedroom suites.',profile:'property-value-25m-50m'},
 {id:'compound',brief:'Design a $100 million private tropical compound.',profile:'property-value-50m-100m-plus'},
 {id:'construction',brief:'Design a family house in Saint Lucia with a construction budget of about $150,000 and three bedrooms.',profile:null},
 {id:'high-construction',brief:'Design a contemporary family residence with construction cost is approximately USD 25 million.',profile:null},
 {id:'value-and-budget',brief:'Design a Mediterranean property worth $25 million with a construction budget of about $2 million and land value of about $10 million.',profile:'property-value-25m-50m'},
 {id:'no-price',brief:'Design a minimalist two-storey hillside house in Japan on a narrow north-facing site with 3 bedrooms, 2 bathrooms and a private courtyard; no pool.',profile:null},
 {id:'compact-luxury',brief:'Design a compact $25 million tropical home with two bedrooms and no gym or cinema.',profile:'property-value-25m-50m'},
 {id:'non-usd',brief:'Design an EC$450,000 family house in Saint Lucia with 3 bedrooms.',profile:null},
] as const;
