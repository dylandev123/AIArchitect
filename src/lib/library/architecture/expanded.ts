import type { KnowledgeRevision } from './model';
import { fragmentDetails } from './fragments';

// Individually authored design relationships, not permutations of styles and features.
// Repository references verify the primitive contract only; these are conceptual
// design options, not researched historical claims, engineering or local rules.
type Group = {
 category: NonNullable<KnowledgeRevision['category']>; tags: string[];
 kinds: NonNullable<KnowledgeRevision['construction']>['requiredKinds'];
 materials: string; supports: string; unsupported: string;
 rows: string;
};
const groups: Group[] = [
{
 category:'composition', tags:['composition','house','estate','mansion'], kinds:['plate','wall','roof'],
 materials:'Unify ivory wall planes with timber recesses; limestone can anchor the base.',
 supports:'Resolve floors and enclosure together; align roof bearing with walls or explicit posts.',
 unsupported:'No aesthetic scoring, structural analysis or automatic massing solver.',
 rows:`
central-hall-order|Central hall as organizer|Arrange shared rooms around a legible hall with branching private routes.|Do not let every room become a passage.
long-low-residence|Long low residence|Use a continuous floor datum and sheltered gallery to connect a low linear programme.|Break excessive corridor length with occupied nodes.
compact-core-order|Compact core organization|Group storage and wet rooms internally while giving living and sleeping rooms exterior edges.|An internal service core must not consume all cross routes.
pavilion-cluster-order|Connected pavilion hierarchy|Use distinct occupied shells joined by covered pedestrian links around a common outdoor room.|Detached blocks without links are not a coherent residence.
stepped-height-order|Stepped height composition|Step secondary roofs below the main gathering volume and align their lower edges.|Avoid arbitrary height changes without programme.
solid-void-sequence|Alternating solids and outdoor voids|Insert usable courts between occupied volumes while retaining direct sheltered routes.|Do not count outdoor gaps as enclosed rooms.
edge-and-centre|Centre and edge hierarchy|Let the centre gather shared activity and use perimeter bays for quieter rooms.|Avoid an oversized empty centre surrounded by undersized rooms.
view-fan-order|Angled wings toward distinct views|Rotate rectangular wings toward stated outlooks and connect them through a generous hinge space.|Do not invent a surveyed coastline or intersect wing walls.
parallel-bars-order|Parallel residential bars|Separate public and private bars with a garden and connect at selected thresholds.|A narrow residual slot is not a useful garden.
end-anchor-order|Anchored linear composition|Give a long wing a purposeful end room or sheltered overlook to terminate the sequence.|Do not add a monumental blank block merely for balance.
recessed-link-order|Recessed connecting volume|Set a low circulation connector behind adjacent facades to clarify separate programme volumes.|Do not leave connector roofs short of their enclosure.
corner-emphasis-order|Occupied corner emphasis|Mark a key corner with a living bay and coordinated opening rhythm.|Avoid enlarging corners without usable interior depth.
base-middle-top|Base body and roof reading|Use a continuous plinth datum with a quieter wall body and deliberate roof edge.|Material stripes alone cannot repair disconnected massing.
selective-symmetry|Local symmetry within irregular plans|Centre the entry composition while allowing garden wings to respond to room and view needs.|Do not force unequal programmes into identical shells.
future-wing-junction|Planned extension junction|End a service or bedroom corridor at an exterior bay that could connect a future wing.|Do not construct unrequested future rooms.
`,
},
{
 category:'programme',tags:['residential','family','bedroom','rooms','planning'],kinds:['plate','wall','roof','entrance'],
 materials:'Ivory partitions with timber doors; limestone or timber floors as compatible alternatives.',
 supports:'Provide actual room floors, enclosure, roof and door openings; share boundaries without duplicate walls.',
 unsupported:'No automatic room allocation, furnished clearance, plumbing or navigability solver.',
 rows:`
entry-coat-storage|Entry storage beside foyer|Place a storage recess off the foyer before the public living route.|Do not make storage the route into the home.
powder-room-screen|Discreet visitor bathroom|Place the visitor bathroom near public rooms behind an offset short lobby.|Do not expose its door directly to dining.
family-room-buffer|Family room privacy buffer|Put an informal lounge between shared entertaining and the bedroom corridor.|Do not require guests to cross sleeping rooms.
children-bedroom-cluster|Children bedroom cluster|Group bedrooms around short shared circulation near a family bathroom.|Avoid isolated child rooms beyond service access.
teen-retreat-edge|Teen retreat with oversight|Place a secondary lounge beside bedrooms with a defined route back to shared rooms.|Do not leave a detached lounge with no sheltered access.
guest-room-ground|Ground level guest room|Locate guest accommodation near arrival with a quiet window edge and bathroom relationship.|Do not claim accessible compliance from a ground floor alone.
primary-dressing-buffer|Dressing room as acoustic buffer|Place dressing storage between the primary bedroom and noisier shared circulation.|Do not block bedroom daylight with a deep enclosed closet band.
ensuite-door-offset|Offset ensuite access|Offset bathroom entry from the bed-facing opening while preserving a direct private route.|Do not label a single undivided room an ensuite.
shared-bathroom-lobby|Shared bathroom lobby|Give shared bathrooms access from neutral bedroom circulation.|Do not require one bedroom to access another's bathroom.
laundry-service-edge|Laundry on service edge|Place laundry near bedroom service routes and an exterior drying opportunity.|Do not route laundry traffic through formal dining.
pantry-kitchen-link|Pantry and kitchen relationship|Place pantry storage between kitchen preparation and delivery access.|Do not turn the pantry into the sole public corridor.
breakfast-garden-bay|Breakfast bay facing garden|Add a modest occupied bay beside the kitchen with a shaded garden opening.|Do not substitute this bay for the main dining programme.
home-office-threshold|Office near public threshold|Locate a study near arrival so occasional visitors need not enter private wings.|Avoid office access through a bedroom.
reading-room-quiet|Quiet reading room|Set a small reading room away from arrival noise with controlled daylight and a solid shelf wall.|Do not glaze every edge and remove all usable wall space.
playroom-garden-link|Supervised playroom garden link|Place play space beside informal family rooms with a direct visible outdoor opening.|A view through glass alone is not an outdoor access route.
`,
},
{
 category:'programme',tags:['estate','mansion','luxury','service','circulation'],kinds:['plate','wall','roof','entrance'],
 materials:'Use a restrained common palette; service areas can retain simple ivory enclosure.',
 supports:'Construct linked floors and actual enclosure openings before adding subordinate wings.',
 unsupported:'No staffing model, operational certification, fire strategy or services simulation.',
 rows:`
formal-informal-split|Formal and informal living routes|Branch formal reception and everyday living from the foyer without making either a through room.|Do not send family circulation through a formal dining table zone.
service-parallel-route|Parallel service circulation|Connect kitchen pantry laundry and delivery access on a secondary route.|Do not invent a service tunnel or cross private suites.
staff-privacy-edge|Staff accommodation privacy|If requested locate staff rooms with daylight and independent access near service functions.|Do not count a store as habitable accommodation.
security-arrival-position|Arrival observation room|If requested place an enclosed observation room beside the approach with a clear door and view opening.|No security coverage or operational performance is verified.
entertaining-loop|Entertaining circulation loop|Link reception dining and garden through more than one usable threshold where space permits.|Do not create a loop through bathrooms or bedrooms.
banquet-service-adjacency|Large dining service adjacency|Relate a large dining room to kitchen support through a short discreet doorway sequence.|Do not rely on an uncut separating wall.
private-lift-reserve|Reserved lift zone|Reserve a clearly disclosed future lift footprint beside vertical circulation.|Do not fabricate an operational lift from a solid volume.
upper-family-landing|Occupied family landing|Widen an upper circulation node into a daylight lounge beside sleeping rooms.|Protect void edges and retain the landing path.
bridge-room-connector|Enclosed bridge connector|Connect occupied wings using a floor enclosure and overhead cover with supported ends.|A bridge railing alone is not an enclosed corridor.
quiet-court-route|Quiet court circulation|Route private room access along a sheltered court edge screened from parties.|Do not place bedroom doors directly on the busiest entertainment deck.
seasonal-wing-separation|Seasonal guest wing separation|Use a closable connector between main living and occasional guest accommodation.|Do not imply energy zoning or mechanical controls were modelled.
family-entry-mudroom|Everyday family entrance|Connect parking to a secondary threshold with storage before kitchen access.|Do not make the garage the only legible main entrance.
wine-room-location|Wine room conceptual shell|If requested place a small enclosed storage room near dining and away from major glazing.|No temperature control racks or wine conservation performance is implemented.
collection-gallery-route|Collection gallery circulation|Use a wider circulation room with solid display edges between reception spaces.|Do not narrow access paths with display volumes.
service-yard-screening|Screened service yard|Place a bounded outdoor utility area beside service doors and screen it from principal views.|Do not model plant or waste services as operational equipment.
`,
},
{
 category:'tradition',tags:['style','traditional','house','architecture'],kinds:['plate','wall','roof','entrance'],
 materials:'Choose compatible ivory limestone timber or bronze from the scene palette; names do not imply specialist finishes.',
 supports:'Express character through actual enclosure, openings, eaves and occupied exterior spaces.',
 unsupported:'No arbitrary arches, carved orders, decorative meshes or exact historical reconstruction.',
 rows:`
vernacular-gallery-house|Gallery house interpretation|Wrap selected occupied edges in a shaded gallery under a coordinated roof.|Do not claim a gallery from a painted facade band.
creole-raised-veranda|Creole inspired veranda residence|Use a raised-looking base with actual approach steps and a generous shaded veranda.|Do not claim flood resilience without site data or engineering.
colonial-axis-veranda|Colonial inspired axial veranda|Align the door and hall with a composed front veranda and subordinate side rooms.|Avoid imposing symmetry on the whole site.
french-court-residence|French inspired arrival court|Frame a formal approach with a principal residence and lower service edges.|Do not invent mansard geometry beyond supported roof forms.
italian-loggia-house|Italian inspired loggia residence|Compose thick-looking wall returns around a shaded rectangular loggia facing a court.|Rectangular openings are an interpretation rather than unsupported arches.
spanish-patio-house|Spanish inspired patio residence|Organize room doors along sheltered edges of an open central patio.|Do not roof over the patio while claiming an open court.
greek-court-retreat|Greek inspired court retreat|Combine light wall planes recessed doors and a sheltered open court.|Avoid unsupported sculpted vaults or fabricated regional authenticity.
japanese-engawa-link|Engawa inspired garden edge|Use a narrow covered timber deck between room thresholds and garden.|Do not claim sliding door mechanics or traditional joinery.
balinese-pavilion-links|Balinese inspired pavilion relationships|Connect smaller roofed room shells through shaded outdoor circulation.|Do not use the open curved lounge builder as an enclosed bedroom.
modernist-free-corner|Modernist open corner composition|Use offset enclosure planes and a sheltered glazed corner where the programme benefits.|Do not imply unsupported corner glass has structural verification.
brutalist-inhabited-depth|Monolithic depth with habitation|Use deep wall returns and recessed openings around actual hollow rooms.|Do not replace occupied rooms with solid concrete-like blocks.
minimalist-shadow-joint|Minimalist recessed junctions|Recess a connector and align major datums to create a quiet shadow line.|Do not represent a shadow gap by floating a roof without support.
arts-crafts-room-bays|Craft inspired inhabited bays|Articulate living and dining as useful projecting bays beneath coordinated pitched roofs.|Do not add decorative bumps without interior use.
coastal-shingle-analogy|Coastal layered roof interpretation|Use simple pitched roof groups and shaded porches to express a coastal character.|No shingle texture or weatherproof assembly is represented.
contemporary-rustic|Contemporary rustic material balance|Pair simple room shells with timber shade members and limestone base planes.|Do not imply timber grading or stone construction certification.
`,
},
{
 category:'tradition',tags:['building type','residential','house','programme'],kinds:['plate','wall','roof','entrance'],
 materials:'Use the supported neutral palette to reinforce hierarchy; avoid suggesting unavailable textures.',
 supports:'Build occupied room shells and circulation specific to the requested use before exterior details.',
 unsupported:'No change-of-use approval, occupancy calculation, acoustic or accessibility certification.',
 rows:`
townhouse-light-route|Townhouse depth and light|Place living spaces at front or rear and use an open court to break a deep middle zone.|Do not claim internal rooms are daylit without an exterior opening.
duplex-independent-entry|Duplex independent entry|Give each dwelling a separate exterior threshold and distinct enclosed floor zones.|Do not share private internal circulation unintentionally.
multigenerational-house|Multigenerational household|Give an older generation suite a quiet ground-level cluster near shared living.|Do not claim accessibility from room labels.
small-rental-residence|Small rental residence|Provide a clear entry living cooking sleeping and bathroom sequence within a compact shell.|Do not substitute an open pavilion for an enclosed dwelling.
boutique-guesthouse|Boutique guesthouse organization|Separate guest-room access from breakfast service and host-private space.|No hospitality licensing or escape compliance is established.
retreat-cabin|Retreat cabin essentials|Keep a compact protected entrance and group sleeping cooking and washing around short circulation.|Do not let a large terrace replace basic interior programme.
courtyard-duplex|Shared court separate households|Face two independent homes onto a shared court while screening private bedroom openings.|Do not confuse a shared outdoor court with shared internal ownership.
artist-live-work|Artist live-work residence|Separate a taller workroom with delivery access from quiet living and sleeping zones.|No hazardous-material ventilation or workshop safety is implemented.
residential-compound|Family compound organization|Use a common gathering residence and smaller private dwellings around connected outdoor rooms.|Do not add guest dwellings unless the brief supports them.
senior-household|Household with reduced level changes|Keep everyday living sleeping and garden access on a continuous datum where requested.|No certified step-free route or wheelchair turning analysis.
split-level-concept|Split level residential concept|Connect adjacent occupied datums with explicit landings and composed steps.|Generation remains on flat terrain and does not simulate hillside foundations.
narrow-lot-court|Narrow lot with side court|Set a usable open strip beside living rooms and concentrate service rooms on the opposite edge.|Do not invent setbacks or adjoining-site permissions.
corner-lot-dual-face|Corner lot dual facade|Give the pedestrian entrance a clear address and articulate the secondary street edge.|Do not assume a particular street orientation without brief evidence.
weekend-residence|Weekend residence shutdown zones|Group essential living into a modest core with optional guest rooms beyond a closable link.|No mechanical shutdown or energy performance is modelled.
large-family-flex-room|Flexible family room cluster|Place a closable multipurpose room near shared living with an exterior opening.|Do not promise a bedroom without room enclosure and access.
`,
},
{
 category:'arrival',tags:['entrance','arrival','estate','house'],kinds:['plate','wall','entrance','roof'],
 materials:'Timber or bronze doors with limestone threshold and ivory returns; vary recess depth rather than arbitrary decoration.',
 supports:'Cut a real unglazed wall opening, align door centre to it and connect approach floor to interior datum; support shelter.',
 unsupported:'No automatic door swing collision, vehicle tracking, security or accessibility certification.',
 rows:`
entry-compression-release|Compressed threshold and open foyer|Use a sheltered lower entry bay leading to a more generous interior gathering volume.|Do not let the entry canopy cut across the door head.
entry-side-reveal|Side reveal entrance depth|Recess the main door behind a thick-looking side return visible from approach.|Do not conceal the door behind an uncut wall.
entry-sidelight|Entrance sidelight composition|Place a separate glazed wall segment beside the door to illuminate the foyer.|Do not duplicate glass over an already glazed opening.
entry-clerestory|Foyer clerestory|Use a high opening above a solid privacy band to light arrival.|Keep high glazing below the roof and clear of bearing edges.
entry-corner-turn|Turning arrival sequence|Place a short approach beside a screen then turn toward a visible door.|Do not create a blind dead end or disconnected slab.
entry-double-door|Wide entrance door composition|Use a wider single entrance primitive in an appropriately wide wall opening.|No paired leaf swing mechanics are supported.
entry-portal-frame|Rectangular entrance portal|Frame the threshold with piers and a lintel-like volume below coordinated shelter.|No carved or arched portal geometry is available.
entry-rain-porch|Rain protected porch|Extend a supported canopy past the door and connect it to a drained-looking exterior landing.|Drainage is a design intent and is not simulated.
entry-court-door-axis|Court to door alignment|Set the pedestrian approach on a legible line from court edge to entrance.|Do not route it through a parked-car zone by default.
entry-offset-privacy|Offset entrance for privacy|Offset the front door from direct views into family living using a foyer wall return.|Do not eliminate an actual circulation opening behind the screen.
entry-stair-landing|Approach steps and landing|Compose rectangular treads terminating on a landing outside the door.|Do not imply code-compliant rises runs or headroom without verification.
entry-two-stage-gate|Gate and front door sequence|If requested place a simple screened threshold before a sheltered residential door.|No gate hinges access control or boundary survey is represented.
entry-gallery-end|Entrance at gallery termination|Terminate a covered approach gallery at a clear door recess.|Do not let posts obstruct the final approach.
entry-night-material|Entrance material emphasis|Use bronze or timber at the threshold and quieter ivory planes beside it.|No lighting fixtures or illumination performance are implemented.
entry-weather-lobby|Two threshold entrance lobby|Use a small enclosed lobby between exterior and living-room doors for privacy and weather separation.|Do not claim air sealing or HVAC performance.
`,
},
{
 category:'envelope',tags:['facade','windows','doors','house'],kinds:['wall','roof'],
 materials:'Ivory enclosure with limestone base or timber recess; bronze can distinguish selected panels.',
 supports:'Place opening-bearing walls on floor edges; keep opening bounds within host walls and align heads with roof undersides.',
 unsupported:'No weatherproofing, glazing specification, acoustic rating or thermal calculation.',
 rows:`
window-bay-spacing|Window bays and room use|Align individual opening bays to occupied room zones rather than imposing a grid across partitions.|Do not put a window across a room-dividing wall.
window-head-datum|Common window head datum|Coordinate door and window heads along a facade while varying sill heights by room privacy.|Do not raise opening heads through the roof plane.
window-solid-corner|Solid enclosure corners|Leave intentional solid wall returns at exposed corners for visual weight and furnishing.|Do not describe these returns as structurally sized piers.
window-deep-recess|Deep opening recess|Use a thicker host wall and recessed panel relationship for a shaded opening.|No custom beveled reveal mesh is available.
window-horizontal-view|Horizontal view opening|Use a broad opening in living-room enclosure with solid ends and coordinated shade.|Do not remove every solid wall needed for room use.
window-tall-narrow|Tall narrow bedroom opening|Use a vertical opening to balance privacy and daylight along a quieter edge.|Do not imply daylight adequacy from proportions alone.
window-corner-pair|Paired openings at a corner|Place separate openings on adjacent walls framing two stated outlooks.|Do not overlap walls and count the same glass twice.
window-bath-high|High bathroom privacy opening|Raise the sill in bathroom enclosure while retaining a real daylight opening.|No obscured-glass material or privacy simulation is supported.
window-stair-daylight|Stair enclosure daylight|Position a high opening beside an explicit landing without cutting guard edges.|A lit stairwell label does not construct steps.
facade-occupied-recess|Occupied facade recess|Set a terrace doorway back within a sheltered outdoor bay.|Do not treat an empty facade notch as a room.
facade-pier-rhythm|Facade pier rhythm|Alternate actual wall segments and openings to express room spacing.|Avoid office-like uniformity when room programmes differ.
facade-service-discretion|Quiet service facade|Use smaller well-placed openings on utility edges and maintain coherent wall datums.|Do not leave service rooms without any requested ventilation opportunity.
facade-rear-completion|Garden facade completion|Continue enclosure returns opening rhythm and shelter onto the rear elevation.|Do not design only the arrival-facing surface.
facade-floor-edge|Floor edge expression|Align a modest slab edge with wall bases to clarify occupied levels.|Do not add a floating band mistaken for a usable balcony.
facade-screen-layer|Screen before glazed room|Place a screen outside an opening with clear door access and a supported floor relationship.|No solar performance or operable louver system is modelled.
`,
},
{
 category:'roof-outdoor',tags:['roof','terrace','balcony','outdoor','estate'],kinds:['plate','roof'],
 materials:'Timber deck and ivory or limestone roof edges; guards may use the balcony glass primitive.',
 supports:'Support elevated decks with walls or posts, guard exposed edges, provide actual door access and supported shade.',
 unsupported:'No automatic stairs, waterproofing, drainage, roof loading or guard compliance certification.',
 rows:`
roof-main-secondary|Primary and secondary roof hierarchy|Give the principal occupied volume a clear roof and set lower roofs over subordinate spaces.|Do not let lower roofs intersect upper room windows.
roof-independent-wings|Independent wing roofs|Use separate roof sections aligned with individual wing enclosures and connector roofs.|Do not fill an intended courtyard with an oversized shared roof.
roof-gable-end-opening|Gable roof and end wall relationship|Keep rectangular end-wall openings below supported gable roof geometry.|No custom triangular glazed infill is available.
roof-hip-veranda|Hipped roof veranda relationship|Extend a hip roof over a defined veranda with clear support at its outer edge.|Do not assume the roof primitive constructs a veranda floor.
roof-flat-parapet|Flat roof edge with parapet|Place short wall segments at roof edges with deliberate drainage assumptions disclosed.|Do not claim waterproof roof construction from a parapet outline.
roof-terrace-door|Roof terrace access door|Connect the roof deck to an enclosed upper landing through an actual opening.|A rooftop deck without access is incomplete.
roof-terrace-zones|Roof terrace occupied zones|Separate the access landing shaded seating zone and exposed lookout with clear connected floor.|Do not cover a stair arrival with furniture or screen volumes.
roof-terrace-guard-gap|Roof terrace guard continuity|Compose guards along all exposed walking edges while leaving only the actual entry route open.|No guard safety or wind resistance is certified.
balcony-room-threshold|Bedroom balcony threshold|Place a deck outside a bedroom door and align walking datums before adding guards.|A glass railing alone is not a balcony.
balcony-recessed-loggia|Recessed upper loggia|Keep the outdoor floor within the upper volume's shelter and open only its outward edge.|Do not count the loggia as enclosed interior floor area.
terrace-wrap-corner|Terrace around a room corner|Join two outdoor slabs at a shared datum and retain useful door approaches.|Do not double-count overlapping slabs as extra area.
terrace-sun-shade|Sun and shade terrace sequence|Connect a sheltered outdoor living area to an uncovered view deck.|Do not add permanent shelter over an explicitly requested sun terrace.
terrace-dining-route|Outdoor dining circulation|Place the dining deck beside kitchen access with a passing route independent of the table zone.|No furniture-clearance solver validates this route.
terrace-private-screen|Private terrace screening|Use a screen along the overlooking edge of a suite terrace while keeping its view side open.|Do not obstruct its only access door.
terrace-ground-transition|Terrace to garden transition|Use actual steps or flush floor connections from deck to the flat site.|Do not imply existing terrain has been graded by a label.
`,
},
{
 category:'roof-outdoor',tags:['courtyard','garden','outdoor living','shade'],kinds:['plate','roof','volume'],
 materials:'Timber shade members and limestone outdoor paving; ivory supports keep a quiet background.',
 supports:'Construct connected walking plates with explicit shade supports and actual room thresholds nearby.',
 unsupported:'No planting generator, curved pergolas, rain drainage or microclimate simulation.',
 rows:`
court-living-edge|Living room court edge|Open shared living onto a usable court through a shaded threshold.|Do not seal the room behind uninterrupted walls.
court-private-edge|Private court edge|Use quieter openings and a sheltered path along bedroom sides of a court.|Do not route party traffic past every bedroom door.
court-open-sky|Court as unbuilt sky void|Build occupied perimeter rooms and leave the court centre without overhead geometry.|Do not roof the void while describing open sky.
court-water-separation|Court water and walking route|If water is requested separate its basin from a continuous dry circulation edge.|Do not use a water plane as pedestrian circulation.
court-entry-view|Court glimpse from entry|Frame a view toward the court beyond a real foyer doorway sequence.|Do not claim a visual axis through solid walls.
pergola-rectilinear|Rectilinear pergola shade|Compose repeated horizontal rectangular members over a connected deck with posts.|No curved beams or automatic pergola component exists.
pergola-wall-end|Pergola meeting residence|Seat one end at a credible wall relationship and support the outer edge.|Attachment alone does not establish load-bearing contact.
loggia-shared-edge|Loggia connecting public rooms|Use a roofed open strip outside living and dining with distinct door connections.|Do not label an enclosed corridor a loggia.
outdoor-kitchen-shelter|Outdoor kitchen sheltered shell|If requested place counter-like volumes beside dining under supported cover.|No appliances cooking equipment plumbing or ventilation are implemented.
outdoor-fire-feature-limit|Fire feature capability boundary|Reserve a disclosed location within an outdoor room for a future fire feature.|Do not fabricate flame burners or a functioning fireplace.
outdoor-reading-nook|Sheltered garden reading nook|Use a modest floor and supported shade beside a quiet room threshold.|Do not add a detached pavilion simply to increase complexity.
outdoor-shower-shell|Screened outdoor shower enclosure|If requested compose a privacy screen and floor beside wellness circulation.|No shower fixture drainage or water supply is supported.
outdoor-changing-room|Pool changing room shell|Place an enclosed changing room with a real door between wet deck and private circulation.|Do not imply sanitary fixtures or waterproofing are complete.
outdoor-wind-screen|Outdoor wind screen concept|Place a screen at an assumed exposed deck edge while preserving openings and views.|No wind direction or wind reduction is verified.
outdoor-room-end-wall|Outdoor room enclosing end|Use a solid end wall to give a covered deck privacy and a clear spatial limit.|Do not close all sides and still claim a ventilated open room.
`,
},
{
 category:'amenity',tags:['pool','spa','wellness','luxury'],kinds:['plate','wall','water'],
 materials:'Limestone basin-like enclosure and deck; water remains the dedicated rectangular surface primitive.',
 supports:'Construct a bottom below water, four connected perimeter edges and a dry approach deck; disclose absent services.',
 unsupported:'No hydraulic systems, filtration, waterproofing, hot-water equipment or arbitrary curved pools.',
 rows:`
pool-rectangular-lap|Rectangular lap pool composition|Place a long rectangular basin parallel to an occupied terrace with dry access on a long edge.|Do not describe water alone as a lap pool.
pool-court-alignment|Pool aligned to outdoor court|Set a bounded basin as a secondary element beside the court route.|Do not block entrance circulation with water.
pool-private-offset|Pool offset from bedroom edge|Place the basin away from quiet bedroom thresholds and connect it to shared outdoor living.|Do not put pool activity directly outside every suite door.
pool-house-connection|Pool house and main house relationship|Connect a changing-room shell to pool deck and main-house outdoor circulation.|Do not replace a complete residence with pool-side pavilions.
pool-deck-width|Usable pool deck edge|Provide a continuous dry plate outside basin walls for access and seating zones.|Do not count narrow coping as the whole deck.
pool-step-representation|Pool entry step representation|If requested compose rectangular submerged step volumes within basin bounds.|No anti-slip safety or underwater accessibility is verified.
pool-shallow-zone|Shallow pool zone representation|Use an explicit raised basin-bottom segment below a common water surface.|No excavation or hydraulics are simulated.
pool-spa-separation|Separate spa basin concept|If requested use a separate small rectangular basin connected by dry deck.|Do not claim heated jets or spa equipment.
pool-infinity-limit|Infinity edge capability disclosure|If infinity character is requested show a coherent basin edge and disclose missing overflow engineering.|Do not omit a basin wall merely to suggest endless water.
pool-edge-levels|Pool deck and water datums|Keep water beneath basin rim and relate deck walking surface to safe-looking dry access.|No hydraulic freeboard or safety compliance is certified.
pool-garden-view|Pool and garden outlook|Orient the long view from terrace across the basin toward an assumed garden edge.|Do not invent a surveyed horizon or use water as the only landscape.
pool-screened-service|Pool service reserve|Reserve a screened dry location near basin access if plant is requested.|No pump filter or pipework geometry is supported.
pool-child-barrier-limit|Pool barrier disclosure|If a barrier is requested use supported screen or guard geometry with an access gap disclosed.|Do not certify pool fencing gates or child safety.
pool-bridge-limit|Dry crossing beside pool|Prefer a continuous dry route around water; if a bridge is requested model its deck ends and guards.|Do not claim structural bridge performance.
pool-reflection-court|Shallow reflecting basin|Use a shallow bounded rectangular water feature beside a court with a distinct pedestrian edge.|Do not call a decorative basin a swimmable pool.
`,
},
{
 category:'amenity',tags:['gym','sports','garage','guest house','dock','amenities'],kinds:['plate','wall','roof','entrance'],
 materials:'Use ivory room shells with timber or limestone floors; material names do not supply sports finishes.',
 supports:'Enclose occupied amenity rooms with floor, actual entry opening and roof; exterior reservations remain clearly conceptual.',
 unsupported:'No specialist fitness equipment, court markings, vehicles, boats, dock hardware or facility certification.',
 rows:`
gym-terrace-edge|Gym beside sheltered terrace|Place an enclosed exercise room near a quiet outdoor deck with a wide actual opening.|Do not substitute a blank labelled slab for a gym room.
gym-changing-link|Gym changing relationship|Connect gym and changing-room shells without routing wet traffic through formal reception.|No lockers showers or sanitary services are implemented.
yoga-quiet-room|Quiet exercise studio|Place a simply proportioned room on a quiet edge with controlled openings and floor area.|No exercise equipment or acoustic performance is verified.
cinema-dark-shell|Cinema room shell|Place a window-light cinema shell off shared leisure circulation with an actual door.|No projector seating acoustics or blackout performance is implemented.
music-room-buffer|Music room conceptual buffer|Separate a music-room shell from bedrooms with storage or circulation enclosure.|No sound isolation or specialist music equipment is modelled.
games-room-family|Games room off family living|Connect a games-room shell to informal living rather than formal entrance circulation.|No billiard table or specialist recreation equipment is supported.
garage-service-door|Garage and service entry|Use an enclosed vehicle-storage shell with a wide real opening and separate pedestrian threshold.|No operational overhead garage-door mechanism or vehicle tracking.
garage-court-subordination|Garage subordinate to arrival|Place garage access along a secondary court edge and retain a clear house entrance.|Do not make garage openings the only architectural focal point.
garage-workshop-room|Garage workshop separation|Add an enclosed side room with an actual doorway if workshop space is requested.|No workshop tools fire separation or hazardous ventilation is verified.
guest-house-private-path|Guest house independent path|Give a requested guest house enclosed sleeping living and bathroom zones with independent exterior access.|Do not claim complete habitation from a roofed deck.
guest-house-shared-amenity|Guest house amenity relationship|Connect guest accommodation to shared leisure by an outdoor path while preserving bedroom privacy.|Do not force every guest trip through primary family rooms.
sports-court-reserve|Sports court spatial reservation|If requested reserve a flat outdoor plate away from bedroom edges with a clear approach.|A rectangle is a conceptual court footprint without markings net or certified dimensions.
waterfront-dock-limit|Waterfront dock conceptual deck|If requested use a guarded rectangular deck connected to site access and disclose marine limitations.|No piles mooring tide response bathymetry or marine engineering.
boathouse-shell-limit|Boathouse conceptual shell|If requested compose a waterfront storage shell with a large opening and a dry approach.|No boat slip lift ramps tides or navigational access is implemented.
sauna-shell-limit|Sauna room conceptual enclosure|Reserve an enclosed wellness room beside changing facilities with a real door.|No heater benches ventilation thermal safety or sauna operation is implemented.
`,
},
{
 category:'climate-site',tags:['tropical','caribbean','coastal','climate','shade'],kinds:['plate','wall','roof'],
 materials:'Light ivory wall planes with timber screens and limestone base; no reflectance or durability performance is implied.',
 supports:'Join shaded outdoor walking surfaces to real wall openings and supported overhead cover.',
 unsupported:'No climate simulation, storm rating, drainage design, corrosion specification or surveyed orientation.',
 rows:`
climate-opposed-openings|Opposed ventilation opportunities|Place openings on two available exterior sides of a room where the brief permits.|Do not claim airflow rates or cross ventilation through closed partitions.
climate-shaded-west|Assumed afternoon exposure shading|If west is known provide deeper exterior shade on that edge while retaining room openings.|Disclose the orientation assumption when west is unknown.
climate-rain-entry|Rain conscious arrival|Keep a continuous covered segment from approach landing to front door.|No wind driven rain performance is simulated.
climate-breezeway-gap|Open breezeway connector|Use a roofed open-sided connector between enclosed wings with a continuous floor.|Do not count the breezeway as enclosed residential area.
climate-deep-veranda|Deep veranda as thermal buffer|Place a sheltered outdoor room between major living glazing and exposed garden.|Do not claim cooling savings from veranda depth alone.
climate-high-low-opening|High and low opening opportunity|Use separate wall segments for low and high openings if a room needs varied ventilation opportunities.|No stack ventilation calculation or operable hardware is modelled.
climate-sun-court|Court with selective sun|Leave the court centre open and shade occupied edges according to stated exposure.|Do not roof every court edge without considering room light.
climate-insect-screen-limit|Insect screen capability limit|Disclose that the supported slatted screen is visual shading rather than insect mesh.|Do not call slats a sealed insect barrier.
climate-roof-rain-edge|Roof edge weather intent|Extend roof shelter over wall openings while preserving supported roof geometry.|No gutter downpipe or stormwater collection system exists.
climate-wet-dry-entry|Wet to dry entry sequence|Place a sheltered exterior landing before the interior threshold at pool or garden doors.|No slip resistance or waterproof junction is verified.
climate-coastal-material|Coastal material restraint|Use a limited conceptual palette and disclose missing marine finish specifications.|A bronze material name does not certify salt resistance.
climate-hurricane-limit|Storm resilience boundary|Retain compact coherent enclosure relationships if a storm-resilient brief requests them.|Do not claim hurricane resistance from massing or roof shape.
climate-humidity-storage|Humidity conscious storage location|Keep storage rooms near service access with an exterior opening opportunity where appropriate.|No dehumidification moisture control or mould prevention is verified.
climate-dry-season-shade|Dry season occupied shade|Prioritize a useful covered outdoor room next to shared living before additional exposed decks.|Do not infer seasonal solar angles without site data.
climate-night-privacy|Night privacy on glazed edges|Use solid wall returns or external screening on overlooked bedroom edges.|No light level or visual privacy simulation has been performed.
`,
},
{
 category:'climate-site',tags:['site','privacy','views','waterfront','access'],kinds:['plate','wall'],
 materials:'Limestone approach plates with ivory boundary walls or timber screen alternatives.',
 supports:'Keep paths on the flat site and connect actual thresholds; use explicit supported elements for level transitions.',
 unsupported:'No cadastral survey, setbacks, terrain grading, ecology, road design or sightline simulation.',
 rows:`
site-public-private-gradient|Public to private site gradient|Arrange arrival shared living and quiet garden edges in a legible sequence.|Do not put the main guest path through private terrace zones.
site-road-service-split|Road and service access split|If the site allows distinguish visitor approach from deliveries near the kitchen.|Do not invent a second public road.
site-view-cone|Protected principal view corridor|Keep lower secondary volumes away from the stated living-room outlook.|Do not assume all rooms can face the same narrow view.
site-neighbour-screen|Neighbour facing screen edge|Screen overlooked bedroom openings while keeping a separate daylight opportunity.|Do not invent neighbouring building heights or positions.
site-entrance-address|Entrance address from site access|Orient a readable approach toward the actual door from the brief's access edge.|Do not assume north is the street frontage.
site-court-turning-limit|Vehicle court conceptual footprint|Reserve a court beside a pedestrian approach with the garage on a secondary edge.|No swept path or turning radius verification is available.
site-flat-hillside-disclosure|Hillside brief on flat staging|Preserve hillside design intent in the explanation while constructing at flat Y=0 for new generation.|Do not fabricate cut fill retaining terrain or a surveyed slope.
site-existing-terrain-edit|Existing terrain during edits|Preserve stored terrain and local datum relationships during a targeted scene edit.|Do not flatten terrain to fit an unrelated requested feature.
site-waterfront-setback-limit|Waterfront edge uncertainty|Keep a conceptual dry access zone between occupied rooms and requested marine amenities.|Do not invent legal setbacks or tidal elevations.
site-garden-room-privacy|Garden room privacy sequence|Place a quieter outdoor retreat beyond shared terrace circulation with a screened threshold.|Do not claim an unseen garden exists without constructed outdoor space.
site-pedestrian-shortcut|Direct pedestrian approach|Provide a walking route from arrival to door independent of the broad vehicle court.|Do not require walking across a water basin.
site-delivery-threshold|Delivery threshold near storage|Connect secondary access to pantry or service storage with a short actual doorway sequence.|Do not send deliveries through bedrooms.
site-view-end-corridor|View at circulation termination|Terminate a corridor in an exterior opening or outdoor threshold toward a stated outlook.|Do not frame a view with a solid wall.
site-boundary-unknown|Unknown site boundaries|Keep site dimensions and building placement assumptions explicit until actual boundaries are supplied.|Do not represent conceptual edges as a legal property line.
site-quiet-loud-edges|Quiet and active outdoor edges|Separate sports pool parties and service activity from sleeping terraces where space allows.|No acoustic setback or sound attenuation is verified.
`,
},
{
 category:'construction',tags:['construction','complete','house','support','operations'],kinds:['plate','wall','roof'],
 materials:'Keep support and enclosure materials visually legible using the supported palette.',
 supports:'Check physical contact using world coordinates including parent transforms; metadata cannot manufacture geometry.',
 unsupported:'No automatic engineering, code compliance, arbitrary meshes or boolean cutting beyond wall openings.',
 rows:`
build-floor-wall-datum|Floor to wall datum|Place the enclosure base at the actual floor walking surface rather than slab centre.|Do not bury half the wall in the slab.
build-wall-roof-datum|Wall to roof datum|Align wall heads with overhead shelter without passing enclosure through the roof.|Do not assume a parent attachment sets the correct elevation.
build-door-sill-centre|Door centre and sill|Compute a child door centre from wall bottom plus sill plus half panel height.|Do not reuse the sill as child local centre Y.
build-multiple-openings|Multiple openings in one facade|Split the facade into coordinated opening-bearing wall segments.|Do not emit an unsupported array of openings on one wall.
build-glass-once|Single glass representation|Use glazed wall openings directly or separate glazing in an unglazed opening.|Do not overlay a second glass panel on rendered opening glass.
build-room-shell-hollow|Hollow room construction|Compose floors enclosure openings and roof for occupied rooms.|A solid volume with a bedroom label is not a bedroom.
build-court-by-separation|Court built by separated shells|Place room shells around an unbuilt void instead of requesting subtraction.|No CSG courtyard cut operation exists.
build-stair-treads|Manual rectangular stair representation|Compose explicit treads landings and guards connecting floor levels when feasible.|No automatic stair generation headroom or egress certification.
build-guard-host|Guard and deck relationship|Seat glass guard bottoms on actual exposed deck edges.|A balcony primitive creates railing rather than floor.
build-post-bearing|Post and beam contact|Align post tops to roof or beam underside and bottoms to floor or foundation.|Do not float a post near its supposed support.
build-upper-floor-support|Upper floor support concept|Align upper floor edges with lower enclosure or explicit supported spans.|Geometric contact is not structural capacity verification.
build-no-double-floor|Nonoverlapping floor allocation|Split room plates into nonoverlapping zones when calculating occupied surfaces.|Do not count coincident surfaces twice.
build-rotated-attachments|Rotated local attachments|Convert intended panel placements into the rotated host's local coordinates.|Do not mix world offsets with parent local offsets.
build-pool-bottom-order|Pool bottom and rim elevations|Keep a bottom below water and perimeter walls above it with a surrounding dry plate.|Do not claim a water plane and coping are a complete basin.
build-component-boundary|Approved component boundary|Use the curved pavilion only for its implemented open lounge purpose.|It is not an editable enclosed bedroom or arbitrary curved building.
`,
},
{
 category:'materials',tags:['materials','detailing','facade','timber','limestone'],kinds:['wall','roof'],
 materials:'Only ivory limestone timber bronze and sage are direct-scene material keys; use geometry for depth and disclose absent textures.',
 supports:'Finishes change existing element materials; actual layered details require separate supported elements.',
 unsupported:'No custom shader materials, textures, joinery, fasteners, thermal assemblies or fabrication details.',
 rows:`
material-stone-plinth|Stone-like base and light enclosure|Use limestone on an actual low plinth and ivory for room enclosure above.|A finish band alone is not a foundation.
material-timber-soffit-limit|Timber shade member expression|Use supported timber members at a porch roof edge to express warmth.|No separately mapped roof underside texture is provided.
material-bronze-threshold|Bronze threshold emphasis|Use bronze selectively on a real entrance panel within a restrained wall composition.|Do not change every facade element to bronze for luxury.
material-sage-service|Quiet sage service enclosure|Use sage sparingly on secondary service surfaces subordinate to primary living volumes.|A colour change does not create a separate room.
material-continuous-deck|Continuous deck material|Use a shared timber finish on physically connected outdoor plates.|Do not imply separate disconnected slabs form one route.
material-wet-dry-distinction|Wet and dry surface distinction|Use limestone-looking deck edges to distinguish dry access from water surfaces.|No anti-slip or wet-area rating is certified.
material-screen-depth|Material and screen depth|Use timber screen slats outside quieter enclosure to create actual layered depth.|Do not describe a wall colour as a three-dimensional screen.
material-door-wall-contrast|Door and wall contrast|Give the real door a distinct timber or bronze finish within light enclosure.|Do not paint a solid wall and call it an entrance.
material-recess-shadow|Recess geometry before finish|Set back a connector or opening plane to create depth before choosing finishes.|No shadow-gap texture is a substitute for geometry.
material-common-base|Shared base across wings|Align limestone base elements between wings while allowing different roof heights.|Do not add a slab crossing an intended court just to unify colour.
material-restrained-count|Restrained material hierarchy|Choose a dominant enclosure finish and one accent tied to entrance or shelter.|Do not assign arbitrary colours to every room shell.
material-garden-side|Garden side material continuity|Continue the primary wall palette through rear returns and terrace thresholds.|Do not leave the rear elevation as an unrelated material set.
material-roof-edge|Roof edge material hierarchy|Use a consistent finish on related roof sections to clarify the overall silhouette.|Do not let finish imply unavailable roof tile geometry.
material-interior-exterior|Interior and exterior continuity|Relate floor finishes across a real garden doorway while maintaining separate dry and outdoor zones.|No weatherproof threshold assembly is implemented.
material-stone-reveal|Stone-like opening reveal|Use actual wall thickness and limestone finish around selected openings.|Do not claim individual masonry blocks or carved profiles.
`,
},
{
 category:'construction',tags:['failure','edit','complete','construction','review'],kinds:['plate'],
 materials:'Preserve the established palette in targeted edits; use finish only on intended elements.',
 supports:'Audit actual referenced elements and spatial relationships after operations; preserve stable IDs for unrelated architecture.',
 unsupported:'These are prevention lessons curated from contract risks, not claimed empirical provider successes or failures.',
 rows:`
lesson-amenity-before-house|Prevent amenities replacing residence|Complete the main occupied shell and room relationships before optional leisure structures.|Do not label a small shell plus large pool a finished estate.
lesson-prose-without-elements|Prevent prose-only construction claims|Tie each applied feature decision to actual editable element IDs and disclose omitted parts.|A design description is not completed construction.
lesson-unrelated-references|Prevent unrelated evidence pointers|Reference elements that provide the physical parts required by the cited recipe.|A remote slab cannot evidence an entrance or bedroom wing.
lesson-stale-decision-ids|Prevent stale decision references|Recheck cited IDs after removals replacements and scoped edits.|Do not preserve a completion claim after its geometry was removed.
lesson-unsupported-substitute|Prevent invented amenity substitution|Disclose a missing capability and construct only the supported portion requested.|Do not turn a sauna dock or lift into a named solid block.
lesson-overlapping-room-labels|Prevent duplicate room claims|Allocate distinct nonoverlapping room floors and actual partitions where separate rooms are intended.|Do not assign three bedroom names to the same slab.
lesson-roof-over-void|Prevent covered double height void|Coordinate upper floor plates around the intended open volume.|Do not close a promised void with an upper slab.
lesson-roof-shortfall|Prevent incomplete overhead coverage|Check roof extents against all occupied floor edges after resizing.|Do not infer shelter from a roof label or centre point.
lesson-guard-no-access|Prevent inaccessible guarded deck|Connect the deck to a door landing and explicit vertical access when elevated.|Guard presence does not prove usable access.
lesson-move-host-children|Prevent detached edit dependents|Move host-attached panels and connected support geometry coherently.|Do not leave glazing guards or roofs at old positions.
lesson-resize-opening|Prevent opening and host mismatch|Recheck opening bounds and panel alignment after wall resizing.|Do not assume resize updates every dependent dimension.
lesson-preserve-unknowns|Prevent invented site facts|Keep orientation boundary and terrain assumptions explicit in design decisions.|Do not present conceptual site placement as surveyed.
lesson-single-view|Prevent presentation-only completion|Check rear side roof and approach relationships in addition to the main view.|A successful camera angle does not evidence enclosure completeness.
lesson-door-over-wall|Prevent doors on uncut enclosure|Cut a real opening in the door host and align the panel to its sill and head.|Do not paste a door over a solid wall and claim room access.
lesson-minimal-edit|Prevent unrelated redesign on edit|Restrict retrieval and geometry changes to the requested feature while preserving unrelated stable IDs.|Do not regenerate the house to add a doorway.
`,
},
];

