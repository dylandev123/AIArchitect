/** Bright warm midday sun — high intensity for Sims/GTA-style saturated outdoor lighting. */
export function SunLight() {
  return (
    <directionalLight
      position={[40, 35, 20]}
      intensity={3.0}
      color="#fffbee"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={45}
      shadow-camera-bottom={-45}
      shadow-camera-near={0.5}
      shadow-camera-far={150}
      shadow-bias={-0.0002}
      shadow-normalBias={0.015}
    />
  );
}
