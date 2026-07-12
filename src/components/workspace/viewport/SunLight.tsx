/** Bright warm midday sun — high intensity for Sims/GTA-style saturated outdoor lighting. */
export function SunLight() {
  return (
    <directionalLight
      position={[40, 35, 20]}
      intensity={3.0}
      color="#fffbee"
      castShadow
      shadow-mapSize-width={4096}
      shadow-mapSize-height={4096}
      shadow-camera-left={-50}
      shadow-camera-right={50}
      shadow-camera-top={50}
      shadow-camera-bottom={-50}
      shadow-camera-near={0.5}
      shadow-camera-far={180}
      shadow-bias={-0.0001}
      shadow-normalBias={0.025}
    />
  );
}
