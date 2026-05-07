import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useMemo, Suspense, useState, useRef } from 'react';
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

const COLOR_PRESETS: { id: string; label: string; body: string; front: string }[] = [
  { id: 'white', label: 'Branco TX', body: '#f5f1e8', front: '#ffffff' },
  { id: 'oak', label: 'Carvalho', body: '#c9a878', front: '#d8b98a' },
  { id: 'walnut', label: 'Nogueira', body: '#6b4a2b', front: '#7a5631' },
  { id: 'gray', label: 'Cinza', body: '#8a8a8a', front: '#a3a3a3' },
  { id: 'black', label: 'Preto Fosco', body: '#2a2a2a', front: '#1a1a1a' },
  { id: 'duo', label: 'Branco + Madeira', body: '#f5f1e8', front: '#c9a878' },
];

const VIEW_MODES: { id: string; label: string }[] = [
  { id: 'persp', label: 'Perspectiva' },
  { id: 'iso', label: 'Isométrica' },
  { id: 'front', label: 'Frente' },
  { id: 'side', label: 'Lateral' },
  { id: 'top', label: 'Topo' },
];

function viewCamera(mode: string, maxDim: number, H: number): [number, number, number] {
  const d = maxDim;
  switch (mode) {
    case 'iso':   return [d * 2.2, d * 2.2, d * 2.2];
    case 'front': return [0, H / 2, d * 3.5];
    case 'side':  return [d * 3.5, H / 2, 0.001];
    case 'top':   return [0.001, d * 4, 0.001];
    default:      return [d * 2.6, d * 2.1, d * 2.6];
  }
}

/** Animated value lerp */
function useLerp(target: number, speed = 6) {
  const ref = useRef(target);
  useFrame((_, dt) => {
    ref.current += (target - ref.current) * Math.min(1, dt * speed);
  });
  return ref;
}

