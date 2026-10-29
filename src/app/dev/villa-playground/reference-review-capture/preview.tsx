'use client';
import {useState} from 'react';
import {ReviewPreview} from '../review-preview';
import type {ReviewConfig,SceneCapture} from '@/lib/villa/visual-review';
const views=['Aerial','Arrival','Poolside'] as const;
export function CaptureReview({config,poses}:{config:ReviewConfig;poses?:SceneCapture[]}){
 const [shots,setShots]=useState<SceneCapture[]>([]),[error,setError]=useState('');
 return <main><p id="capture-error">{error}</p>{shots.length<3&&<ReviewPreview key={shots.length} config={config} view={views[shots.length]} cameraPose={poses?.[shots.length].camera} ready={s=>setShots(v=>[...v,s])} onError={setError}/>}<script id="captures" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify(shots)}}/><p id="done">{shots.length===3?'Complete':'Capturing'}</p></main>;
}
