import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SunProps {
  onSelect: () => void;
  registerRef: (name: string, ref: THREE.Object3D) => void;
}

const Sun: React.FC<SunProps> = ({ onSelect, registerRef }) => {
  const sunRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (sunRef.current) {
      registerRef("The Sun", sunRef.current);
    }
  }, [registerRef]);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={sunRef} onClick={onSelect} position={[0, 0, 0]}>
      <sphereGeometry args={[8, 64, 64]} />
      <meshStandardMaterial 
        emissive="#FDB813" 
        emissiveIntensity={1.5} 
        color="#FDB813" 
        toneMapped={false}
      />
      <pointLight distance={500} intensity={2} color="#fff" decay={1} />
      <mesh scale={[1.2, 1.2, 1.2]}>
         <sphereGeometry args={[8, 32, 32]} />
         <meshBasicMaterial color="#FDB813" transparent opacity={0.2} side={THREE.BackSide} />
      </mesh>
    </mesh>
  );
};

export default Sun;