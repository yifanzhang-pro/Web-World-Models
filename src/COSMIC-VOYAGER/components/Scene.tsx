
import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, FlyControls } from '@react-three/drei';
import * as THREE from 'three';
import Planet from './Planet';
import Sun from './Sun';
import SurfaceView from './SurfaceView';
import MilkyWay from './MilkyWay';
import AsteroidBelt from './AsteroidBelt';
import { SOLAR_SYSTEM_DATA } from '../constants';
import { PlanetData, ViewContext } from '../types';

interface SceneProps {
  onPlanetSelect: (planet: PlanetData) => void;
  selectedPlanetName: string | null;
  isFlyMode: boolean;
  isLanded: boolean;
  onViewContextChange?: (ctx: ViewContext) => void;
}

const findCelestialBody = (name: string): PlanetData | any | undefined => {
  // Check main planets
  const planet = SOLAR_SYSTEM_DATA.find(p => p.name === name);
  if (planet) return planet;

  // Check moons
  for (const p of SOLAR_SYSTEM_DATA) {
    if (p.moons) {
      const moon = p.moons.find(m => m.name === name);
      if (moon) return moon;
    }
  }
  return undefined;
};

const getVisualRadius = (name: string): number => {
  if (name === "The Sun") return 14; 
  if (name.includes("Asteroid")) return 0.5;
  
  const body = findCelestialBody(name);
  if (!body) return 2; // Fallback
  
  // If it's a planet with rings, account for ring size
  if (body.hasRings && body.radius) {
     return body.radius * 2.2; 
  }
  
  return body.radius || 1;
};

const CameraController: React.FC<{ 
  selectedPlanetName: string | null; 
  planetRefs: React.MutableRefObject<Record<string, THREE.Object3D>>;
  isFlyMode: boolean;
}> = ({ selectedPlanetName, planetRefs, isFlyMode }) => {
  const { camera } = useThree();
  const [isTraveling, setIsTraveling] = useState(false);
  const orbitControlsRef = useRef<any>(null);
  const lastTargetPos = useRef<THREE.Vector3>(new THREE.Vector3());
  
  useEffect(() => {
    if (selectedPlanetName) {
      setIsTraveling(true);
      // Initialize last position to avoid jumps
      if (planetRefs.current[selectedPlanetName]) {
        planetRefs.current[selectedPlanetName].getWorldPosition(lastTargetPos.current);
      }
    }
  }, [selectedPlanetName, planetRefs]);

  useFrame(() => {
    // 1. Handle Orbit Mode "Follow/Lock" Logic
    if (!isFlyMode && orbitControlsRef.current) {
      const controls = orbitControlsRef.current;

      if (selectedPlanetName && planetRefs.current[selectedPlanetName]) {
        const targetObj = planetRefs.current[selectedPlanetName];
        const targetPos = new THREE.Vector3();
        targetObj.getWorldPosition(targetPos);

        // 2. Camera Tracking Logic
        // If we are NOT traveling (i.e. we have arrived), we need to manually move the camera
        // to match the object's movement. This creates a "geostationary" lock.
        if (!isTraveling) {
            const delta = targetPos.clone().sub(lastTargetPos.current);
            // Move camera by the same amount the object moved
            camera.position.add(delta);
            // Update controls target to exactly match object center
            controls.target.copy(targetPos);
        } else {
             // While traveling, we smoothly look at the destination
             controls.target.lerp(targetPos, 0.1);
        }

        // 3. Handle "Travel" Animation (Approach)
        if (isTraveling) {
          // Calculate approach direction
          let approachVector: THREE.Vector3;

          if (selectedPlanetName === "The Sun") {
             // Special handling for Sun at (0,0,0). 
             approachVector = camera.position.clone().normalize();
          } else {
             // For planets/moons, approach from the "Sunny Side" (Vector from Object -> Sun)
             // Approx Sun is 0,0,0. Vector Obj->Sun is -ObjPos.
             // Note: For moons, this effectively puts the camera between the moon and the sun, 
             // which might also be between the moon and the planet, which is usually a good view.
             approachVector = targetPos.clone().negate().normalize();
          }
          
          // DYNAMIC ZOOM CALCULATION
          // Goal: Fit object to ~60% of screen height
          const targetRadius = getVisualRadius(selectedPlanetName);
          
          // @ts-ignore - fov exists on PerspectiveCamera
          const fov = camera.fov * (Math.PI / 180);
          
          // Distance required to fit object 100% vertically: dist = radius / sin(fov/2)
          // To fit 60%, we divide by 0.6
          const fitPercentage = 0.6;
          const offsetDistance = (targetRadius / Math.sin(fov / 2)) / fitPercentage;

          // For planets, look slightly down; for asteroids/sun/moons, centered is fine
          let offsetHeight = targetRadius * 0.3; 
          const isMoon = findCelestialBody(selectedPlanetName)?.distance && !findCelestialBody(selectedPlanetName)?.moons; 
          // (Simple heuristic: Moons have distance but no moons array in my data constants usually, or we can check type)

          if (selectedPlanetName === "The Sun" || selectedPlanetName.includes("Asteroid") || isMoon) {
            offsetHeight = 0;
          }
          
          const idealPos = targetPos.clone()
            .add(approachVector.multiplyScalar(offsetDistance))
            .add(new THREE.Vector3(0, offsetHeight, 0));

          camera.position.lerp(idealPos, 0.05);

          // Stop traveling when close enough
          if (camera.position.distanceTo(idealPos) < 0.5) {
            setIsTraveling(false);
          }
        }
        
        // Update last tracking position for the next frame
        lastTargetPos.current.copy(targetPos);
      }
      
      controls.update();
    }
  });

  return isFlyMode ? (
    <FlyControls 
      movementSpeed={20}
      rollSpeed={0.4}
      dragToLook={true}
    />
  ) : (
    <OrbitControls 
      ref={orbitControlsRef}
      enablePan={true} 
      enableZoom={true} 
      minDistance={0.5} 
      maxDistance={500} 
      enableDamping={true}
      dampingFactor={0.05}
    />
  );
};