export const EXPANDED_ARCHITECTURAL_GUIDANCE: KnowledgeRevision[] = groups.flatMap(group =>
 group.rows.trim().split('\n').map(line => {
  const [id,title,placement,failure] = line.split('|');
  if (!id || !title || !placement || !failure) throw Error('Invalid curated knowledge row');
  const fragment=fragmentDetails[id];
  let kinds=fragment?.requiredKinds ?? group.kinds;
  if (['sports-court-reserve','waterfront-dock-limit'].includes(id)) kinds=['plate'];
  if (['outdoor-fire-feature-limit'].includes(id)) kinds=['plate'];
  if (/^roof-terrace/.test(id)) kinds=['plate','balcony','entrance','roof'];
  if (/^balcony-/.test(id)) kinds=['plate','balcony','entrance'];
  if (id==='build-pool-bottom-order') kinds=['plate','wall','water'];
  if (id==='roof-flat-parapet') kinds=['roof','wall'];
  return {
   id,title,kind: group.category === 'construction' && id.startsWith('lesson-') ? 'experience' : 'recipe',
   category:group.category, recipeType:id.startsWith('lesson-') ? 'failure' : group.category==='materials' ? 'material' : group.category==='programme' ? 'relationship' : group.category==='tradition' || group.category==='composition' ? 'pattern' : 'feature',
   tags:[...new Set([...group.tags, ...(fragment?.terms ?? []), ...id.split('-').filter(t=>t.length>3)])].slice(0,20),scales:[],
   when:`Use when the brief or chosen programme calls for ${title.toLowerCase()}.`,
   placement,principles:failure,combinations:fragment?.combinations ?? group.materials,
   capabilities:`Use direct-scene primitives: ${kinds.join(', ')}. ${group.unsupported}`,
   construction:{operations:['add','attach','place-on','finish'],requiredKinds:kinds,materials:group.materials,supports:fragment?.supports ?? group.supports,unsupported:group.unsupported},
   sources:[{reference:'src/lib/villa/scene/terra.ts',kind:'repository',verified:true,note:'Checked primitive names against the direct-scene contract; individually curated conceptual relationships, not external research or a regulation.'}],
   status:'approved',supersedes:[],review:'Conceptual design and supported-primitive review. No claim of engineering, historical authenticity or completed provider construction.',version:1,updatedAt:'2026-10-28T00:00:00.000Z',
  } satisfies KnowledgeRevision;
 })
);
