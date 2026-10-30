'use client';
import {useState} from 'react';
import type {SceneElement,SceneOperation} from '@/lib/villa/scene/model';
/** Explicit apply keeps partial JSON out of the scene/history. */
export function ProfileEditor({element,edit}:{element:SceneElement;edit:(operations:SceneOperation[])=>void}){
 const [text,setText]=useState(JSON.stringify(element.geometry,null,2));
 const [error,setError]=useState('');
 return <details><summary>Profile vertices and curves</summary><p>Dimensions scale the profile. Apply commits one editable version.</p><textarea aria-label="Profile geometry" value={text} onChange={e=>setText(e.target.value)} /><button type="button" onClick={()=>{try{const geometry=JSON.parse(text);edit([{op:'replace',id:element.id,element:{...element,geometry}}]);setError('');}catch(e){setError(String(e));}}}>Apply profile</button>{error&&<p role="alert">{error}</p>}</details>;
}
