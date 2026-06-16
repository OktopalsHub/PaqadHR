'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

/* ─────────── Node (glowing sphere) ─────────── */
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

  useFrame((_, delta) => {
    t.current += delta * 0.4;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t.current) * 0.15;
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.08 * scale, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.8}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ─────────── Connections (lines between nodes) ─────────── */
function Connections({
  nodes,
  maxDist = 2.8,
}: {
  nodes: [number, number, number][];
  maxDist?: number;
}) {
  const ref = useRef<THREE.LineSegments>(null!);

  const { positions, opacities } = useMemo(() => {
    const pos: number[] = [];
    const ops: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          pos.push(...nodes[i], ...nodes[j]);
          const opacity = 1 - dist / maxDist;
          ops.push(opacity, opacity);
        }
      }
    }
    return {
      positions: new Float32Array(pos),
      opacities: new Float32Array(ops),
    };
  }, [nodes, maxDist]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    return geo;
  }, [positions, opacities]);

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial
        color="#ffcc00"
        transparent
        opacity={0.12}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* ─────────── Particles ─────────── */
function Particles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
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
      ref.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#ffcc00"
        size={0.015}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─────────── Central Glass Orb ─────────── */
function GlassOrb() {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.1;
      ref.current.rotation.z = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.9, 3]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.4}
          chromaticAberration={0.15}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.1}
          color="#ffcc00"
          transmission={0.96}
          roughness={0.05}
          ior={1.3}
        />
      </mesh>
    </Float>
  );
}

/* ─────────── Mouse-tracking Camera Rig ─────────── */
function Rig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  const onPointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * 0.5 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.current.y * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });

  // Attach pointer move handler on mount
  if (typeof window !== 'undefined') {
    // biome-ignore lint: window event
    window.onpointermove = onPointerMove;
  }

  return null;
}

/* ─────────── Scene (all pieces combined) ─────────── */
function Scene() {
  const nodePositions = useMemo<[number, number, number][]>(
    () => [
      // Core cluster
      [-1.2, 0.6, 0.3],
      [1.4, 0.4, -0.5],
      [-0.5, -0.8, 0.6],
      [0.8, -0.6, -0.3],
      [0.1, 1.0, -0.2],
      [-1.6, -0.2, -0.4],
      [1.8, -0.1, 0.5],
      // Outer
      [-2.5, 1.2, -0.8],
      [2.6, 0.8, 0.2],
      [-2.2, -1.3, 0.5],
      [2.3, -1.1, -0.6],
      [0.0, 1.8, 0.4],
      [-0.8, -1.8, -0.3],
      [1.0, 1.5, 0.7],
      // Far scatter
      [-3.2, 0.3, -1.0],
      [3.0, -0.5, 0.8],
      [-1.0, 2.2, -0.6],
      [1.5, -2.0, 0.3],
    ],
    [],
  );

  const brandYellow = '#ffcc00';
  const softAmber = '#ffa500';
  const white = '#ffffff';

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 5, 14]} />

      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.3} color="#fff5e0" />
      <pointLight position={[0, 0, 2]} intensity={0.5} color={brandYellow} distance={8} />

      <GlassOrb />

      {nodePositions.map((pos, i) => (
        <Node
          key={`node-${pos.join('-')}`}
          position={pos}
          color={i % 3 === 0 ? brandYellow : i % 3 === 1 ? softAmber : white}
          scale={i < 7 ? 1.2 : 0.7}
        />
      ))}

      <Connections nodes={nodePositions} maxDist={2.4} />
      <Particles count={300} />
      <Rig />
    </>
  );
}

/* ─────────── Exported Canvas ─────────── */
export function HeroScene() {
  return (
    <div className="hero-scene-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