function Door({
  position, width, height, thickness, color, openDeg, hingeSide, showInternals, showHandles,
}: {
  position: [number, number, number];
  width: number; height: number; thickness: number;
  color: string;
  openDeg: number;
  hingeSide: 'left' | 'right';
  showInternals: boolean;
  showHandles: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRad = (openDeg * Math.PI) / 180 * (hingeSide === 'left' ? 1 : -1);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const cur = groupRef.current.rotation.y;
    groupRef.current.rotation.y = cur + (targetRad - cur) * Math.min(1, dt * 5);
  });
  if (showInternals && openDeg < 5) return null;
  const hingeX = hingeSide === 'left' ? -width / 2 : width / 2;
  return (
    <group position={[position[0] + hingeX, position[1], position[2]]}>
      <group ref={groupRef}>
        <mesh position={[hingeSide === 'left' ? width / 2 : -width / 2, 0, thickness / 2]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.004, height - 0.004, thickness]} />
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
        </mesh>
        {showHandles && (
          <mesh
            position={[
              hingeSide === 'left' ? width - 0.04 : -width + 0.04,
              0,
              thickness + 0.012,
            ]}
            castShadow
          >
            <boxGeometry args={[0.014, Math.min(0.16, height * 0.6), 0.014]} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.25} metalness={0.85} />
          </mesh>
        )}
        {/* Dobradiças */}
        {openDeg > 5 && (
          <>
            <mesh position={[hingeSide === 'left' ? 0.005 : -0.005, height / 2 - 0.08, thickness / 2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.04, 12]} />
              <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[hingeSide === 'left' ? 0.005 : -0.005, -height / 2 + 0.08, thickness / 2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.04, 12]} />
              <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.2} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function Drawer({
  position, width, height, depth, thickness, frontColor, openAmount, showHandles, showSlides,
}: {
  position: [number, number, number];
  width: number; height: number; depth: number; thickness: number;
  frontColor: string;
  openAmount: number; // 0..1
  showHandles: boolean;
  showSlides: boolean;
}) {
  const offsetRef = useRef(0);
  useFrame((_, dt) => {
    offsetRef.current += (openAmount * (depth * 0.8) - offsetRef.current) * Math.min(1, dt * 5);
  });
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => { if (groupRef.current) groupRef.current.position.z = position[2] + offsetRef.current; });

  const innerH = height - 0.04;
  const innerW = width - 0.06;
  const innerD = depth - 0.05;

  return (
    <group ref={groupRef} position={position}>
      {/* Frente */}
      <mesh position={[0, 0, depth / 2 + thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.004, height - 0.004, thickness]} />
        <meshStandardMaterial color={frontColor} roughness={0.45} metalness={0.1} />
      </mesh>
      {showHandles && (
        <mesh position={[0, 0, depth / 2 + thickness + 0.012]} castShadow>
          <boxGeometry args={[Math.min(0.18, width * 0.5), 0.014, 0.014]} />
          <meshStandardMaterial color="#1f1f1f" metalness={0.85} roughness={0.25} />
        </mesh>
      )}
      {/* Caixa de gaveta (visível quando aberta) */}
      {openAmount > 0.05 && (
        <>
          {/* Base */}
          <mesh position={[0, -innerH / 2 + 0.005, 0]}>
            <boxGeometry args={[innerW, 0.005, innerD]} />
            <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
          </mesh>
          {/* Laterais */}
          <mesh position={[-innerW / 2, 0, 0]}>
            <boxGeometry args={[0.012, innerH * 0.7, innerD]} />
            <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
          </mesh>
          <mesh position={[innerW / 2, 0, 0]}>
            <boxGeometry args={[0.012, innerH * 0.7, innerD]} />
            <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
          </mesh>
          {/* Traseira */}
          <mesh position={[0, 0, -innerD / 2]}>
            <boxGeometry args={[innerW, innerH * 0.7, 0.012]} />
            <meshStandardMaterial color="#d4c8a8" roughness={0.8} />
          </mesh>
        </>
      )}
      {/* Corrediças metálicas */}
      {showSlides && (
        <>
          <mesh position={[-width / 2 + 0.008, -height / 2 + 0.015, 0]}>
            <boxGeometry args={[0.008, 0.025, depth * 0.95]} />
            <meshStandardMaterial color="#c0c4c8" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[width / 2 - 0.008, -height / 2 + 0.015, 0]}>
            <boxGeometry args={[0.008, 0.025, depth * 0.95]} />
            <meshStandardMaterial color="#c0c4c8" metalness={0.85} roughness={0.25} />
          </mesh>
        </>
      )}
    </group>
  );
}

