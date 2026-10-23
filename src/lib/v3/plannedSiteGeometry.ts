/** Explicit vocabulary aliases only. Never infer geometry from labels or choose a finish. */
const aliases: Record<string,string> = {
  terrace:'terrace', 'paved terrace':'terrace', deck:'terrace', 'timber deck':'terrace',
  courtyard:'courtyard', court:'courtyard', 'paved court':'courtyard', 'arrival court':'courtyard',
  'arrival space':'courtyard', 'arrival-court':'courtyard', 'paved arrival court':'courtyard',
  fountain:'fountain', 'fountain basin':'fountain',
  pool:'pool', 'swimming pool':'pool', 'swimming-pool':'pool',
  'landscape-zone':'landscape-zone', lawn:'landscape-zone', garden:'landscape-zone',
  'garden zone':'landscape-zone', 'garden-zone':'landscape-zone',
  path:'path', walkway:'path', 'pedestrian path':'path', driveway:'driveway', canopy:'canopy',
};
export function plannedSiteType(type:string):string|undefined {
  return Object.hasOwn(aliases,type.trim().toLowerCase())?aliases[type.trim().toLowerCase()]:undefined;
}
export const plannedDrySurface = (type:string) => ['terrace','courtyard','landscape-zone','path','driveway'].includes(plannedSiteType(type)??'');
