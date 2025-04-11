"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";

import { BulbDeviceData } from "@/lib/lights"; // Assuming BulbDeviceData is here

interface LightVisualizationProps {
  devices: BulbDeviceData[];
}

const LightVisualization: React.FC<LightVisualizationProps> = ({ devices }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current; // Capture mountRef.current

    // Scene setup
    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0xf0f0f0); // Light grey background

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000,
    );

    camera.position.z = 5; // Move camera back

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    // Basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light

    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);

    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // --- Placeholder Geometry ---
    // Replace this with logic based on `devices` prop
    const geometry = new THREE.SphereGeometry(0.5, 32, 32); // Example sphere
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green
    const spheres: THREE.Mesh[] = [];

    // Position spheres based on device count (simple linear layout)
    const spacing = 1.5;
    const totalWidth = (devices.length - 1) * spacing;
    const startX = -totalWidth / 2;

    devices.forEach((device, index) => {
      // Determine color based on device status (simple on/off)
      const isOn = device.last_status?.power === 'ON'; // Use power state instead
      const color = isOn ? 0xffff00 : 0x333333; // Yellow for on, dark grey for off
      const sphereMaterial = new THREE.MeshStandardMaterial({ color: color });
      const sphere = new THREE.Mesh(geometry, sphereMaterial);

      sphere.position.x = startX + index * spacing;
      spheres.push(sphere);
      scene.add(sphere);
    });
    // --- End Placeholder ---

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      // Add any animations here (e.g., sphere rotation)
      // spheres.forEach(sphere => {
      //   sphere.rotation.x += 0.01;
      //   sphere.rotation.y += 0.01;
      // });
      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!currentMount) return; // Check if currentMount is still valid
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      // Check if renderer.domElement exists and has a parent before removing
      if (renderer.domElement.parentNode === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      // Dispose Three.js objects
      geometry.dispose();
      material.dispose();
      // Dispose materials created in the loop
      spheres.forEach((sphere) => {
        if (sphere.material instanceof THREE.Material) {
          sphere.material.dispose();
        }
        // If you have multiple materials per sphere
        // if (Array.isArray(sphere.material)) {
        //   sphere.material.forEach(mat => mat.dispose());
        // }
      });
      renderer.dispose();
      console.log("Three.js scene cleaned up");
    };
  }, [devices]); // Re-run useEffect if devices array changes

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
};

export default LightVisualization;
