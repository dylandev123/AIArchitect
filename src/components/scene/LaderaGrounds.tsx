'use client';
import { FinishBox } from './architecture';
import { TropicalPalm } from './tropical-palm';
import { Planter, SunLounger } from './grounds';

export function LaderaGrounds() {
    return <group name="Ladera garden staging">
 <FinishBox name="ladera-lawn" at={[0, -.6, 0]} size={[500, .2, 500]} color="#738163" surface="grass"/>
 {([-18, -9, 3, 16, 22] as number[]).map((x, i) => <group key={x} position={[x, -.4, -12 - (i % 2) * 3]}><TropicalPalm height={10 + i % 3} variant={i}/></group>)}
 <Planter at={[-15, 0, 0]} width={1.3} depth={17}/><Planter at={[0, 0, -8.8]} width={29} depth={1.2}/>
 {[3, 5, 7].map(x => <SunLounger key={x} at={[x, .3, 12]}/>)}
 </group>;
}
