interface SunLightProps {
  position: [number, number, number];
  intensity: number;
  color: string;
}

export function SunLight({ position, intensity, color }: SunLightProps) {
  return (
    <directionalLight
      position={position}
      intensity={intensity}
      color={color}
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