const Scene: React.FC<SceneProps> = ({ onPlanetSelect, selectedPlanetName, isFlyMode, isLanded, onViewContextChange }) => {
  const planetRefs = useRef<Record<string, THREE.Object3D>>({});
  const sunAltitudeRef = useRef<number | undefined>(undefined);

  const registerRef = (name: string, ref: THREE.Object3D) => {
    planetRefs.current[name] = ref;
  };

  const handlePlanetSelect = (data: PlanetData) => {
    if (!isFlyMode) {
      onPlanetSelect(data);
    }
  };

  const handleSunSelect = () => {
    if (!isFlyMode) {
      onPlanetSelect({
        name: "The Sun",
        description: "The star at the center of the Solar System. It is a nearly perfect sphere of hot plasma.",
        distance: 0,
        radius: 109,
        color: "#FDB813",
        speed: 0,
        type: 'star'
      });
    }
  };

  // Safe lookup handling moons/planets
  const selectedPlanetData = findCelestialBody(selectedPlanetName || "");

  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 60, 140], fov: 45 }} shadows>
        {isLanded && selectedPlanetData && selectedPlanetData.type === 'planet' ? (
          // Surface View (Only for Planets)
          <SurfaceView 
            planet={selectedPlanetData} 
            onSunAltitudeChange={(alt) => { sunAltitudeRef.current = alt; }}
          />
        ) : (
          // Solar System View
          <>
            <color attach="background" args={['#020205']} />
            <ambientLight intensity={0.15} /> 
            <Stars radius={300} depth={60} count={5000} factor={4} saturation={0} fade speed={1} />
            <MilkyWay />
            
            <Sun onSelect={handleSunSelect} registerRef={registerRef} />

            <AsteroidBelt onSelect={handlePlanetSelect} registerRef={registerRef} />

            {SOLAR_SYSTEM_DATA.map((planet) => (
              <Planet 
                key={planet.name} 
                data={planet} 
                onSelect={(data) => handlePlanetSelect(data)}
                isSelected={selectedPlanetName === planet.name}
                registerRef={registerRef}
              />
            ))}

            <CameraController 
              selectedPlanetName={selectedPlanetName} 
              planetRefs={planetRefs}
              isFlyMode={isFlyMode}
            />

            {/* Report view context for AI prompt tailoring */}
            {onViewContextChange && (
              <ViewContextReporter 
                selectedPlanetName={selectedPlanetName}
                planetRefs={planetRefs}
                isFlyMode={isFlyMode}
                isLanded={isLanded}
                onViewContextChange={onViewContextChange}
                sunAltitudeRef={sunAltitudeRef}
              />
            )}
          </>
        )}
      </Canvas>
    </div>
  );
};

export default Scene;

// Helper component inside Canvas to collect camera/target context
const ViewContextReporter: React.FC<{
  selectedPlanetName: string | null;
  planetRefs: React.MutableRefObject<Record<string, THREE.Object3D>>;
  isFlyMode: boolean;
  isLanded: boolean;
  onViewContextChange: (ctx: ViewContext) => void;
  sunAltitudeRef: React.MutableRefObject<number | undefined>;
}> = ({ selectedPlanetName, planetRefs, isFlyMode, isLanded, onViewContextChange, sunAltitudeRef }) => {
  const { camera } = useThree();
  const lastPayload = useRef<ViewContext | null>(null);
  useFrame(() => {
    // Determine target position (selected body) if available
    let targetPos: THREE.Vector3 | null = null;
    if (selectedPlanetName && planetRefs.current[selectedPlanetName]) {
      targetPos = new THREE.Vector3();
      planetRefs.current[selectedPlanetName].getWorldPosition(targetPos);
    }
    const cameraDistance = targetPos 
      ? Number(camera.position.distanceTo(targetPos).toFixed(1)) 
      : Number(camera.position.length().toFixed(1));

    const payload: ViewContext = {
      mode: isLanded ? 'landed' : isFlyMode ? 'fly' : 'orbit',
      cameraDistance,
      sunAltitude: isLanded ? sunAltitudeRef.current : undefined,
      targetName: selectedPlanetName,
    };

    // Avoid spamming identical payloads
    const changed = !lastPayload.current 
      || lastPayload.current.mode !== payload.mode
      || lastPayload.current.targetName !== payload.targetName
      || lastPayload.current.cameraDistance !== payload.cameraDistance
      || Math.abs((lastPayload.current.sunAltitude ?? -1) - (payload.sunAltitude ?? -1)) > 0.02;

    if (changed) {
      lastPayload.current = payload;
      onViewContextChange(payload);
    }
  });
  return null;
};
