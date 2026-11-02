import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {SemanticGenerationCheckpoint} from './viewer';
export default async function Page(){
 if(process.env.NODE_ENV!=='development')notFound();
 const mocks=await Promise.all(['family','luxury'].map(name=>readFile(`docs/architecture/semantic-generation/mocks/${name}.response.json`,'utf8')));
 return <SemanticGenerationCheckpoint mocks={mocks}/>;
}
