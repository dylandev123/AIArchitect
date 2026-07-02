export function SunLight() {
  return (
    <directionalLight
      position={[40, 35, 20]}
      intensity={2.2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={45}
      shadow-camera-bottom={-45}
      shadow-camera-near={0.5}
      shadow-camera-far={150}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}