export default function Module3DViewer({ mod, className }: Props) {
  const [bgId, setBgId] = useState<string>('apartment');
  const [colorId, setColorId] = useState<string>('white');
  const [viewMode, setViewMode] = useState<string>('persp');
  const [openDoors, setOpenDoors] = useState(false);
  const [openDrawers, setOpenDrawers] = useState(false);
  const [showInternals, setShowInternals] = useState(false);
  const [showHardware, setShowHardware] = useState(true);

  const bg = BG_PRESETS.find((b) => b.id === bgId) ?? BG_PRESETS[0];
  const colorPreset = COLOR_PRESETS.find((c) => c.id === colorId) ?? COLOR_PRESETS[0];

  const {
    height, width, depth, thickness,
    shelves, doors, drawers = 0,
    bodyColor, frontColor,
    hasHandles = true,
  } = mod;

  const bodyColorFinal = bodyColor || colorPreset.body;
  const frontColorFinal = frontColor || colorPreset.front;

  // Convert mm → meters
  const W = width / 1000;
  const H = height / 1000;
  const D = depth / 1000;
  const T = thickness / 1000;

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColorFinal, roughness: 0.7, metalness: 0.05 }),
    [bodyColorFinal]
  );

  const maxDim = Math.max(W, H, D);
  const camPos = viewCamera(viewMode, maxDim, H);
  const orthoMode = viewMode === 'front' || viewMode === 'side' || viewMode === 'top';

  const innerH = H - 2 * T;
  const shelfYs: number[] = [];
  if (shelves > 0) {
    const gap = innerH / (shelves + 1);
    for (let i = 1; i <= shelves; i++) shelfYs.push(T + gap * i);
  }

  const doorWidth = doors > 0 ? W / doors : 0;
  const drawerHeight = drawers > 0 ? (H - 2 * T) / drawers : 0;
  const openDoorDeg = openDoors ? 100 : 0;
  const openDrawerAmt = openDrawers ? 0.85 : 0;

  return (
    <div className={className} style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: 'hsl(var(--card))' }}>
      {/* Toolbar superior */}
      <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/40">
        {/* Cores */}
        <div className="flex gap-1">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColorId(c.id)}
              title={c.label}
              className={`w-7 h-7 rounded-full border-2 transition ${colorId === c.id ? 'border-primary scale-110' : 'border-border'}`}
              style={{ background: `linear-gradient(135deg, ${c.body} 50%, ${c.front} 50%)` }}
            />
          ))}
        </div>
        <div className="w-px bg-border" />
        {/* Visões */}
        <div className="flex gap-1 flex-wrap">
          {VIEW_MODES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id)}
              className={`px-2 py-1 text-[10px] rounded border transition ${
                viewMode === v.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles ações */}
      <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/20">
        {doors > 0 && (
          <button
            type="button"
            onClick={() => setOpenDoors((v) => !v)}
            className={`px-2.5 py-1 text-[11px] rounded border transition ${
              openDoors ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            }`}
          >
            🚪 {openDoors ? 'Fechar portas' : 'Abrir portas'}
          </button>
        )}
        {drawers > 0 && (
          <button
            type="button"
            onClick={() => setOpenDrawers((v) => !v)}
            className={`px-2.5 py-1 text-[11px] rounded border transition ${
              openDrawers ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            }`}
          >
            🗃️ {openDrawers ? 'Fechar gavetas' : 'Abrir gavetas'}
          </button>
        )}
        {doors > 0 && (
          <button
            type="button"
            onClick={() => setShowInternals((v) => !v)}
            className={`px-2.5 py-1 text-[11px] rounded border transition ${
              showInternals ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            }`}
          >
            👁️ {showInternals ? 'Mostrar portas' : 'Ver interno'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHardware((v) => !v)}
          className={`px-2.5 py-1 text-[11px] rounded border transition ${
            showHardware ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
          }`}
        >
          🔩 Ferragens
        </button>
      </div>

      {/* Ambientes */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/40">
        {BG_PRESETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBgId(b.id)}
            className={`px-2 py-0.5 text-[10px] rounded border transition ${
              bgId === b.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', height: 380 }}>
        <Canvas
          shadows
          camera={{ position: camPos, fov: orthoMode ? 25 : 35 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          dpr={[1, 2]}
          key={viewMode /* recreate camera on view mode change */}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-5, 4, -3]} intensity={0.3} />

            {/* Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
              <planeGeometry args={[20, 20]} />
              <meshStandardMaterial color={bg.ground} roughness={0.95} />
            </mesh>
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={maxDim * 6} blur={2.4} far={4} />

            {/* Cabinet */}
            <group position={[-W / 2, 0, -D / 2]}>
              {/* Base */}
              <mesh material={bodyMat} position={[W / 2, T / 2, D / 2]} castShadow receiveShadow>
                <boxGeometry args={[W, T, D]} />
              </mesh>
              {/* Topo */}
              <mesh material={bodyMat} position={[W / 2, H - T / 2, D / 2]} castShadow receiveShadow>
                <boxGeometry args={[W, T, D]} />
              </mesh>
              {/* Laterais */}
              <mesh material={bodyMat} position={[T / 2, H / 2, D / 2]} castShadow receiveShadow>
                <boxGeometry args={[T, H, D]} />
              </mesh>
              <mesh material={bodyMat} position={[W - T / 2, H / 2, D / 2]} castShadow receiveShadow>
                <boxGeometry args={[T, H, D]} />
              </mesh>
              {/* Fundo 3mm */}
              <mesh material={bodyMat} position={[W / 2, H / 2, 0.0015]} castShadow receiveShadow>
                <boxGeometry args={[W - 2 * T, H - 2 * T, 0.003]} />
              </mesh>

              {/* Pés (sapatas) — apenas em peças altas */}
              {showHardware && H > 0.5 && drawers === 0 && (
                <>
                  {[
                    [0.04, 0.04],
                    [W - 0.04, 0.04],
                    [0.04, D - 0.04],
                    [W - 0.04, D - 0.04],
                  ].map(([x, z], i) => (
                    <mesh key={i} position={[x, -0.025, z]}>
                      <cylinderGeometry args={[0.018, 0.018, 0.05, 16]} />
                      <meshStandardMaterial color="#3f3f3f" metalness={0.6} roughness={0.4} />
                    </mesh>
                  ))}
                </>
              )}

              {/* Prateleiras + pinos */}
              {shelfYs.map((y, i) => (
                <group key={`shelf-${i}`}>
                  <mesh material={bodyMat} position={[W / 2, y, (D - 0.02) / 2]} castShadow receiveShadow>
                    <boxGeometry args={[W - 2 * T, T, D - 0.02]} />
                  </mesh>
                  {showHardware && (
                    <>
                      <mesh position={[T + 0.005, y, 0.05]}>
                        <cylinderGeometry args={[0.003, 0.003, 0.012, 8]} rotation={[0, 0, Math.PI / 2]} />
                        <meshStandardMaterial color="#a8a8a8" metalness={0.9} />
                      </mesh>
                      <mesh position={[W - T - 0.005, y, 0.05]}>
                        <cylinderGeometry args={[0.003, 0.003, 0.012, 8]} />
                        <meshStandardMaterial color="#a8a8a8" metalness={0.9} />
                      </mesh>
                    </>
                  )}
                </group>
              ))}

              {/* Portas */}
              {doors > 0 && drawers === 0 && Array.from({ length: doors }).map((_, i) => {
                // alternância de dobradiças (espelhadas para portas pares)
                const hingeSide: 'left' | 'right' = doors === 2 ? (i === 0 ? 'left' : 'right') : 'left';
                return (
                  <Door
                    key={`door-${i}`}
                    position={[doorWidth * (i + 0.5), H / 2, D + T / 2]}
                    width={doorWidth}
                    height={H}
                    thickness={T}
                    color={frontColorFinal}
                    openDeg={openDoorDeg}
                    hingeSide={hingeSide}
                    showInternals={showInternals}
                    showHandles={showHardware && hasHandles}
                  />
                );
              })}

              {/* Gavetas */}
              {drawers > 0 && Array.from({ length: drawers }).map((_, i) => (
                <Drawer
                  key={`drawer-${i}`}
                  position={[W / 2, T + drawerHeight * (i + 0.5), D + T / 2]}
                  width={W}
                  height={drawerHeight}
                  depth={D - T}
                  thickness={T}
                  frontColor={frontColorFinal}
                  openAmount={openDrawerAmt}
                  showHandles={showHardware && hasHandles}
                  showSlides={showHardware && openDrawers}
                />
              ))}
            </group>

            <OrbitControls
              enablePan={false}
              minDistance={maxDim * 1.3}
              maxDistance={maxDim * 6}
              maxPolarAngle={viewMode === 'top' ? Math.PI : Math.PI / 2 - 0.05}
              target={[0, H / 2, 0]}
              enableRotate={viewMode === 'persp' || viewMode === 'iso'}
            />
            <Environment preset={bg.preset as any} />
          </Suspense>
        </Canvas>
      </div>

      <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-t border-border flex justify-between">
        <span>{width} × {height} × {depth} mm</span>
        <span>{doors} portas · {drawers} gavetas · {shelves} prateleiras</span>
      </div>
    </div>
  );
}
