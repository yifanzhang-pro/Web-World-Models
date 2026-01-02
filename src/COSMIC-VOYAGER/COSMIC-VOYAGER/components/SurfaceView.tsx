
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { PointerLockControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PlanetData, TerrainProfile } from '../types';
import { SOLAR_SYSTEM_DATA } from '../constants';
import MilkyWay from './MilkyWay';
import { getTerrainPreference } from '../services/geminiService';

interface SurfaceViewProps {
  planet: PlanetData;
  onSunAltitudeChange?: (sunAltitude: number) => void;
}

const SCALE = 50; // Scale multiplier to make the planet feel "terrain-sized"
const WALK_SPEED = 0.5; // Radians per second roughly
const DAY_NIGHT_SPEED = 0.02; // Rad/s for slow spin to create a day-night cycle
const BASE_MAX_TERRAIN_DISPLACEMENT = 0.12; // Baseline radial offset applied to the terrain
const HEIGHT_MARGIN = 0.05; // Extra margin above tallest peak
const MIN_CAMERA_BUFFER = 8; // Absolute minimum camera clearance in world units
const ROCK_COUNT = 450; // Surface scatter density

const createSeededRandom = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
};

const SurfaceView: React.FC<SurfaceViewProps> = ({ planet, onSunAltitudeChange }) => {
  const { camera } = useThree();
  const [terrainStyle, setTerrainStyle] = useState<TerrainProfile>('balanced');
  const worldRef = useRef<THREE.Group>(null);
  const skyRef = useRef<THREE.Group>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const sunLightRef = useRef<THREE.PointLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemisphereRef = useRef<THREE.HemisphereLight>(null);
  const planetRadius = planet.radius * SCALE;

  // LLM-guided terrain tuning: adjust roughness based on Gemini's suggestion
  useEffect(() => {
    let cancelled = false;
    getTerrainPreference(planet.name)
      .then((style) => {
        if (!cancelled) setTerrainStyle(style);
      })
      .catch(() => {
        if (!cancelled) setTerrainStyle('balanced');
      });
    return () => {
      cancelled = true;
    };
  }, [planet.name]);

  const terrainTuning = useMemo(() => {
    if (terrainStyle === 'flat') {
      return { maxDisplacement: BASE_MAX_TERRAIN_DISPLACEMENT * 0.5, peakCount: 8 };
    }
    if (terrainStyle === 'mountainous') {
      return { maxDisplacement: BASE_MAX_TERRAIN_DISPLACEMENT * 1.6, peakCount: 24 };
    }
    return { maxDisplacement: BASE_MAX_TERRAIN_DISPLACEMENT, peakCount: 16 };
  }, [terrainStyle]);

  const safeSurfaceRadius = planetRadius * (1 + terrainTuning.maxDisplacement + HEIGHT_MARGIN);
  const cameraBaseRadius = Math.max(safeSurfaceRadius, planetRadius + MIN_CAMERA_BUFFER);
  
  // Movement State
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Calculate planetary positions relative to the current landed planet
  const { sunPosition, otherPlanets } = useMemo(() => {
    // Current planet's orbital angle (simplified static time for now)
    const time = Date.now() * 0.0001; 
    
    // Position of the planet we are ON
    const myAngle = time * planet.speed;
    const myX = Math.cos(myAngle) * planet.distance;
    const myZ = Math.sin(myAngle) * planet.distance;
    const myPos = new THREE.Vector3(myX, 0, myZ);

    // Calculate Sun Position relative to us (Sun is at 0,0,0 in solar coords)
    // relativeSun = Sun - MyPos = (0,0,0) - MyPos = -MyPos
    const sunPos = myPos.clone().negate().multiplyScalar(SCALE);

    // Calculate other planets relative to us
    const others = SOLAR_SYSTEM_DATA
      .filter(p => p.name !== planet.name)
      .map(p => {
        const pAngle = time * p.speed + (Math.random() * 10); // Add randomness so they aren't a line
        const pX = Math.cos(pAngle) * p.distance;
        const pZ = Math.sin(pAngle) * p.distance;
        const pPos = new THREE.Vector3(pX, 0, pZ);
        
        // Relative position: Other - Mine
        const relPos = pPos.sub(myPos).multiplyScalar(SCALE);
        return { ...p, position: relPos };
      });

    return { sunPosition: sunPos, otherPlanets: others };
  }, [planet]);

  // Generate varied topography by displacing a sphere with seeded peaks and layered noise
  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(planetRadius, 192, 192);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const seededRandom = createSeededRandom(planet.name);
    const roughnessScale = terrainTuning.maxDisplacement / BASE_MAX_TERRAIN_DISPLACEMENT;
    const peaks = Array.from({ length: terrainTuning.peakCount }).map(() => ({
      direction: new THREE.Vector3(
        seededRandom() * 2 - 1,
        seededRandom() * 2 - 1,
        seededRandom() * 2 - 1
      ).normalize(),
      height: (0.03 + seededRandom() * 0.06) * roughnessScale, // Adjusted by LLM-guided roughness
      sharpness: 1.5 + seededRandom() * 2.5,
    }));

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      normal.copy(vertex).normalize();

      // Sum peak influences
      let displacement = peaks.reduce((acc, peak) => {
        const influence = Math.max(normal.dot(peak.direction), 0);
        return acc + Math.pow(influence, peak.sharpness) * peak.height;
      }, 0);

      // Layered trigonometric noise for ridges/valleys
      displacement += Math.sin(normal.x * 6 + normal.y * 4 + normal.z * 5) * 0.02 * roughnessScale;
      displacement += (Math.sin(normal.x * 12) * 0.01 + Math.cos(normal.z * 10) * 0.01) * roughnessScale;

      // Cap total displacement to avoid clipping the camera
      displacement = Math.min(displacement, terrainTuning.maxDisplacement);

      const displacedRadius = planetRadius * (1 + displacement);
      vertex.setLength(displacedRadius);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }, [planet.name, planetRadius, terrainTuning.maxDisplacement, terrainTuning.peakCount]);

  // Scatter rocks roughly following the deformed surface
  const rocks = useMemo(() => {
    const dummy = new THREE.Object3D();
    const seededRandom = createSeededRandom(`${planet.name}-rocks`);

    return Array.from({ length: ROCK_COUNT }).map((_, i) => {
      // Fibonacci-ish sampling with jitter to cover the sphere evenly
      const t = (i + 0.5) / ROCK_COUNT;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + seededRandom() * 0.35;

      const radiusJitter = 1.01 + seededRandom() * 0.02; // Sit slightly above terrain
      const x = planetRadius * Math.cos(theta) * Math.sin(phi) * radiusJitter;
      const y = planetRadius * Math.sin(theta) * Math.sin(phi) * radiusJitter;
      const z = planetRadius * Math.cos(phi) * radiusJitter;

      const pos = new THREE.Vector3(x, y, z);
      
      // Orient rock to face outward
      const normalDir = pos.clone().normalize();
      const target = pos.clone().add(normalDir);
      
      dummy.position.copy(pos);
      dummy.lookAt(target);
      dummy.rotateZ(seededRandom() * Math.PI * 2);

      const largeChance = seededRandom();
      const scale = largeChance > 0.8 ? 2 + seededRandom() * 2 : 0.6 + seededRandom() * 1.2;

      return {
        position: dummy.position.clone(),
        quaternion: dummy.quaternion.clone(),
        scale,
      };
    });
  }, [planet.name, planetRadius]);

  // Setup Camera
  useEffect(() => {
    // Position camera at "North Pole" relative to the sphere
    camera.position.set(0, cameraBaseRadius, 0);
    camera.lookAt(0, cameraBaseRadius, -100);
    // Increase view distance to see other planets
    camera.far = 30000;
    camera.updateProjectionMatrix();

    // Reset rotation of world on entry
    if(worldRef.current) {
        worldRef.current.rotation.set(0,0,0);
    }
    if(skyRef.current) {
        skyRef.current.rotation.set(0,0,0);
    }
  }, [planet, camera, cameraBaseRadius]);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') moveState.current.forward = true;
      if (e.code === 'KeyS') moveState.current.backward = true;
      if (e.code === 'KeyA') moveState.current.left = true;
      if (e.code === 'KeyD') moveState.current.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') moveState.current.forward = false;
      if (e.code === 'KeyS') moveState.current.backward = false;
      if (e.code === 'KeyA') moveState.current.left = false;
      if (e.code === 'KeyD') moveState.current.right = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // TREADMILL LOGIC
  useFrame((state, delta) => {
    if (!worldRef.current) return;

    // 1. Get Camera Look Direction (projected to XZ plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // 2. Calculate Move Vector based on Input
    const moveDir = new THREE.Vector3(0, 0, 0);
    if (moveState.current.forward) moveDir.add(forward);
    if (moveState.current.backward) moveDir.sub(forward);
    if (moveState.current.right) moveDir.add(right);
    if (moveState.current.left) moveDir.sub(right);

    const moving = moveDir.lengthSq() > 0;
    if (moving) {
      moveDir.normalize();

      // 3. Rotate World AND Sky in OPPOSITE direction to simulate walking
      const axis = new THREE.Vector3().crossVectors(moveDir, new THREE.Vector3(0, 1, 0)).normalize();
      const angle = WALK_SPEED * delta;
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      worldRef.current.applyQuaternion(q);
      skyRef.current?.applyQuaternion(q);
      
      // Head Bob
      const time = state.clock.getElapsedTime();
      const radialDir = camera.position.clone().normalize();
      const bob = Math.max(0, Math.sin(time * 15) * 0.2);
      const targetRadius = cameraBaseRadius + bob;
      camera.position.copy(radialDir.multiplyScalar(targetRadius));
    } else {
       // Ease camera back to a safe radius (no downward bob while idle)
       const radialDir = camera.position.clone().normalize();
       const targetRadius = cameraBaseRadius;
       const currentRadius = camera.position.length();
       const easedRadius = THREE.MathUtils.lerp(currentRadius, targetRadius, 0.1);
       camera.position.copy(radialDir.multiplyScalar(easedRadius));
    }

    // 4. Slow planetary spin to create day/night, only rotate terrain so the sun moves across the sky
    const spinQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), DAY_NIGHT_SPEED * delta);
    worldRef.current.applyQuaternion(spinQuat);

    // 5. Dynamic lighting based on sun altitude
    const sunWorldPos = new THREE.Vector3();
    sunMeshRef.current?.getWorldPosition(sunWorldPos);
    const sunDir = sunWorldPos.clone().normalize();
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(worldRef.current.quaternion).normalize();
    const sunHeight = THREE.MathUtils.clamp((localUp.dot(sunDir) + 0.1) / 1.1, 0, 1); // 0 at night, 1 at zenith
    if (onSunAltitudeChange) {
      onSunAltitudeChange(sunHeight);
    }

    if (sunLightRef.current) {
      sunLightRef.current.intensity = THREE.MathUtils.lerp(0.25, 4, sunHeight);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(0.08, 0.55, sunHeight);
      ambientRef.current.color.lerpColors(
        new THREE.Color('#0b1024'),
        new THREE.Color('#ffffff'),
        sunHeight
      );
    }
    if (hemisphereRef.current) {
      hemisphereRef.current.intensity = THREE.MathUtils.lerp(0.05, 0.4, sunHeight);
      hemisphereRef.current.color.lerpColors(
        new THREE.Color('#1d2d55'),
        new THREE.Color('#ffffff'),
        sunHeight
      );
      hemisphereRef.current.groundColor.lerpColors(
        new THREE.Color('#02040c'),
        new THREE.Color('#1a2a1a'),
        sunHeight
      );
    }
  });

  return (
    <>
      <PointerLockControls 
        makeDefault 
        onUnlock={() => {
            // Reset movement state when unlocked to prevent "stuck" walking
            moveState.current.forward = false;
            moveState.current.backward = false;
            moveState.current.left = false;
            moveState.current.right = false;
        }}
      />
      
      {/* The World Group rotates beneath the player */}
      <group ref={worldRef}>
        
        {/* The Planet Ground (Deformed Sphere) */}
        <mesh receiveShadow geometry={terrainGeometry}>
          <meshStandardMaterial 
            color={planet.color} 
            roughness={0.7} 
            metalness={0.1}
            emissive={planet.color}
            emissiveIntensity={0.18}
          />
        </mesh>

        {/* Scattered Rocks on Surface */}
        {rocks.map((rock, i) => (
            <group key={i} position={rock.position} quaternion={rock.quaternion}>
                 <mesh 
                    scale={[rock.scale, rock.scale, rock.scale]}
                    castShadow
                >
                    <dodecahedronGeometry args={[2, 0]} />
                    <meshStandardMaterial 
                      color={planet.color} 
                      roughness={0.9} 
                      emissive={planet.color}
                      emissiveIntensity={0.1}
                    />
                </mesh>
            </group>
        ))}
      </group>

      {/* Sky objects rotate with movement but not the planet's day/night spin */}
      <group ref={skyRef}>
        {/* The Actual Sun Light Source */}
        <pointLight 
            ref={sunLightRef}
            position={sunPosition} 
            intensity={3.5} 
            distance={100000} 
            decay={0.1} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
        />
        {/* Sun Visual */}
        <mesh ref={sunMeshRef} position={sunPosition}>
            <sphereGeometry args={[200, 32, 32]} />
            <meshBasicMaterial color="#FDB813" />
        </mesh>

        {/* Other Planets in the Sky */}
        {otherPlanets.map((p) => (
            <group key={p.name} position={p.position}>
                {/* Planet Visual */}
                <mesh>
                    <sphereGeometry args={[p.radius * SCALE, 32, 32]} />
                    <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.5} />
                </mesh>
                {/* Rings */}
                {p.hasRings && (
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[p.radius * SCALE * 1.4, p.radius * SCALE * 2.2, 64]} />
                        <meshStandardMaterial color={p.ringColor} side={THREE.DoubleSide} transparent opacity={0.5} />
                    </mesh>
                )}
                {/* Label (Very large so visible from far away) */}
                <mesh position={[0, p.radius * SCALE * 2, 0]}>
                    <sphereGeometry args={[SCALE * 2, 8, 8]} />
                    <meshBasicMaterial color={p.color} transparent opacity={0.6} />
                </mesh>
            </group>
        ))}

        {/* Background Stars (Attached to the sky) */}
        <group scale={[20, 20, 20]}>
            <MilkyWay />
            <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade />
        </group>
      </group>

      {/* Ambient and Hemisphere light for visibility */}
      <ambientLight ref={ambientRef} intensity={0.35} />
      <hemisphereLight 
        ref={hemisphereRef}
        skyColor="#ffffff" 
        groundColor="#000000" 
        intensity={0.25} 
      />
    </>
  );
};

export default SurfaceView;
