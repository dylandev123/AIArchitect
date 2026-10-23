// Conservative source catalog: emit sites plus referenced diagnostic codes in the gate's dependency closure.
import ts from 'typescript';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
const root=process.cwd(),seen=new Set(),codes=new Map();
const exceptions={
  ARCHITECTURAL_DOOR_CLIPPED:'draft-tolerable only for supported internal room-to-room cutouts',
  ARCHITECTURAL_DOOR_OVERLAP:'draft-tolerable only for supported internal room-to-room cutouts',
  DOOR_OUTSIDE_BOUNDARY:'draft-tolerable only for supported internal room-to-room cutouts',
  CIRCULATION_NOT_USABLE:'draft-tolerable only with working alternative reaching all storeys and intended top',
  STAIR_APPROACH_UNSUPPORTED:'draft-tolerable only with working alternative reaching all storeys and intended top',
  STAIR_ACCESS_BLOCKED:'draft-tolerable only with working alternative reaching all storeys and intended top',
  STAIR_OPENING_BLOCKED:'draft-tolerable only with working alternative reaching all storeys and intended top',
  STAIR_LANDING_UNSUPPORTED:'draft-tolerable only with working alternative reaching all storeys and intended top',
  ESTATE_ACCESS_DISCONNECTED:'draft-tolerable only for canonical ribbon boundary overrun >0 and <=0.15m; valid endpoints and no collisions',
  ARCHITECTURAL_PART_FINISH:'draft-tolerable only for facade trim beam finish; geometry and ownership exact',
  ARCHITECTURAL_DERIVED_ENVELOPE_REBUILT:'locally-recoverable derived envelope; recorded correction',
};
function visit(path){
  if(seen.has(path)||!existsSync(path))return;seen.add(path);
  const text=readFileSync(path,'utf8'),source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  function walk(node){
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
      const spec=node.moduleSpecifier.text,base=spec.startsWith('.')?resolve(dirname(path),spec):spec.startsWith('@/')?resolve(root,'src',spec.slice(2)):null;
      if(base)for(const ext of ['.ts','.tsx','/index.ts'])if(existsSync(base+ext)){visit(base+ext);break;}
    }
    if(ts.isStringLiteral(node)&&/^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(node.text)){
      const line=source.getLineAndCharacterOfPosition(node.getStart()).line+1;
      const record={file:relative(root,path),line,source:text.split('\n')[line-1].trim()};
      const entry=codes.get(node.text)??{code:node.text,policy:exceptions[node.text]??'If fatal/physical at independent construction: core-blocking. Advisory severity remains advisory.',references:[]};
      entry.references.push(record);codes.set(node.text,entry);
    }
    ts.forEachChild(node,walk);
  }walk(source);
}
for(const name of ['architecturalBlueprintGeneration','architecturalBlueprint','architecturalAcceptance','ingestion'])visit(resolve(root,`src/lib/v3/${name}.ts`));
writeFileSync('docs/architecture/architectural-blueprint-pipeline/REJECTION_INVENTORY.json',JSON.stringify({scope:'Diagnostic code literals in transitive local pipeline dependencies. Includes advisory and code-reference sites, not just fatal emitters. Unknown fatal codes remain core-blocking; no broad prefix downgrade.',files:seen.size,codes:[...codes.values()].sort((a,b)=>a.code.localeCompare(b.code))},null,2)+'\n');
console.log(JSON.stringify({files:seen.size,codes:codes.size}));
