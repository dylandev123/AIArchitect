'use client';
import { useEffect, useState } from 'react';
import { ReviewPreview } from '../villa-playground/review-preview';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import type { SceneCapture } from '@/lib/villa/visual-review';

declare global {
 interface Window {
  retainedReviewCapture?: (scene: ArchitecturalScene, view: SceneCapture['view'], pose?: SceneCapture['camera']) => Promise<SceneCapture>;
 }
}
/** Local automation supplies retained data. This page cannot call a provider or save a project. */
export function RetainedReviewCapture() {
 const [capture, setCapture] = useState<{ scene: ArchitecturalScene; view: SceneCapture['view']; pose?: SceneCapture['camera']; resolve: (shot: SceneCapture) => void; reject: (error: Error) => void; serial: number }>();
 useEffect(() => {
  let serial = 0;
  window.retainedReviewCapture = (scene, view, pose) => new Promise((resolve, reject) => setCapture({ scene, view, pose, resolve, reject, serial: ++serial }));
  return () => { delete window.retainedReviewCapture; };
 }, []);
 return <main><h1>Retained house visual experiment</h1><p>Development capture only. Exact editable scene; normal review renderer.</p>{capture && <ReviewPreview key={capture.serial} config={capture.scene} view={capture.view} cameraPose={capture.pose} ready={capture.resolve} onError={message => capture.reject(Error(message))} />}</main>;
}
