/**
 * LightVisualization component that renders a 3D scene using Three.js.
 * Provides a canvas with basic lighting setup and a placeholder light representation.
 */
"use client";

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BulbDeviceData } from '@/lib/devices';

interface LightVisualizationProps {
  devices: BulbDeviceData[];
}

/**
 * Renders a 3D visualization of light devices in a Three.js canvas.
 * @param {LightVisualizationProps} props - Component props
 * @returns {JSX.Element} A canvas containing the 3D scene
 */
const LightVisualization: React.FC<LightVisualizationProps> = (props) => {
  return (
    <Canvas style={{ height: '400px', width: '100%', background: '#27272a' }}
            camera={{ position: [0, 5, 10], fov: 50 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -10]} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
};

export default LightVisualization;
