
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Trail, useTexture } from '@react-three/drei';
import { PlanetData, MoonData } from '../types';

interface PlanetProps {
  data: PlanetData;
  onSelect: (data: PlanetData) => void;
  isSelected: boolean;
  registerRef: (name: string, ref: THREE.Object3D) => void;
}

const DEFAULT_TEXTURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg1qN5O8AAAAASUVORK5CYII=';

const CLOUD_VERTEX = `
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT = `
  varying vec3 vPos;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uFlowSpeed;
  uniform float uBanding;
  uniform vec2 uFlowDir;
  uniform float uOpacity;
  uniform float uPhase;
  // Simple 3D noise (value noise)
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5;
    float r = 0.0;
    for(int i = 0; i < 5; i++) {
      r += a * noise(p);
      p *= 2.3;
      a *= 0.55;
    }
    return r;
  }
  void main() {
    vec3 nrm = normalize(vPos);
    float lat = asin(nrm.y);               // -PI/2..PI/2, continuous at seam

    // Rotate the normal around Y to create a continuous flow direction and speed
    float dirAngle = atan(uFlowDir.y, uFlowDir.x);
    float spin = uFlowSpeed * uTime * 0.5;
    float shear = sin(lat * 6.0 + uTime * 0.6) * 0.15 * uBanding; // shear by latitude for banded giants
    float totalAngle = dirAngle + spin + shear;
    float c = cos(totalAngle);
    float s = sin(totalAngle);
    mat3 rotY = mat3(
      c, 0.0, -s,
      0.0, 1.0, 0.0,
      s, 0.0, c
    );
    vec3 flowed = rotY * nrm;

    // Base turbulent field sampled in 3D space (no UV seam)
    float t = uTime * 0.08;
    vec3 p = flowed * 6.0 + vec3(0.0, 0.0, t);
    float base = fbm(p);

    // Banding modulation (for gas giants) using latitude (seamless)
    float band = 1.0;
    if (uBanding > 0.0) {
      float freq = 8.0 * uBanding;
      band = 0.6 + 0.4 * sin(lat * freq + uTime * 0.3);
    }

    // Gentle curl-like warp by offsetting sampling in tangent space
    vec3 tangent = normalize(vec3(nrm.z, 0.0, -nrm.x));
    vec3 bitangent = cross(nrm, tangent);
    vec2 warp = vec2(
      fbm(p + tangent * 0.8 + t),
      fbm(p + bitangent * 0.8 - t)
    );
    float detail = fbm(p * 1.6 + vec3(warp, 0.0));

    float density = mix(base, detail, 0.6) * band;
    density *= 0.7; // lighten overall coverage

    // mask edges to keep limb soft (use actual radius)
    float edge = smoothstep(1.05, 0.82, length(vPos) / uRadius);
    // Large-scale moisture/condensation field (slowly evolving)
    float moisture = fbm(nrm * 2.2 + vec3(0.0, 0.0, uPhase) + t * 0.3);
    float moistureBias = mix(0.6, 1.35, moisture);
    density *= moistureBias;

    float alpha = smoothstep(0.38, 0.65, density) * edge * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Custom Atmosphere Shader
const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    // Calculate World Normal (assuming uniform scale for planets)
    vNormal = normalize(mat3(modelMatrix) * normal);
    
    // Calculate World Position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform vec3 uColor;
  // cameraPosition is automatically supplied by Three.js
  
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    vec3 lightDirection = normalize(-vPosition); // Sun is at World (0,0,0), so Light Dir is -Pos
    
    float viewDot = dot(vNormal, viewDirection);
    float lightDot = dot(vNormal, lightDirection);
    
    // Fresnel Effect (Rim Glow)
    // Stronger at edges (viewDot near 0)
    float fresnel = pow(1.0 - max(0.0, viewDot), 3.0);
    
    // Terminator Mask
    // We want the glow to be visible on the day side, and fade out on the night side.
    // smoothstep from -0.4 to 0.2 means the glow wraps slightly into the shadow (twilight)
    float sunMask = smoothstep(-0.4, 0.2, lightDot);
    
    float intensity = fresnel * sunMask;
    
    // Final color with additive blending in mind
    gl_FragColor = vec4(uColor, intensity * 0.65);
  }
