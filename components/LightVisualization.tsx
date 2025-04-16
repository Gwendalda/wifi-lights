"use client";

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Define the props for the component, including the light devices data
interface LightVisualizationProps {
  // Add any necessary props here, e.g., device data
  // devices: BulbDeviceData[]; // Example if needed
}

const LightVisualization: React.FC<LightVisualizationProps> = (props) => {
  return (
    <Canvas style={{ height: '400px', width: '100%', background: '#27272a' }} // Example styling
            camera={{ position: [0, 5, 10], fov: 50 }} // Set initial camera position and field of view
    >
      {/* Ambient light for basic scene illumination */}
      <ambientLight intensity={0.5} />
      {/* Directional light for shadows and highlights */}
      <directionalLight position={[10, 10, 5]} intensity={1} />
      {/* Point light for another light source example */}
      <pointLight position={[-10, -10, -10]} />

      {/* Placeholder for actual light representations */}
      {/* We will map device data to 3D objects here later */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* OrbitControls allow rotating, panning, and zooming the scene */}
      <OrbitControls />
    </Canvas>
  );
};

export default LightVisualization;
