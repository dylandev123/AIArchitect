import type { KnowledgeRevision } from './model';
/** Conceptual curation; sources verify implementation capabilities, not building regulations. */
export const EXTENDED_ARCHITECTURAL_GUIDANCE: KnowledgeRevision[] = [
  {
    "id": "composition-hierarchy",
    "title": "Primary and subordinate massing",
    "kind": "principle",
    "tags": [
      "mansion",
      "estate",
      "composition"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Large programmes needing a legible centre.",
    "placement": "Give the principal living hall the strongest volume; step bedroom and service wings down around it.",
    "principles": "Avoid equal boxes with no hierarchy.",
    "combinations": "Compare arrival and garden silhouettes.",
    "capabilities": "plate, wall, roof and volume; compose hollow rooms, not solid habitable blocks.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "asymmetric-balance",
    "title": "Asymmetric balance",
    "kind": "principle",
    "tags": [
      "asymmetric",
      "modern",
      "contemporary"
    ],
    "scales": [],
    "when": "An irregular programme or unequal views.",
    "placement": "Balance a taller living volume with a longer low wing and a sheltered void.",
    "principles": "Avoid random offsets.",
    "combinations": "Use repeated datums to unify unequal masses.",
    "capabilities": "plate, wall and independent roof sections; no visual-balance solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "symmetric-arrival",
    "title": "Symmetry at arrival",
    "kind": "principle",
    "tags": [
      "symmetry",
      "formal",
      "colonial"
    ],
    "scales": [],
    "when": "A formal entrance brief.",
    "placement": "A formal entrance brief. Centre the arrival axis on a door and foyer while allowing private wings to vary.",
    "principles": "Pair portal piers or bays without forcing every room into symmetry.",
    "combinations": "Centre the arrival axis on a door and foyer while allowing private wings to vary.",
    "capabilities": "entrance, wall openings, volume piers and roof canopy; no axis generator.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "courtyard-proportion",
    "title": "Courtyard enclosure and daylight",
    "kind": "principle",
    "tags": [
      "courtyard",
      "mediterranean"
    ],
    "scales": [],
    "when": "A residence organized around an outdoor centre.",
    "placement": "Face living and circulation towards a court with useful depth and shaded edges.",
    "principles": "Avoid a narrow residual shaft or blocked access.",
    "combinations": "Vary enclosed sides and loggias.",
    "capabilities": "Separate plates, walls and roofs around an unbuilt void; no courtyard subtraction operation.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "double-height-foyer",
    "title": "Double height entrance volume",
    "kind": "principle",
    "tags": [
      "double-height",
      "foyer",
      "grand entrance"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "An arrival needing spatial emphasis.",
    "placement": "Raise the foyer roof and opening heads; route upper circulation beside the void.",
    "principles": "Never span the void with an upper slab.",
    "combinations": "Use clerestories or sidelights.",
    "capabilities": "Tall walls, openings, entrance, roof and separated upper plates; no automatic stair or void cutting.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "covered-threshold",
    "title": "Covered entrance threshold",
    "kind": "principle",
    "tags": [
      "entrance",
      "arrival",
      "covered entry"
    ],
    "scales": [],
    "when": "Weather protection at the front door.",
    "placement": "Connect approach slab to a recessed door under a supported canopy.",
    "principles": "Avoid a door behind an uncut wall.",
    "combinations": "Choose wall returns or posts.",
    "capabilities": "plate, unglazed wall opening, entrance child, volume posts and roof.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "arrival-court",
    "title": "Arrival court hierarchy",
    "kind": "principle",
    "tags": [
      "arrival court",
      "porte cochere",
      "estate"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "An extensive site with vehicle arrival.",
    "placement": "Frame pedestrian entry beyond a turning court and connect service access discreetly.",
    "principles": "Avoid treating parking as the main facade.",
    "combinations": "Consider a canopy and planted edges.",
    "capabilities": "plates, supported roof and volume columns; no vehicle tracking or landscape automation.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "living-view",
    "title": "Living room and view hierarchy",
    "kind": "principle",
    "tags": [
      "living",
      "ocean",
      "waterfront"
    ],
    "scales": [],
    "when": "Principal shared rooms with a stated outlook.",
    "placement": "Connect living to dining and a covered terrace with framed view openings.",
    "principles": "Avoid exposed glass on every side.",
    "combinations": "Balance wide glazing with solid furniture walls.",
    "capabilities": "plate, segmented wall openings, glazing and roof overhang; no glare simulation.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "kitchen-service",
    "title": "Kitchen service triangle",
    "kind": "principle",
    "tags": [
      "kitchen",
      "family"
    ],
    "scales": [],
    "when": "Everyday cooking and entertaining.",
    "placement": "Relate preparation, storage and dining to a short service route.",
    "principles": "Avoid routing bedroom access through cooking space.",
    "combinations": "Open or enclosed kitchens can work.",
    "capabilities": "Room shell with walls, doors and counter volumes; appliances and utilities remain conceptual.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "dining-transition",
    "title": "Dining between kitchen and garden",
    "kind": "principle",
    "tags": [
      "dining",
      "entertaining"
    ],
    "scales": [],
    "when": "Meals connecting indoor and outdoor rooms.",
    "placement": "Place dining beside kitchen and terrace doors with clear passing space.",
    "principles": "Avoid making the table the only circulation route.",
    "combinations": "Use a shaded outdoor extension.",
    "capabilities": "plate, wall openings, entrance or glazing and roof; furniture clearance needs review.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "private-bedroom-wing",
    "title": "Private bedroom wing",
    "kind": "principle",
    "tags": [
      "bedroom",
      "suites",
      "privacy"
    ],
    "scales": [],
    "when": "Sleeping rooms near busy entertaining areas.",
    "placement": "Use a legible corridor or quiet court edge between bedrooms and public rooms.",
    "principles": "Avoid bedrooms opening directly into arrival courts.",
    "combinations": "Offset doors and screen terraces.",
    "capabilities": "Separate floor zones, wall partitions, door openings and window bays; no automatic room solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "primary-suite",
    "title": "Primary suite sequence",
    "kind": "principle",
    "tags": [
      "primary suite",
      "master suite",
      "luxury"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "A brief requesting generous private accommodation.",
    "placement": "Connect bedroom, dressing and bathroom through private circulation with a sheltered view terrace.",
    "principles": "Avoid claiming a suite from one labelled slab.",
    "combinations": "Separate wet and sleeping zones.",
    "capabilities": "Room floors, partitions, door openings, glazing and terrace; sanitary fixtures and plumbing unsupported.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "bathroom-privacy",
    "title": "Bathroom privacy and daylight",
    "kind": "principle",
    "tags": [
      "bathroom",
      "bathrooms",
      "family"
    ],
    "scales": [],
    "when": "Wet rooms sharing the residential plan.",
    "placement": "Place bathrooms near bedrooms with discreet doors and screened daylight.",
    "principles": "Avoid full-height exposed glazing towards public routes.",
    "combinations": "Use high sills or an enclosed court.",
    "capabilities": "walls, openings, screens and doors; waterproofing, drainage and fixtures require specialist design.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "short-circulation",
    "title": "Short legible circulation",
    "kind": "principle",
    "tags": [
      "compact",
      "family",
      "circulation"
    ],
    "scales": [
      "compact",
      "family"
    ],
    "when": "Limited area with several bedrooms.",
    "placement": "Connect entrance to living and a short private hall; let rooms share useful boundaries.",
    "principles": "Avoid passage through bedrooms.",
    "combinations": "Consider a small hall rather than multiple corridors.",
    "capabilities": "plates, partitions and actual door openings; no navigation or accessibility certification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "service-spine",
    "title": "Discreet service spine",
    "kind": "principle",
    "tags": [
      "service",
      "laundry",
      "estate"
    ],
    "scales": [],
    "when": "Housekeeping and storage supporting everyday use.",
    "placement": "Connect kitchen, laundry, storage and service entry away from principal entertaining routes.",
    "principles": "Avoid decorative rooms with no service provision.",
    "combinations": "Use a compact utility cluster or separate estate route.",
    "capabilities": "Partition walls, entrances and floors; equipment and mechanical systems unsupported.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "guest-bedroom",
    "title": "Guest bedroom independence",
    "kind": "principle",
    "tags": [
      "guest bedroom",
      "guest suite"
    ],
    "scales": [],
    "when": "Visitors sharing the main residence.",
    "placement": "Provide access from shared circulation and reasonable separation from family bedrooms.",
    "principles": "Avoid crossing the primary suite.",
    "combinations": "Pair a bathroom and small terrace where justified.",
    "capabilities": "floors, partitions, doors, glazing and roof; furnishings and sanitary servicing require review.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "window-rhythm",
    "title": "Room based window rhythm",
    "kind": "principle",
    "tags": [
      "windows",
      "facade",
      "traditional"
    ],
    "scales": [],
    "when": "Elevations serving several distinct rooms.",
    "placement": "Align sill and head datums while varying bay widths for room use.",
    "principles": "Avoid a single ribbon hiding all room boundaries.",
    "combinations": "Alternate solids and openings.",
    "capabilities": "One opening per wall segment; split walls for multiple independently editable windows.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "deep-reveals",
    "title": "Deep facade reveals",
    "kind": "principle",
    "tags": [
      "recessed",
      "reveals",
      "mediterranean"
    ],
    "scales": [],
    "when": "Solid facades needing depth and shade.",
    "placement": "Set glazing behind jamb and head volumes aligned with actual wall openings.",
    "principles": "Avoid applying trim across uncut walls.",
    "combinations": "Combine stone surrounds or restrained sills.",
    "capabilities": "wall opening, glazing child and volume jambs/lintel; no boolean recess operation.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "solid-glass-balance",
    "title": "Solid and glazed facade balance",
    "kind": "principle",
    "tags": [
      "glazing",
      "minimalist",
      "contemporary"
    ],
    "scales": [],
    "when": "View oriented architecture that also needs privacy.",
    "placement": "Concentrate glazing at living views and retain solid bedroom or service edges.",
    "principles": "Avoid uniform glass regardless of orientation.",
    "combinations": "Use screens and overhangs.",
    "capabilities": "walls, individual openings, glazing, screens and roof; thermal performance unverified.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "vertical-screens",
    "title": "Vertical facade screens",
    "kind": "principle",
    "tags": [
      "screen",
      "screening",
      "tropical"
    ],
    "scales": [],
    "when": "Privacy or low angle sun needs filtering.",
    "placement": "Place slats outside openings without blocking doors and approach routes.",
    "principles": "Avoid spanning a facade along screen depth.",
    "combinations": "Vary panels or use narrow fins.",
    "capabilities": "screen spans local X with panels; volume fins for other rectangular orientations; no solar analysis.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "material-junction",
    "title": "Material junction hierarchy",
    "kind": "principle",
    "tags": [
      "materials",
      "stone",
      "timber"
    ],
    "scales": [],
    "when": "Several finishes sharing one building.",
    "placement": "Use a primary wall finish, grounded base and restrained accent at entry or shade.",
    "principles": "Avoid arbitrary patches without geometry.",
    "combinations": "Change materials at corners or setbacks.",
    "capabilities": "finish operation on separate walls/volumes; only ivory, limestone, timber, bronze and sage are supported.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "flat-roof-parapet",
    "title": "Flat roof and parapet coordination",
    "kind": "principle",
    "tags": [
      "flat roof",
      "modern",
      "minimalist"
    ],
    "scales": [],
    "when": "Low horizontal rooflines.",
    "placement": "Cover enclosure with roof planes and align parapet returns around appropriate edges.",
    "principles": "Avoid a decorative roof missing rear rooms.",
    "combinations": "Use stepped planes for hierarchy.",
    "capabilities": "flat roof with explicit enlarged footprint, volume or wall parapets; drainage and waterproofing unverified.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "gable-hierarchy",
    "title": "Gable roof hierarchy",
    "kind": "principle",
    "tags": [
      "gable",
      "traditional",
      "pitched"
    ],
    "scales": [],
    "when": "Pitched residential roofs over distinct volumes.",
    "placement": "Give the principal span a clear ridge and subordinate links lower eaves.",
    "principles": "Avoid intersecting ridges without a valley concept.",
    "combinations": "Combine separate gables carefully.",
    "capabilities": "roofForm gable, rise and overhang; ridge follows longer span, no automatic valleys.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "hip-shelter",
    "title": "Hip roof shelter",
    "kind": "principle",
    "tags": [
      "hip",
      "caribbean",
      "colonial"
    ],
    "scales": [],
    "when": "Four sided shelter over a rectangular volume.",
    "placement": "Set eaves above enclosure and coordinate veranda canopies below main eaves.",
    "principles": "Avoid claiming arbitrary roof polygons.",
    "combinations": "Use subordinate hips or flat links.",
    "capabilities": "roofForm hip and overhang on rectangular footprint; flashing and hurricane uplift need engineering.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "layered-roofline",
    "title": "Layered roof composition",
    "kind": "principle",
    "tags": [
      "roofline",
      "layered",
      "estate"
    ],
    "scales": [
      "estate",
      "mansion"
    ],
    "when": "Several architectural volumes requiring identity.",
    "placement": "Coordinate main hall, private wings and links with distinct but related roof datums.",
    "principles": "Avoid random heights unrelated to rooms.",
    "combinations": "Repeat soffit/material language.",
    "capabilities": "Independent roof elements, volume fascia and wall supports; no automatic roof intersection resolution.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "deep-overhang",
    "title": "Deep shade and rain shelter",
    "kind": "principle",
    "tags": [
      "overhang",
      "shade",
      "tropical"
    ],
    "scales": [],
    "when": "Exposed glazing and outdoor circulation.",
    "placement": "Extend shelter over openings and terraces while keeping views and drainage intent.",
    "principles": "Avoid assuming a horizontal canopy solves all orientations.",
    "combinations": "Combine screens for low sun.",
    "capabilities": "Enlarged flat roof or gable/hip overhang with posts/beams where justified; no thermal or rainfall model.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "veranda-edge",
    "title": "Veranda as inhabited edge",
    "kind": "principle",
    "tags": [
      "veranda",
      "caribbean",
      "colonial"
    ],
    "scales": [],
    "when": "A sheltered transition around occupied rooms.",
    "placement": "Link doors, a continuous walking surface and rhythmic posts below a canopy.",
    "principles": "Avoid narrow decorative strips.",
    "combinations": "Wrap selected edges or use separate outdoor rooms.",
    "capabilities": "supported plate, volume posts/beams, roof and door openings; guard and structural review required.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "loggia-depth",
    "title": "Loggia room and facade",
    "kind": "principle",
    "tags": [
      "loggia",
      "mediterranean"
    ],
    "scales": [],
    "when": "Outdoor rooms contained within the building rhythm.",
    "placement": "Align a recessed terrace with living doors and supported overhead shelter.",
    "principles": "Avoid labelling an exposed deck a loggia.",
    "combinations": "Use piers or columns and solid side returns.",
    "capabilities": "plate, volume columns, wall returns and roof; arches unsupported.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "balcony-access",
    "title": "Balcony floor access and guards",
    "kind": "principle",
    "tags": [
      "balcony",
      "balconies"
    ],
    "scales": [],
    "when": "Occupied elevated outdoor space.",
    "placement": "Connect a real upper door to a supported deck with separate edge protection.",
    "principles": "Avoid railing without a floor.",
    "combinations": "Recess the deck or express a supported projection.",
    "capabilities": "plate, entrance, thin balcony railing and support volumes; loads and guard compliance unverified.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "pergola-shade",
    "title": "Pergola construction",
    "kind": "principle",
    "tags": [
      "pergola",
      "shaded terrace"
    ],
    "scales": [],
    "when": "Filtered shade rather than full rain protection.",
    "placement": "Connect a terrace to posts, beams and spaced overhead members.",
    "principles": "Avoid promising waterproof cover.",
    "combinations": "Combine a solid sheltered bay and open pergola.",
    "capabilities": "Individual volume posts/beams/slats on plate; screen slats are vertical, not pergola rafters.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "roof-terrace-edge",
    "title": "Occupied roof terrace enclosure",
    "kind": "principle",
    "tags": [
      "roof terrace",
      "rooftop"
    ],
    "scales": [],
    "when": "Outdoor use on top of lower rooms.",
    "placement": "Provide an accessible floor, landing, protected edges and a route from occupied levels.",
    "principles": "Avoid calling an inaccessible roof functional.",
    "combinations": "Use screened seating or a small canopy.",
    "capabilities": "plate, balcony guards, manually composed stair treads and roof; no automatic lift or egress solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "pool-sun-shelf",
    "title": "Pool sun shelf and basin",
    "kind": "principle",
    "tags": [
      "sun shelf",
      "pool"
    ],
    "scales": [],
    "when": "A pool with shallow lounging intent.",
    "placement": "Differentiate shallow and deep basin bottoms and connect supervised deck access.",
    "principles": "Avoid a water sheet presented as a complete pool.",
    "combinations": "Keep shelf within a coherent perimeter.",
    "capabilities": "Water Y minus basin-top Y gives depth. Walls span basin to rim; coordinate coping/deck tops and trace a gap-free dry approach outside the basin. Rectangular assemblies only; excavation, depth safety and hydraulics need review.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "spa-court",
    "title": "Spa privacy court",
    "kind": "principle",
    "tags": [
      "spa",
      "wellness"
    ],
    "scales": [],
    "when": "A requested wellness room opening outdoors.",
    "placement": "Connect enclosed changing/rest space to a screened quiet terrace.",
    "principles": "Avoid adding wet amenities to every mansion.",
    "combinations": "Pair with a small water feature only when requested.",
    "capabilities": "Room shell, plate, screens and water basin parts; no spa equipment or thermal systems.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "fitness-daylight",
    "title": "Daylit gym room",
    "kind": "principle",
    "tags": [
      "gym",
      "fitness"
    ],
    "scales": [],
    "when": "Exercise accommodation in the programme.",
    "placement": "Provide an actual enclosed room with daylight, access and a quiet transition.",
    "principles": "Avoid using a labelled pavilion as equipped gym evidence.",
    "combinations": "Orient towards a private garden.",
    "capabilities": "floor, walls, openings and roof; dedicated exercise equipment and ventilation unsupported.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "waterfront-deck",
    "title": "Waterfront deck and dock distinction",
    "kind": "principle",
    "tags": [
      "dock",
      "boat",
      "waterfront"
    ],
    "scales": [],
    "when": "A requested waterside destination.",
    "placement": "Connect a supported deck to the residence; distinguish land terrace from over-water dock.",
    "principles": "Avoid assuming marine permissions or seabed support.",
    "combinations": "Use separate approach and platform geometry.",
    "capabilities": "plate, volume piles and balcony guards conceptually; tides, moorings, coastal permissions and marine structure require review.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "tropical-contemporary",
    "title": "Tropical contemporary character",
    "kind": "principle",
    "tags": [
      "tropical contemporary",
      "caribbean"
    ],
    "scales": [],
    "when": "Warm climate residence combining openness and shelter.",
    "placement": "Compose deep roofs, shaded glazing, stone bases and timber screens around outdoor rooms.",
    "principles": "Avoid a glass box with decorative palms as the only climate response.",
    "combinations": "Vary roof forms with programme.",
    "capabilities": "roof, walls, glazing, screens and volume detail; landscape assets and climate performance not certified.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "minimalist-depth",
    "title": "Minimalist depth and precision",
    "kind": "principle",
    "tags": [
      "minimalist",
      "minimalism"
    ],
    "scales": [],
    "when": "A restrained architectural brief.",
    "placement": "Use fewer material families with purposeful recesses, aligned datums and concealed service edges.",
    "principles": "Avoid empty underdeveloped massing.",
    "combinations": "Balance planar walls with selected deep openings.",
    "capabilities": "Individual wall/opening, roof and volume detail; precision is conceptual, no construction tolerance model.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "traditional-order",
    "title": "Traditional residential order",
    "kind": "principle",
    "tags": [
      "traditional",
      "colonial"
    ],
    "scales": [],
    "when": "A traditional or colonial inspired brief.",
    "placement": "Relate entry, window rhythms, roof shelter and a grounded base to residential rooms.",
    "principles": "Avoid invented historical authenticity.",
    "combinations": "Use a veranda or restrained cornice.",
    "capabilities": "gable/hip roofs, wall openings, volume trim and posts; no moulding profiles or historic certification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "site-orientation",
    "title": "Orientation and uncertain site facts",
    "kind": "principle",
    "tags": [
      "orientation",
      "site",
      "climate"
    ],
    "scales": [],
    "when": "Early site design with incomplete survey data.",
    "placement": "State assumed view and arrival directions; reserve privacy and shade on exposed edges.",
    "principles": "Avoid invented north, prevailing wind or legal setback distances.",
    "combinations": "Offer adaptable placement.",
    "capabilities": "move, rotate and attachments coordinate geometry; no solar, survey or planning compliance engine.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "privacy-gradient",
    "title": "Privacy gradient across site",
    "kind": "principle",
    "tags": [
      "privacy",
      "guest",
      "waterfront"
    ],
    "scales": [],
    "when": "Public arrival and private outdoor rooms share a site.",
    "placement": "Sequence public entry, shared living, private suites and secluded gardens.",
    "principles": "Avoid guest paths through private terraces.",
    "combinations": "Use offsets and screens instead of long blank boundaries.",
    "capabilities": "walls, screens, separate plates and openings; no visibility or acoustic certification.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "landscape-room",
    "title": "Landscape as outdoor room boundary",
    "kind": "principle",
    "tags": [
      "landscape",
      "garden",
      "courtyard"
    ],
    "scales": [],
    "when": "Outdoor space needs enclosure and legibility.",
    "placement": "Use built edges and route connections to frame gardens without filling every void.",
    "principles": "Avoid claiming planting exists from text alone.",
    "combinations": "Alternate open lawn intent with shaded terrace.",
    "capabilities": "plates, low walls and screens; scene contract has no dedicated planting operation.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "coastal-durability",
    "title": "Coastal durability intent",
    "kind": "principle",
    "tags": [
      "coastal",
      "salt",
      "waterfront"
    ],
    "scales": [],
    "when": "Salt exposed architecture.",
    "placement": "Shelter openings and minimize exposed complex joints; state maintainable finish intent.",
    "principles": "Avoid treating material colours as corrosion specifications.",
    "combinations": "Use stone toned bases and protected screens.",
    "capabilities": "Supported material enums and roof shelter only; corrosion, fixing and hurricane design require local engineers.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "structural-continuity",
    "title": "Architectural support continuity",
    "kind": "principle",
    "tags": [
      "support",
      "cantilever",
      "columns"
    ],
    "scales": [],
    "when": "Elevated floors and shelter require believable connections.",
    "placement": "Trace slabs through walls, posts and beams to ground before placing guards.",
    "principles": "Avoid floating cosmetic columns.",
    "combinations": "Use coherent stacked supports or expressed cantilevers.",
    "capabilities": "volume, wall, plate and place-on; geometric contact is checked, structural capacity is not.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "vertical-access",
    "title": "Vertical circulation and landings",
    "kind": "principle",
    "tags": [
      "stairs",
      "staircase",
      "upper floor"
    ],
    "scales": [],
    "when": "Occupied levels above ground.",
    "placement": "Derive rise from walking datums; reserve run and a full-width clear stairwell. Split only the selected host floor into rectangular segments around the void; end treads at the landing edge and trace clear access at both ends.",
    "principles": "Check transformed slab undersides, tread/landing overlap and aligned wall passages; floor contact or a labelled void cannot prove a usable stair.",
    "combinations": "Use manually composed steps where feasible.",
    "capabilities": "plate/volume treads, landings and guards; no automatic stair, accessibility or egress solver.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "editing-relationships",
    "title": "Coordinated architectural edits",
    "kind": "principle",
    "tags": [
      "edit",
      "resize",
      "move"
    ],
    "scales": [],
    "when": "Changing a built architectural relationship.",
    "placement": "Move host and dependents coherently; re-seat elements after height changes.",
    "principles": "Avoid leaving glass or guards behind.",
    "combinations": "Prefer local attachments for coordinated assemblies.",
    "capabilities": "move, rotate, resize, replace, attach, place-on, finish and remove in atomic transactions; undo/persistence belong to existing store.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  },
  {
    "id": "room-enclosure",
    "title": "Room enclosure versus massing",
    "kind": "principle",
    "tags": [
      "rooms",
      "complete",
      "house"
    ],
    "scales": [],
    "when": "Turning architectural massing into a residence.",
    "placement": "Construct floors, boundary walls, real doors/windows and overhead cover for intended rooms.",
    "principles": "Avoid solid blocks or names as room evidence.",
    "combinations": "Share boundaries without duplicate walls.",
    "capabilities": "plate, wall opening, entrance/glazing and roof; furnishing and service completeness require review.",
    "sources": [
      {
        "reference": "src/lib/villa/scene/terra.ts",
        "kind": "repository",
        "verified": true,
        "note": "Operation availability checked against the direct-scene contract. Design guidance is conceptual curation, not a verified regulation or external research."
      }
    ],
    "status": "approved",
    "supersedes": [],
    "review": "Repository capability review; conceptual guidance only. Local architectural and engineering review remains required.",
    "version": 1,
    "updatedAt": "2026-10-28T00:00:00.000Z"
  }
];
