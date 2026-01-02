
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const MilkyWay: React.FC = () => {
  const count = 8000; // Number of stars in the band

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const colorPalette = [
      new THREE.Color("#ffffff"), // White
      new THREE.Color("#f0f8ff"), // AliceBlue
      new THREE.Color("#e6e6fa"), // Lavender
      new THREE.Color("#fffacd"), // LemonChiffon
      new THREE.Color("#87cefa"), // LightSkyBlue
      new THREE.Color("#ffb6c1"), // LightPink (faint nebula feel)
    ];

    for (let i = 0; i < count; i++) {
      // Distance from center (large radius for background, outside solar system)
      const r = 450 + Math.random() * 400;
      
      // Angle around the galaxy center (0-2PI)
      const theta = Math.random() * Math.PI * 2;

      // Elevation angle. We want a band, so concentrate around PI/2 (equator).
      // We use a power function to cluster points near 0 offset.
      // spreadFactor goes from -1 to 1.
      const spreadFactor = (Math.random() - 0.5) * 2; 
      
      // Squaring or Cubing the factor makes it cluster near 0.
      // Multiplier determines thickness of the band.
      const width = 0.25 + Math.random() * 0.1; 
      const phiOffset = Math.sign(spreadFactor) * Math.pow(Math.abs(spreadFactor), 2) * width; 
      
      const phi = Math.PI / 2 + phiOffset;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color assignment
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      
      // Randomize opacity/brightness in the vertex color
      const intensity = 0.4 + Math.random() * 0.6;

      colors[i * 3] = color.r * intensity;
      colors[i * 3 + 1] = color.g * intensity;
      colors[i * 3 + 2] = color.b * intensity;
    }

    return { positions, colors };
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  // Subtle rotation of the background galaxy
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.00005;
    }
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 4, 0, Math.PI / 6]}> 
      {/* Tilted at an angle to look natural from the ecliptic plane */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.2}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};

export default MilkyWay;
