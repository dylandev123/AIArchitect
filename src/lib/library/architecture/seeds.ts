import { PROPERTY_VALUE_GUIDANCE } from './propertyValue';
import type { KnowledgeRevision } from './model';
import { EXPANDED_ARCHITECTURAL_GUIDANCE } from './expanded';
import { EXTENDED_ARCHITECTURAL_GUIDANCE } from './guidance';
/** Reviewed repository-derived guidance, not researched code or engineering advice. */
export const ARCHITECTURAL_KNOWLEDGE_SEEDS: KnowledgeRevision[] = [

  {
    "id": "estate-composition",
    "title": "Estate programme and hierarchy",
    "kind": "recipe",
    "tags": [
      "estate",
      "mansion",
      "luxury",
      "waterfront"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Large private residences with substantial entertaining and service needs.",
    "combinations": "Consider guest accommodation and wellness only after a complete main residence.",
    "placement": "Sequence arrival, entrance, living, shaded terrace and view; separate service access and private suites.",
    "principles": "Give secondary volumes a programme and subordinate them to the residence.",
    "capabilities": "Compose plates, walls, openings and roofs freely; no prescribed wing arrangement.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "compact-family",
    "title": "Compact family home",
    "kind": "recipe",
    "tags": [
      "compact",
      "family",
      "bedroom"
    ],
    "scales": [
      "compact",
      "family"
    ],
    "when": "Small family homes where space and daily convenience matter.",
    "combinations": "Combine kitchen and dining; consider laundry, storage and a modest covered outdoor room before optional amenities.",
    "placement": "Keep the requested bedrooms private from entry and living; connect kitchen to dining and utility access with short circulation.",
    "principles": "Use efficient shared boundaries and useful daylight; do not sacrifice bedrooms for luxury extras.",
    "capabilities": "Rooms need explicit walls, openings and access; no automatic floor-plan or circulation solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "mediterranean-courtyard",
    "title": "Mediterranean courtyard residence",
    "kind": "recipe",
    "tags": [
      "mediterranean",
      "courtyard",
      "mansion",
      "tuscan"
    ],
    "scales": [],
    "when": "Grand Mediterranean homes or briefs explicitly seeking a courtyard.",
    "combinations": "Combine loggias, shaded dining, a restrained fountain and varied private gardens when space permits.",
    "placement": "Use an entrance sequence into a court, with living rooms and sheltered circulation addressing it; keep service crossings discreet.",
    "principles": "Balance solid walls, deep reveals, rhythmic openings and roof hierarchy; a courtyard need not force symmetry.",
    "capabilities": "Compose courtyard voids with separate rectangular parts; gable and hip roofs supported, arches and tiled roof detail are not dedicated operations.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "tropical-envelope",
    "title": "Caribbean climate and envelope",
    "kind": "recipe",
    "tags": [
      "caribbean",
      "tropical",
      "island",
      "humid"
    ],
    "scales": [],
    "when": "Hot humid coastal or island contexts.",
    "combinations": "Pair shaded glazing with sheltered outdoor living and selective screening.",
    "placement": "Place openings for potential cross ventilation and shelter entrances from driving rain; orientation and wind are assumptions until supplied.",
    "principles": "Prioritize shade, weather protection and maintainable coastal materials; request local hurricane and corrosion engineering.",
    "capabilities": "Screens, overhangs and openings can be constructed; no wind, corrosion, thermal or hurricane certification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "waterfront-estate",
    "title": "Waterfront privacy and site sequence",
    "kind": "recipe",
    "tags": [
      "waterfront",
      "ocean",
      "coastal",
      "beach",
      "seafront"
    ],
    "scales": [],
    "when": "Sites with a stated water edge or coastal view.",
    "combinations": "Consider view terraces and pools; docks only with suitable water access, brief and permissions.",
    "placement": "Protect the public shore edge and setbacks; place living towards views, private suites away from public routes, vehicle arrival landward when feasible.",
    "principles": "Do not invent a surveyed shore, flood elevation or legal setback; keep site assumptions explicit.",
    "capabilities": "Flat site composition and water surfaces are available; no coastal terrain, flood simulation or marine engineering.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "infinity-pool",
    "title": "Infinity pool and terrace recipe",
    "kind": "recipe",
    "tags": [
      "infinity",
      "pool",
      "waterfront"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "A requested pool or a large view-oriented estate with adequate site space; omit if excluded.",
    "combinations": "Pair a shaded lounge and supervised access; optional outdoor bar should not obstruct circulation.",
    "placement": "Align a view edge beyond living terraces, with basin, perimeter and safe deck access; preserve bedroom privacy.",
    "principles": "An infinity effect needs edge and catchment intent, not a floating blue sheet.",
    "capabilities": "Construct basin and water with supported parts; disclose absent overflow hydraulics and safety verification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "outdoor-entertaining",
    "title": "Outdoor kitchen, dining and bar",
    "kind": "recipe",
    "tags": [
      "outdoor",
      "bar",
      "kitchen",
      "entertaining",
      "caribbean"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Outdoor entertaining in a suitable climate or an explicit request.",
    "combinations": "Choose dining with kitchen or bar as appropriate; avoid installing every amenity.",
    "placement": "Connect indoor kitchen, shaded dining and service route; separate heat and smoke from seating and bedrooms.",
    "principles": "Make useful outdoor rooms with shade, furniture and circulation rather than empty decks.",
    "capabilities": "Plates, screens, roofs, sofas and composed counter volumes supported; appliance assets, plumbing and smoke performance are not implemented.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "rooftop-lounge",
    "title": "Rooftop lounge and access",
    "kind": "recipe",
    "tags": [
      "rooftop",
      "roof terrace",
      "lounge"
    ],
    "scales": [],
    "when": "An explicit rooftop living request and a roof able to accommodate access and occupancy.",
    "combinations": "Consider shade and small seating groups; avoid heavy pools without a structural concept.",
    "placement": "Connect occupied storeys to landings and roof access, keep edge protection and clear routes.",
    "principles": "Do not call an inaccessible roof lounge functional.",
    "capabilities": "Plates, railings and manually composed treads supported; no automatic stair, lift, load or egress solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "wellness-suite",
    "title": "Spa and gym suite",
    "kind": "recipe",
    "tags": [
      "spa",
      "gym",
      "wellness",
      "estate"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Requested wellness or substantial residences with suitable remaining space.",
    "combinations": "Choose a gym or spa to suit intended use; combine changing, storage and quiet terrace when justified.",
    "placement": "Place exercise near daylight and spa privacy; keep wet service needs away from cinema and sleeping rooms.",
    "principles": "Reserve real rooms and circulation before adding decorative amenity labels.",
    "capabilities": "Room shells and simple equipment representations only; no dedicated gym equipment, sauna or mechanical systems.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "cinema",
    "title": "Private cinema",
    "kind": "recipe",
    "tags": [
      "cinema",
      "theater",
      "theatre"
    ],
    "scales": [],
    "when": "Explicit cinema requests or a reviewed entertainment programme.",
    "combinations": "Consider equipment storage and a small foyer rather than unrelated resort amenities.",
    "placement": "Locate away from quiet bedrooms; provide a real entry and usable seating layout.",
    "principles": "Control light conceptually and acknowledge acoustic and ventilation design needs.",
    "capabilities": "Enclosure and simple seating geometry supported; no acoustic simulation, projection or dedicated cinema assets.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "guest-house",
    "title": "Guest house and independence",
    "kind": "recipe",
    "tags": [
      "guest",
      "estate",
      "compound"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Guest accommodation requests or extensive private hospitality.",
    "combinations": "Combine sleeping, bathing intent and private outdoor sitting; avoid duplicating the main entertainment programme.",
    "placement": "Provide independent arrival and a clear pedestrian route to the residence without crossing private bedroom terraces.",
    "principles": "Give the guest building a subordinate identity and suitable privacy.",
    "capabilities": "Detached walls, doors, roofs and decks supported; fixtures and operational utilities require disclosure.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "garage-arrival",
    "title": "Garage, parking and arrival",
    "kind": "recipe",
    "tags": [
      "garage",
      "arrival",
      "family",
      "estate",
      "mansion"
    ],
    "scales": [],
    "when": "Vehicle access is requested or a residence needs an arrival strategy.",
    "combinations": "Combine sheltered pedestrian entry, storage and discreet service access.",
    "placement": "Connect parking to entrance and utility spaces without making garage doors the principal facade; protect walking routes.",
    "principles": "Scale parking to the brief and available site, never infer a large car collection from price alone.",
    "capabilities": "Composed volumes, plates and doors supported; no automatic vehicle turning simulation or garage-door mechanism.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "sports-court",
    "title": "Sports court siting",
    "kind": "recipe",
    "tags": [
      "tennis",
      "sports",
      "court",
      "basketball"
    ],
    "scales": [],
    "when": "Explicit sports court requests and adequate site area; courtyard does not mean sports court.",
    "combinations": "Consider shade, spectator seating and equipment storage only as justified.",
    "placement": "Keep ball travel, glare and noise away from bedrooms and waterfront edges; provide a route from changing facilities.",
    "principles": "Protect residence and landscape quality instead of filling remaining land indiscriminately.",
    "capabilities": "Court slab and simple boundary geometry possible; no dedicated markings, nets, lighting photometry or sport certification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "boat-dock",
    "title": "Boat dock and marine access",
    "kind": "recipe",
    "tags": [
      "dock",
      "boat",
      "jetty",
      "marina"
    ],
    "scales": [],
    "when": "Explicit boat access with a suitable water edge; waterfront alone does not require a dock.",
    "combinations": "Combine shore access and storage if requested; keep fuel and service away from living terraces.",
    "placement": "Provide a continuous pedestrian approach and acknowledge tides, navigation and public shore rights.",
    "principles": "Treat marine permits and engineering as unresolved until verified.",
    "capabilities": "Deck and support concepts can be composed; no floating, tidal, mooring or marine structural solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  {
    "id": "facade-materials",
    "title": "Facade depth, roofs and material identity",
    "kind": "recipe",
    "tags": [
      "facade",
      "roof",
      "materials",
      "mediterranean",
      "caribbean",
      "family"
    ],
    "scales": [],
    "when": "A residence needing coherent enclosure and material expression.",
    "combinations": "Coordinate a small material palette, roof edges, recessed entrances and shaded openings.",
    "placement": "Relate facade rhythm to rooms and privacy; carry architectural intent around side and rear elevations.",
    "principles": "Adapt material and roof recommendations to climate and style instead of prescribing a fixed house template.",
    "capabilities": "Existing ivory, limestone, timber, bronze and sage; flat, gable and hip roofs; curved roof only via approved open pavilion.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/designGuide.ts",
        "kind": "repository",
        "verified": true,
        "note": "Curated contextual application of the existing design guide; capability claims checked against scene/terra.ts and component-registry.ts."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Initial repository curation; conceptual guidance only.",
    "version": 1,
    "updatedAt": "2026-10-27T00:00:00.000Z"
  },
  ...EXTENDED_ARCHITECTURAL_GUIDANCE,
  ...EXPANDED_ARCHITECTURAL_GUIDANCE,
  ...PROPERTY_VALUE_GUIDANCE,
];
