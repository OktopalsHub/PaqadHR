'use client';

import { Float, MeshTransmissionMaterial } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useBrandColor } from '@/hooks/use-brand-color';

function Node({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const t = useRef(Math.random() * Math.PI * 2);
  const baseY = position[1];

  useFrame((_, delta) => {
    t.current += delta * 0.5;
    if (ref.current) {
      ref.current.position.y = baseY + Math.sin(t.current) * 0.12;
      ref.current.scale.setScalar(scale + Math.sin(t.current * 1.5) * 0.05);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.07 * scale, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function Connections({
  nodes,
  maxDist = 2.5,
}: {
  nodes: [number, number, number][];
  maxDist?: number;
}) {
  const { positions } = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          pos.push(...nodes[i], ...nodes[j]);
        }
      }
    }
    return { positions: new Float32Array(pos) };
  }, [nodes, maxDist]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#888888" transparent opacity={0.12} depthWrite={false} />
    </lineSegments>
  );
}

function Particles({ count = 400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.008;
      ref.current.rotation.x += delta * 0.003;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#888888"
        size={0.012}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function GlassOrb({ brandColor }: { brandColor: string }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.08;
      ref.current.rotation.z = state.clock.elapsedTime * 0.04;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.5}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.5}
          chromaticAberration={0.12}
          anisotropy={0.2}
          distortion={0.15}
          distortionScale={0.25}
          temporalDistortion={0.08}
          color={brandColor}
          transmission={0.97}
          roughness={0.03}
          ior={1.25}
        />
      </mesh>
    </Float>
  );
}

function InnerGlow({ brandColor }: { brandColor: string }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (ref.current) {
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial color={brandColor} transparent opacity={0.25} />
    </mesh>
  );
}

function Rig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  const onPointerMove = useCallback((e: PointerEvent) => {
    mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * 0.6 - camera.position.x) * 0.025;
    camera.position.y += (-mouse.current.y * 0.4 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);
  });

  if (typeof window !== 'undefined') {
    window.onpointermove = onPointerMove;
  }

  return null;
}

function Scene() {
  const nodePositions = useMemo<[number, number, number][]>(
    () => [
      [-1.2, 0.6, 0.3],
      [1.4, 0.4, -0.5],
      [-0.5, -0.8, 0.6],
      [0.8, -0.6, -0.3],
      [0.1, 1.0, -0.2],
      [-1.6, -0.2, -0.4],
      [1.8, -0.1, 0.5],
      [-2.5, 1.2, -0.8],
      [2.6, 0.8, 0.2],
      [-2.2, -1.3, 0.5],
      [2.3, -1.1, -0.6],
      [0.0, 1.8, 0.4],
      [-0.8, -1.8, -0.3],
      [1.0, 1.5, 0.7],
      [-3.2, 0.3, -1.0],
      [3.0, -0.5, 0.8],
      [-1.0, 2.2, -0.6],
      [1.5, -2.0, 0.3],
      [-0.3, 0.3, 1.0],
      [0.5, -0.2, -0.8],
    ],
    [],
  );

  const brandColor = useBrandColor();
  const charcoal = '#1a1a1a';

  return (
    <>
      <color attach="background" args={['#fafafa']} />
      <fog attach="fog" args={['#fafafa', 5, 16]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#ffffff" />
      <pointLight position={[0, 0, 2]} intensity={1.0} color={brandColor} distance={10} />
      <pointLight position={[-3, 1, -2]} intensity={0.4} color={brandColor} distance={8} />

      <InnerGlow brandColor={brandColor} />
      <GlassOrb brandColor={brandColor} />

      {nodePositions.map((pos, i) => (
        <Node
          key={`node-${pos.join('-')}`}
          position={pos}
          color={i % 3 === 2 ? charcoal : brandColor}
          scale={i < 7 ? 1.2 : 0.6}
        />
      ))}

      <Connections nodes={nodePositions} maxDist={2.2} />
      <Particles count={500} />
      <Rig />
    </>
  );
}

export function HeroScene() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