`;

interface MoonProps {
  data: MoonData;
  parentData: PlanetData;
  onSelect: (data: PlanetData) => void;
  registerRef: (name: string, ref: THREE.Object3D) => void;
}

const Moon: React.FC<MoonProps> = ({ data, parentData, onSelect, registerRef }) => {
  const moonRef = useRef<THREE.Mesh>(null);
  // Random starting position for orbit
  const angle = useRef(Math.random() * Math.PI * 2);

  useEffect(() => {
    if (moonRef.current) {
      registerRef(data.name, moonRef.current);
    }
  }, [data.name, registerRef]);

  useFrame((state, delta) => {
    if (moonRef.current) {
      angle.current += data.speed * delta * 0.5; // Scale speed for visual
      
      const x = Math.cos(angle.current) * data.distance;
      const z = Math.sin(angle.current) * data.distance;
      
      moonRef.current.position.set(x, 0, z);
      moonRef.current.rotation.y += delta;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    // Convert MoonData to PlanetData structure for selection logic
    const moonAsPlanet: PlanetData = {
      name: data.name,
      description: data.description || `A satellite of ${parentData.name}.`,
      color: data.color,
      radius: data.radius,
      distance: data.distance, // Note: This is distance from PARENT, not Sun
      speed: data.speed,
      type: 'moon',
      // We can pass parent info via a custom field if needed, or just handle in UI
    };
    onSelect(moonAsPlanet);
  };

  return (
    <mesh 
      ref={moonRef} 
      castShadow 
      receiveShadow
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <sphereGeometry args={[data.radius, 32, 32]} />
      <meshStandardMaterial 
        color={data.color} 
        roughness={0.8}
        toneMapped={false}
      />
    </mesh>
  );
};

const Planet: React.FC<PlanetProps> = ({ data, onSelect, isSelected, registerRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const planetTexture = useTexture(data.textureUrl || DEFAULT_TEXTURE);
  const baseTint = useMemo(() => {
    // With textures, leave albedo white so the map shows clearly; otherwise lightly fade original color
    if (data.textureUrl) return new THREE.Color('#ffffff');
    return new THREE.Color(data.color).lerp(new THREE.Color('#ffffff'), 0.5);
  }, [data.color, data.textureUrl]);

  const emissiveColor = useMemo(() => {
    if (data.textureUrl) {
      return new THREE.Color('#ffffff'); // keep emissive neutral so texture hue dominates
    }
    return new THREE.Color(data.color).lerp(new THREE.Color('#ffffff'), 0.4);
  }, [data.color, data.textureUrl]);

  const atmosphereColor = useMemo(() => {
    const named = data.name.toLowerCase();
    if (named.includes('earth')) return new THREE.Color('#a9d6ff');
    if (named.includes('venus')) return new THREE.Color('#f5d7a1');
    if (named.includes('mars')) return new THREE.Color('#f2b391');
    if (named.includes('jupiter')) return new THREE.Color('#f0d4ae');
    if (named.includes('saturn')) return new THREE.Color('#f3e2b8');
    if (named.includes('uranus')) return new THREE.Color('#b8f0ff');
    if (named.includes('neptune')) return new THREE.Color('#9ac8ff');
    return new THREE.Color(data.color);
  }, [data.color, data.name]);

  const atmosphereDynamics = useMemo(() => {
    // Simple deterministic phase from name so each planet evolves differently
    const seed = Math.abs(Math.sin(data.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0))) * 1000;
    const named = data.name.toLowerCase();
    // Defaults
    let flowSpeed = 0.4;
    let banding = 0.0;
    let flowDir = new THREE.Vector2(0.12, 0.0);
    let opacity = 0.45;
    let phase = seed;
    // spinSpeed will be tied to the planet's self rotation (set later)
    let spinSpeed = 0.0;

    if (named.includes('earth')) {
      flowSpeed = 0.28;
      opacity = 0.38;
      flowDir = new THREE.Vector2(0.08, 0.01);
      spinSpeed = 0.08;
    } else if (named.includes('venus')) {
      flowSpeed = 0.6;
      opacity = 0.5;
      flowDir = new THREE.Vector2(0.15, 0.02);
      spinSpeed = 0.05;
    } else if (named.includes('mars')) {
      flowSpeed = 0.2;
      opacity = 0.22;
      flowDir = new THREE.Vector2(0.1, 0.02);
      spinSpeed = 0.06;
    } else if (named.includes('jupiter') || named.includes('saturn')) {
      flowSpeed = 0.9;
      banding = 1.0;
      opacity = 0.45;
      flowDir = new THREE.Vector2(0.25, 0.0);
      spinSpeed = 0.14;
    } else if (named.includes('uranus') || named.includes('neptune')) {
      flowSpeed = 0.55;
      banding = 0.7;
      opacity = 0.4;
      flowDir = new THREE.Vector2(0.18, 0.0);
      spinSpeed = 0.1;
    }

    return { flowSpeed, banding, flowDir, opacity, phase, spinSpeed };
  }, [data.name]);

  const cloudMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: atmosphereColor },
        uRadius: { value: data.radius * 1.08 },
        uFlowSpeed: { value: atmosphereDynamics.flowSpeed },
        uBanding: { value: atmosphereDynamics.banding },
        uFlowDir: { value: atmosphereDynamics.flowDir },
        uOpacity: { value: atmosphereDynamics.opacity },
        uPhase: { value: atmosphereDynamics.phase },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: CLOUD_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
    });
  }, [atmosphereColor, atmosphereDynamics, data.radius]);

  // Random initial offset for orbit so they aren't all aligned
  const initialAngle = useRef(Math.random() * Math.PI * 2).current;

  // Memoize the Atmosphere Material to prevent re-compilation per frame
  const atmosphereMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(data.color) }
    },
    vertexShader: ATMOSPHERE_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false, // Prevents occlusion issues
  }), [data.color]);

  const trailColor = useMemo(() => new THREE.Color(data.color), [data.color]);

  useEffect(() => {
    if (meshRef.current) {
      registerRef(data.name, meshRef.current);
    }
  }, [data.name, registerRef]);

  useEffect(() => {
    if (data.textureUrl && planetTexture) {
      planetTexture.colorSpace = THREE.SRGBColorSpace;
      planetTexture.anisotropy = 12;
      planetTexture.needsUpdate = true;
    }
  }, [data.textureUrl, planetTexture]);

  useFrame((_, delta) => {
    if (cloudMaterial) {
      cloudMaterial.uniforms.uTime.value += delta;
    }
  });

  useFrame((state) => {
    if (orbitRef.current && meshRef.current) {
      // Orbit rotation around Sun
      const t = state.clock.getElapsedTime();
      orbitRef.current.rotation.y = initialAngle + t * (data.speed * 0.1);
      
      // Self rotation on axis
      meshRef.current.rotation.y += 0.01;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(data);
  };

  return (
    <group>
      {/* Orbit Path Visual (The faint white ring) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[data.distance - 0.2, data.distance + 0.2, 128]} />
        <meshBasicMaterial color="#ffffff" opacity={0.25} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* The Orbit Group Container (Rotates around 0,0,0) */}
      <group ref={orbitRef}>
        {/* The Planet Group (Translated to distance) */}
        <group position={[data.distance, 0, 0]}>
          
          <Trail
            width={isSelected ? 0 : 16} 
            length={100}
            color={trailColor} 
            attenuation={(t) => t * t}
          >
            <mesh
              ref={meshRef}
              onClick={handleClick}
              onPointerOver={() => setHover(true)}
              onPointerOut={() => setHover(false)}
            >
              <sphereGeometry args={[data.radius, 64, 64]} />
              <meshStandardMaterial 
                color={baseTint}
                emissive={emissiveColor}
                emissiveIntensity={data.textureUrl ? (isSelected ? 0.12 : 0.06) : (isSelected ? 0.35 : 0.16)} 
                toneMapped={false} 
                roughness={0.45}
                metalness={data.textureUrl ? 0.1 : 0.0}
                map={data.textureUrl ? planetTexture : undefined}
              />
            </mesh>
          </Trail>

          {/* Atmospheric Glow Mesh */}
          <mesh scale={[1.15, 1.15, 1.15]} raycast={() => null}>
             <sphereGeometry args={[data.radius, 64, 64]} />
             <primitive object={atmosphereMaterial} attach="material" />
          </mesh>

          {/* Dynamic Cloud/Turbulence Layer */}
          {data.hasAtmosphere && (
            <mesh
              scale={[1.08, 1.08, 1.08]}
              rotation={[0, 0, 0]}
              onUpdate={(mesh) => {
                // spin clouds with planet self-rotation (matching meshRef rotation speed)
                const rotationSpeed = 0.01; // same as mesh self-rotation increment
                mesh.rotation.y += rotationSpeed;
              }}
            >
              <sphereGeometry args={[data.radius, 64, 64]} />
              <primitive object={cloudMaterial} attach="material" />
            </mesh>
          )}

          {/* Rings (if applicable) */}
          {data.hasRings && (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[data.radius * 1.4, data.radius * 2.2, 64]} />
              <meshStandardMaterial 
                color={data.ringColor} 
                side={THREE.DoubleSide} 
                opacity={0.7} 
                transparent 
                emissive={data.ringColor}
                emissiveIntensity={0.2}
              />
            </mesh>
          )}

          {/* Moons */}
          {data.moons && data.moons.map((moon) => (
            <Moon 
              key={moon.name} 
              data={moon} 
              parentData={data}
              onSelect={onSelect}
              registerRef={registerRef}
            />
          ))}

          {/* Label on Hover */}
          {hovered && !isSelected && (
            <Html distanceFactor={30} position={[0, data.radius + 2, 0]}>
              <div className="bg-black/80 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider whitespace-nowrap pointer-events-none border border-white/20 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                {data.name}
              </div>
            </Html>
          )}
        </group>
      </group>
    </group>
  );
};

export default Planet;
