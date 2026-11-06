/** Existing rectangular pool assembly datums. z is the near dry apron edge, not water. */
/** Pool-specific operations (edits, legacy v1 sites) require an existing pool. */
export function requirePool<P>(pool:P|undefined):P{if(!pool)throw Error('This house has no swimming pool.');return pool;}
export type PoolGeometry={x:number;z:number;w:number;d:number;nearDeckDepth?:number};
export const poolNearDeck=(p:PoolGeometry)=>p.nearDeckDepth??1.5;
export const poolWaterNorth=(p:PoolGeometry)=>p.nearDeckDepth===undefined?p.z+2.2:p.z+p.nearDeckDepth+.7;
export const poolReservation=(p:PoolGeometry)=>({x0:p.x-(p.w/2+1.6),x1:p.x+(p.w/2+1.6),z0:p.z,z1:p.nearDeckDepth===undefined?p.z+p.d+4.4:poolWaterNorth(p)+p.d+2.2});
