import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useMemo, Suspense, useState } from 'react';
import * as THREE from 'three';

interface Module3DConfig {
  height: number;
  width: number;
  depth: number;
  thickness: number;
  shelves: number;
  doors: number;
  drawers?: number;
  bodyColor?: string;
  frontColor?: string;
  hasHandles?: boolean;
}

interface Props {
  mod: Module3DConfig;
  className?: string;
}

const BG_PRESETS: { id: string; label: string; preset: any; ground: string }[] = [
  { id: 'apartment', label: 'Apartamento', preset: 'apartment', ground: '#e8e6e1' },
  { id: 'studio', label: 'Estúdio', preset: 'studio', ground: '#f4f4f5' },
  { id: 'warehouse', label: 'Galpão', preset: 'warehouse', ground: '#d6d3d1' },
  { id: 'sunset', label: 'Pôr do sol', preset: 'sunset', ground: '#f5e6d3' },
  { id: 'night', label: 'Noite', preset: 'night', ground: '#1f1f23' },
  { id: 'city', label: 'Cidade', preset: 'city', ground: '#cfd1d4' },
];

/**
 * Render a parametric MDF cabinet in 3D using react-three-fiber.
 * Dimensions in mm are converted to meters (÷1000) for Three.js.
 */
export default function Module3DViewer({ mod, className }: Props) {
  const {
    height, width, depth, thickness,
    shelves, doors, drawers = 0,
    bodyColor = '#f5f1e8',
    frontColor = '#ffffff',
    hasHandles = true,
  } = mod;

  // Convert mm → meters
  const W = width / 1000;
  const H = height / 1000;
  const D = depth / 1000;
  const T = thickness / 1000;

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7, metalness: 0.05 }),
    [bodyColor]
  );
  const frontMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: frontColor, roughness: 0.5, metalness: 0.1 }),
    [frontColor]
  );
  const handleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.3, metalness: 0.8 }),
    []
  );

  // Camera distance based on largest dim
  const maxDim = Math.max(W, H, D);
  const camDist = maxDim * 2.6;

  // Shelf Y positions (cabinet center origin at bottom)
  const innerH = H - 2 * T;
  const shelfYs: number[] = [];
  if (shelves > 0) {
    const gap = innerH / (shelves + 1);
    for (let i = 1; i <= shelves; i++) shelfYs.push(T + gap * i);
  }

  // Door / drawer geometry
  const doorWidth = doors > 0 ? W / doors : 0;
  const drawerHeight = drawers > 0 ? (H - 2 * T) / drawers : 0;

  return (
    <div className={className} style={{ width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)' }}>
      <Canvas
        shadows
        camera={{ position: [camDist, camDist * 0.8, camDist], fov: 35 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Lights */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={0.9}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-5, 4, -3]} intensity={0.3} />

          {/* Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#e8e6e1" roughness={0.95} />
          </mesh>
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={maxDim * 6} blur={2.4} far={4} />

          {/* Cabinet group, centered horizontally on origin, sitting on ground */}
          <group position={[-W / 2, 0, -D / 2]}>
            {/* Bottom */}
            <mesh material={bodyMat} position={[W / 2, T / 2, D / 2]} castShadow receiveShadow>
              <boxGeometry args={[W, T, D]} />
            </mesh>
            {/* Top */}
            <mesh material={bodyMat} position={[W / 2, H - T / 2, D / 2]} castShadow receiveShadow>
              <boxGeometry args={[W, T, D]} />
            </mesh>
            {/* Left side */}
            <mesh material={bodyMat} position={[T / 2, H / 2, D / 2]} castShadow receiveShadow>
              <boxGeometry args={[T, H, D]} />
            </mesh>
            {/* Right side */}
            <mesh material={bodyMat} position={[W - T / 2, H / 2, D / 2]} castShadow receiveShadow>
              <boxGeometry args={[T, H, D]} />
            </mesh>
            {/* Back panel (3mm) */}
            <mesh material={bodyMat} position={[W / 2, H / 2, 0.0015]} castShadow receiveShadow>
              <boxGeometry args={[W - 2 * T, H - 2 * T, 0.003]} />
            </mesh>

            {/* Shelves */}
            {shelfYs.map((y, i) => (
              <mesh
                key={`shelf-${i}`}
                material={bodyMat}
                position={[W / 2, y, (D - 0.02) / 2]}
                castShadow receiveShadow
              >
                <boxGeometry args={[W - 2 * T, T, D - 0.02]} />
              </mesh>
            ))}

            {/* Doors */}
            {doors > 0 && drawers === 0 && Array.from({ length: doors }).map((_, i) => (
              <group key={`door-${i}`}>
                <mesh
                  material={frontMat}
                  position={[doorWidth * (i + 0.5), H / 2, D + T / 2]}
                  castShadow receiveShadow
                >
                  <boxGeometry args={[doorWidth - 0.004, H - 0.004, T]} />
                </mesh>
                {hasHandles && (
                  <mesh
                    material={handleMat}
                    position={[
                      i === 0 ? doorWidth - 0.04 : doorWidth * i + 0.04,
                      H / 2,
                      D + T + 0.012,
                    ]}
                    castShadow
                  >
                    <boxGeometry args={[0.012, 0.12, 0.012]} />
                  </mesh>
                )}
              </group>
            ))}

            {/* Drawers */}
            {drawers > 0 && Array.from({ length: drawers }).map((_, i) => (
              <group key={`drawer-${i}`}>
                <mesh
                  material={frontMat}
                  position={[W / 2, T + drawerHeight * (i + 0.5), D + T / 2]}
                  castShadow receiveShadow
                >
                  <boxGeometry args={[W - 0.004, drawerHeight - 0.004, T]} />
                </mesh>
                {hasHandles && (
                  <mesh
                    material={handleMat}
                    position={[W / 2, T + drawerHeight * (i + 0.5), D + T + 0.012]}
                    castShadow
                  >
                    <boxGeometry args={[Math.min(0.12, W * 0.4), 0.012, 0.012]} />
                  </mesh>
                )}
              </group>
            ))}
          </group>

          <OrbitControls
            enablePan={false}
            minDistance={maxDim * 1.3}
            maxDistance={maxDim * 5}
            maxPolarAngle={Math.PI / 2 - 0.05}
            target={[0, H / 2, 0]}
          />
          <Environment preset="apartment" />
        </Suspense>
      </Canvas>
    </div>
  );
}
