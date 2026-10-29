/** Offline: no provider, secrets, network or application-store writes. */
import { writeFile } from 'node:fs/promises';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from '../src/lib/library/architecture/seeds';
import { retrieveArchitecturalKnowledge } from '../src/lib/library/architecture/retrieval';
const prompts = ['A $25m Caribbean waterfront estate','A compact three-bedroom family home','A grand Mediterranean courtyard mansion'];
const proof = prompts.map(prompt => {const {selected,chars,text,project}=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,prompt);return {prompt,project,selected,chars,estimatedTokens:Math.ceil(chars/4),injectedText:text};});
await writeFile('docs/architecture/knowledge-brain/retrieval-proof.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof.map(({prompt,selected,chars,estimatedTokens})=>({prompt,selected,chars,estimatedTokens})),null,2));
