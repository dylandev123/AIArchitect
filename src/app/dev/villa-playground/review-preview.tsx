'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { LaderaGrounds } from '@/components/scene/LaderaGrounds';
import { OperationScene } from '@/components/scene/OperationScene';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import { buildComposition } from '@/lib/villa/composition';
import { inspectCapture, type ReviewConfig, type SceneCapture } from '@/lib/villa/visual-review';
import { VillaScene, type View, type CameraPose, type Vector } from './scene';

class PreviewBoundary extends Component<{ children: ReactNode; onError?: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.('The review scene could not render. Check WebGL and retry manually.'); }
  render() { return this.state.failed ? <p role="alert">Review renderer unavailable. Original preserved.</p> : this.props.children; }
}
/** A disposed preview intentionally loses its GL context. Remove the listener
 * before disposal so applying a preview cannot report a false rendering failure. */
function ContextLoss({onLost}:{onLost:()=>void}) {
  const gl=useThree(state=>state.gl);
  useEffect(()=>{
    const canvas=gl.domElement;
    canvas.addEventListener('webglcontextlost',onLost);
    return ()=>canvas.removeEventListener('webglcontextlost',onLost);
  },[gl,onLost]);
  return null;
}
function Capture({ view, ready, onError }: { view: View; ready?: (image: SceneCapture) => void; onError?: (message: string) => void }) {
  const started = useRef<number | null>(null), sent = useRef(false);
  useFrame(({ gl, scene, camera, controls }) => {
    if (!ready || sent.current) return;
    started.current ??= performance.now();
    if (performance.now() - started.current < 2000) return;
    sent.current = true;
    // Run after the existing PostFx composer has rendered this frame; never replace it.
    queueMicrotask(() => {
      try {
        const canvas = gl.domElement;
        const architecture = scene.getObjectByName('Property architecture');
        if (!architecture) throw new Error('Architecture unavailable for camera framing.');
        const bounds = new THREE.Box3().setFromObject(architecture);
        const center = bounds.getCenter(new THREE.Vector3()).project(camera);
        if (bounds.isEmpty() || !Number.isFinite(center.x) || Math.abs(center.x) > .9 || Math.abs(center.y) > .9 || Math.abs(center.z) > 1) throw new Error('Architecture is outside the capture camera.');
        if (gl.getContext().isContextLost()) throw new Error('WebGL context lost during capture.');
        const probe = document.createElement('canvas'); probe.width = 32; probe.height = 18;
        const context = probe.getContext('2d');
        if (!context) throw new Error('Capture verification unavailable.');
        context.drawImage(canvas, 0, 0, 32, 18);
        const pixels = context.getImageData(0, 0, 32, 18).data;
        const colors = new Set<string>();
        for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        if (colors.size < 8) throw new Error('Capture is blank or incomplete.');
        // Responsive review previews use the same bounded evidence format as fixed previews.
        const output = document.createElement('canvas'); output.width = 640; output.height = 360;
        const outputContext = output.getContext('2d');
        if (!outputContext) throw new Error('Capture canvas unavailable.');
        outputContext.drawImage(canvas, 0, 0, 640, 360);
        const image = output.toDataURL('image/png');
        const dimensions = inspectCapture(image);
        const target = (controls as OrbitControlsImpl | null)?.target;
        if (!target) throw new Error('Camera framing unavailable.');
        ready({ image, view: view as SceneCapture['view'], ...dimensions, camera: { position: camera.position.toArray() as Vector, target: target.toArray() as Vector } });
      } catch (error) { onError?.(error instanceof Error ? error.message : 'Canvas capture failed.'); }
    });
  });
  return null;
}
export function ReviewPreview({ captureRevision = 0, children, config, view, cameraPose, responsive = false, ready, onError }: { captureRevision?: number; children?: ReactNode; responsive?: boolean; config: ReviewConfig | ArchitecturalScene; view: View; cameraPose?: CameraPose; ready?: (image: SceneCapture) => void; onError?: (message: string) => void }) {
  const [failure, setFailure] = useState('');
  const direct = 'version' in config && config.version === 'architectural-scene-1' ? config : undefined;
  const composition = useMemo(() => 'version' in config && config.version === 1 ? buildComposition(config) : undefined, [config]);
  if (failure) return <p role="alert">{failure} Original preserved.</p>;
  return <div style={responsive ? { width: '100%', aspectRatio: '16 / 9' } : { width: 640, height: 360, flexShrink: 0 }}>
    <PreviewBoundary onError={onError}><Canvas dpr={1} shadows="soft" gl={{ preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, logarithmicDepthBuffer: true }} camera={{ position: [33, 28, 43], fov: 39, near: .1, far: 4000 }} fallback={<p role="alert">WebGL unavailable. No capture was made.</p>}>
      <ContextLoss onLost={()=>{setFailure('WebGL context lost.');onError?.('WebGL context lost.');}}/><Suspense fallback={null}><VillaScene poolElementId={direct?.elements.find(e=>e.kind==='water')?.id} grounds={direct ? <LaderaGrounds /> : undefined} replaceArchitecture={!!direct} frameArchitectureOnly interactive={false} cameraPose={cameraPose} mood="Daylight" view={view} reset={captureRevision} tour={false} {...(direct ? {} : composition ? { composition } : { config: config as Exclude<ReviewConfig, { version: number }> })}>{direct && <OperationScene scene={direct} onSelect={() => {}} />}{children}</VillaScene><Capture key={captureRevision} view={view} ready={ready} onError={onError} /></Suspense>
    </Canvas></PreviewBoundary>
  </div>;
}
