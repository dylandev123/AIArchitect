import type { ArchitecturalScene, SceneElement } from './model';
export type CompletionFinding = {
    category: 'confirmed-technical-defect' | 'likely-architectural-incompleteness' | 'unsupported-capability' | 'subjective-design-concern';
    code: string; elementIds: string[]; message: string;
};
/** Conservative evidence checks, never transaction validators or automatic repairs. */
export function circulationFindings(scene: ArchitecturalScene): CompletionFinding[] {
    const map = new Map(scene.elements.map(e => [e.id, e]));
    const cache = new Map<string, number[]>();
    function world(e: SceneElement): number[] {
        const known = cache.get(e.id); if (known) return known;
        const p = e.parent ? world(map.get(e.parent)!) : undefined;
        const result = p ? [p[0]+Math.cos(p[3])*e.at[0]+Math.sin(p[3])*e.at[2],p[1]+e.at[1],p[2]-Math.sin(p[3])*e.at[0]+Math.cos(p[3])*e.at[2],p[3]+e.rotation] : [...e.at,e.rotation];
        cache.set(e.id,result); return result;
    }
    const top = (e: SceneElement) => world(e)[1]+e.size[1]/2;
    // SAT contact works in arbitrary parent/yaw frames. Contact is evidence only:
    // headroom, barriers, tread proportions and route usability remain unverified.
    function contact(a: SceneElement,b: SceneElement) {
        const p=world(a),q=world(b);
        return [p[3],q[3]].every(yaw=>[yaw,yaw+Math.PI/2].every(angle=>{
            const radius=(e:SceneElement,r:number[])=>Math.abs(Math.cos(r[3]-angle))*e.size[0]/2+Math.abs(Math.sin(r[3]-angle))*e.size[2]/2;
            return Math.abs((p[0]-q[0])*Math.cos(angle)-(p[2]-q[2])*Math.sin(angle))<=radius(a,p)+radius(b,q)+.03;
        }));
    }
    const surfaces=scene.elements.filter(e=>e.kind==='plate' || e.kind==='volume');
    // Only explicitly identified room floors seed the audit. Coping, roofs,
    // foundations and unlabeled solids must not invent residential storeys.
    const floors=surfaces.filter(e=>e.kind==='plate' && /floor/i.test(e.label+' '+e.id) && e.size[0]*e.size[2]>=4 && !/pool|basin|coping|foundation/i.test(e.label+' '+e.id));
    if (!floors.length) return [];
    const low=Math.min(...floors.map(top));
    const reached=new Set(surfaces.filter(e=>floors.includes(e) && Math.abs(top(e)-low)<.05).map(e=>e.id));
    let changed=true;
    while(changed) {
        changed=false;
        for(const a of surfaces) if(!reached.has(a.id) && surfaces.some(b=>reached.has(b.id) && Math.abs(top(a)-top(b))<=.25 && contact(a,b))) {reached.add(a.id);changed=true;}
    }
    const findings: CompletionFinding[]=[];
    const inaccessible=floors.filter(e=>top(e)>low+.5 && !reached.has(e.id));
    if(inaccessible.length) findings.push({category:'likely-architectural-incompleteness',code:'vertical-route-missing',elementIds:inaccessible.map(e=>e.id),message:'Upper room floors have no spatially connected plate/solid step-and-landing sequence from the lowest room floor; vertical circulation is not evidenced. Deliberate lifts, ramps and alternative circulation require review.'});
    // Same-level disconnected floor groups indicate a gap, not necessarily a
    // defect: detached wings and independent stairs can be intentional.
    for(const datum of [...new Set(inaccessible.map(e=>Math.round(top(e)*100)/100))]) {
        const group=floors.filter(e=>Math.abs(top(e)-datum)<.05);
        const seen=new Set<string>(); const components:string[][]=[];
        for(const seed of group) if(!seen.has(seed.id)) {
            const ids=[seed.id];seen.add(seed.id);
            for(let i=0;i<ids.length;i++) for(const e of surfaces) if(!seen.has(e.id) && Math.abs(top(e)-datum)<.05 && contact(map.get(ids[i])!,e)) {ids.push(e.id);seen.add(e.id);}
            components.push(ids);
        }
        if(components.length>1) findings.push({category:'likely-architectural-incompleteness',code:'upper-floor-gap',elementIds:group.map(e=>e.id),message:'Upper room floors form separate surface groups without a same-level slab connection. Review landings/corridors or intended independent access; do not fill deliberate voids automatically.'});
    }
    // Only diagnose an entire shared rectangular boundary blocked at walking
    // height. Partial walls, rotated pairs and alternative routes are not failures.
    for(let i=0;i<floors.length;i++) for(let j=0;j<i;j++) {
        const a=floors[i],b=floors[j],p=world(a),q=world(b);
        if(!/kitchen|dining|living|salon|lounge|gallery/i.test(a.id+' '+a.label) || !/kitchen|dining|living|salon|lounge|gallery/i.test(b.id+' '+b.label)) continue;
        if(Math.abs(top(a)-top(b))>.05 || Math.abs(Math.sin(p[3]-q[3]))>.001) continue;
        const dx=Math.cos(p[3])*(q[0]-p[0])-Math.sin(p[3])*(q[2]-p[2]);
        const dz=Math.sin(p[3])*(q[0]-p[0])+Math.cos(p[3])*(q[2]-p[2]);
        for(const axis of [0,2]) {
            const across=axis===0?dx:dz,along=axis===0?dz:dx,other=axis===0?2:0;
            if(Math.abs(Math.abs(across)-(a.size[axis]+b.size[axis])/2)>.05) continue;
            const lo=Math.max(-a.size[other]/2,along-b.size[other]/2),hi=Math.min(a.size[other]/2,along+b.size[other]/2);
            if(hi-lo<.8) continue;
            const cross=Math.sign(across)*a.size[axis]/2;
            const wall=scene.elements.find(w=>{
                if(w.kind!=='wall' && w.kind!=='glazing') return false;
                if(w.opening && !w.opening.glazed && w.opening.sill<=.25 && w.opening.width>=.8 && w.opening.height>=1.9) return false;
                const r=world(w),yaw=p[3]+(axis===0?Math.PI/2:0);
                if(Math.abs(Math.sin(r[3]-yaw))>.001 || r[1]-w.size[1]/2>top(a)+.1 || r[1]+w.size[1]/2<top(a)+1.9) return false;
                const x=Math.cos(p[3])*(r[0]-p[0])-Math.sin(p[3])*(r[2]-p[2]);
                const z=Math.sin(p[3])*(r[0]-p[0])+Math.cos(p[3])*(r[2]-p[2]);
                const normal=axis===0?x:z,center=axis===0?z:x;
                return Math.abs(normal-cross)<=w.size[2]/2+.05 && center-w.size[0]/2<=lo+.05 && center+w.size[0]/2>=hi-.05;
            });
            if(wall) findings.push({category:'likely-architectural-incompleteness',code:'shared-boundary-blocked',elementIds:[a.id,b.id,wall.id],message:`${a.id} / ${b.id}: entire shared floor boundary is blocked by ${wall.id} with no usable unglazed opening. Review intended direct access or an alternative route; a window does not establish passage.`});
        }
    }
    return findings;
}
