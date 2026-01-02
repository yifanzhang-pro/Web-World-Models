import React, { useLayoutEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PlanetData } from '../types';
import { CLAIMED_ASTEROIDS } from '../constants';

interface AsteroidBeltProps {
  onSelect: (data: PlanetData) => void;
  registerRef: (name: string, ref: THREE.Object3D) => void;
}

const SECTOR_NAMES = [
  "Aurora",
  "Borealis",
  "Zenith",
  "Helios",
  "Terminus",
  "Nyx",
  "Pioneer",
  "Outer Reach"
];

const describeAsteroidFromPosition = (pos: THREE.Vector3, index: number) => {
  const radius = pos.length();
  const angle = Math.atan2(pos.z, pos.x); // -PI..PI
  const angleNorm = (angle + Math.PI * 2) % (Math.PI * 2);
  const sectorIdx = Math.floor(angleNorm / (2 * Math.PI / SECTOR_NAMES.length));
  const sector = SECTOR_NAMES[sectorIdx];

  const band = radius < 48 ? "Inner Band" : radius < 52 ? "Mid Band" : "Outer Drift";
  const composition = radius < 48 ? "metal-rich basalt and nickel" : radius < 52 ? "mixed nickel-ice rubble" : "volatile-laden ice-rock";
  const inclination = Math.abs(pos.y);
  const stability = inclination < 0.5 ? "near the ecliptic, offering a very stable orbit" : "slightly inclined and intersects denser debris lanes";

  const ownerRecord = CLAIMED_ASTEROIDS[sectorIdx % CLAIMED_ASTEROIDS.length];
  const angleDeg = Math.round(angleNorm * 180 / Math.PI);
  const name = `Asteroid ${sector}-${band.replace(' ', '')}-#${index}`;
  const description = `${band} body in the ${sector} sector (θ≈${angleDeg}°, r≈${radius.toFixed(1)} AU scaled). Composition skews toward ${composition}, ${stability}. ${ownerRecord.desc}`;

  return {
    name,
    owner: ownerRecord.owner,
    description,
    color: radius < 48 ? "#9b9b9b" : radius < 52 ? "#8c8680" : "#7c7a8a"
  };
};

const AsteroidBelt: React.FC<AsteroidBeltProps> = ({ onSelect, registerRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const focusTargetRef = useRef<THREE.Group>(null);
  const selectionTick = useRef(0);
  
  const count = 1500; 
  const minRadius = 46; 
  const maxRadius = 54; 
  const beltHeight = 1.5;

  // Store local positions of all asteroids to find nearest neighbor later
  const asteroidPositions = useRef<THREE.Vector3[]>([]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    const positions: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * beltHeight;

      const pos = new THREE.Vector3(x, y, z);
      positions.push(pos);

      dummy.position.copy(pos);
      dummy.rotation.set(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      );
      const scale = Math.random() * 0.3 + 0.05;
      dummy.scale.set(scale, scale, scale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      const greyVal = 0.4 + Math.random() * 0.4;
      meshRef.current.setColorAt(i, new THREE.Color(greyVal, greyVal * 0.9, greyVal * 0.8));
    }
    
    asteroidPositions.current = positions;

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

  }, [count, minRadius, maxRadius, dummy]);

  useFrame(() => {
    if (groupRef.current) {
      // Rotate the container group (Mesh + Hitbox + FocusTarget)
      groupRef.current.rotation.y += 0.0005;
    }
  });

  const handleInteraction = (e: any) => {
    e.stopPropagation();
    
    // 1. Get the point of impact in World Space
    const hitPoint = e.point.clone();

    // 2. Convert to Local Space of the rotating group
    // This allows us to find the nearest asteroid regardless of how much the belt has rotated
    if (groupRef.current) {
      groupRef.current.worldToLocal(hitPoint);
    }

    // 3. Find nearest asteroid
    let minDistSq = Infinity;
    let nearestIdx = 0;

    asteroidPositions.current.forEach((pos, idx) => {
      const distSq = pos.distanceToSquared(hitPoint);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearestIdx = idx;
      }
    });

    // 4. Move the Focus Target to the nearest asteroid's position
    const nearestPos = asteroidPositions.current[nearestIdx];
    // Round distance to a single decimal to avoid long strings in the UI
    const distanceFromSun = parseFloat(nearestPos.length().toFixed(1));
    if (focusTargetRef.current) {
      focusTargetRef.current.position.copy(nearestPos);
    }

    // 5. Generate Data and Register
    // We append the index to the name to ensure uniqueness so the Scene camera re-triggers travel if we click a different one
    const inferred = describeAsteroidFromPosition(nearestPos, nearestIdx);
    selectionTick.current += 1;
    // Suffix tick so re-clicking the same rock still retriggers camera travel
    const uniqueName = `${inferred.name}-sel${selectionTick.current}`;

    // Register the focus target ref under this unique name
    if (focusTargetRef.current) {
      registerRef(uniqueName, focusTargetRef.current);
    }

    const asteroidData: PlanetData = {
      name: uniqueName,
      description: inferred.description,
      distance: distanceFromSun, // scaled distance from sun in scene units
      radius: 0.1, 
      speed: 0, 
      color: inferred.color,
      type: 'asteroid',
      owner: inferred.owner
    };

    onSelect(asteroidData);
  };

  return (
    <group ref={groupRef}>
      {/* 
        Invisible Hitbox (Torus) 
        Allows clicking anywhere in the belt ring to snap to nearest 
      */}
      <mesh 
        rotation={[Math.PI / 2, 0, 0]} 
        onClick={handleInteraction}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
        visible={false} 
      >
        {/* Radius 50, Tube 4 covers 46-54 range well */}
        <torusGeometry args={[50, 4, 8, 64]} />
        <meshBasicMaterial color="red" wireframe opacity={0.2} transparent />
      </mesh>

      {/* The Visual Asteroids */}
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, count]} 
        // We also allow clicking individual rocks directly
        onClick={handleInteraction}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.8} metalness={0.2} />
      </instancedMesh>

      {/* Dynamic Focus Target for Camera */}
      <group ref={focusTargetRef}>
        {/* Optional: Add a tiny marker to show which one is selected */}
        {/* <mesh>
          <sphereGeometry args={[0.2]} />
          <meshBasicMaterial color="red" />
        </mesh> */}
      </group>
    </group>
  );
};

export default AsteroidBelt;
