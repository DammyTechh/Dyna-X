'use client';

import {
  useImperativeHandle, useRef, useEffect, useState, useCallback,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface ViewerParams {
  wireframe: boolean;
  modelColor: string;     // hex e.g. #64748b
  opacity: number;        // 0..1
  scale: number;          // multiplier
  rotationY: number;      // radians (manual turntable)
  autoRotate: boolean;
  background: string;     // hex
  showGrid: boolean;
  lightIntensity: number; // 0..2
}

export interface ViewerHandle {
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportGLB: (filename?: string) => void;
  snapshot: (filename?: string) => void;
}

interface Props {
  uploadedFile?: File | null;
  modelUrl?: string;
  readOnly?: boolean;
  params?: Partial<ViewerParams>;
  onLoaded?: (info: { vertices: number; triangles: number }) => void;
  // Imperative handle passed as a normal prop (not React `ref`) so the
  // component can be loaded with next/dynamic({ ssr: false }).
  apiRef?: React.MutableRefObject<ViewerHandle | null>;
}

const DEFAULTS: ViewerParams = {
  wireframe: false,
  modelColor: '#94a3b8',
  opacity: 1,
  scale: 1,
  rotationY: 0,
  autoRotate: false,
  background: '#0f172a',
  showGrid: false,
  lightIntensity: 1,
};

export default function ModelViewer({
  uploadedFile, modelUrl, readOnly = false, params, onLoaded, apiRef,
}: Props) {
  const p: ViewerParams = { ...DEFAULTS, ...params };

  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const lightsRef = useRef<THREE.Light[]>([]);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const baseScaleRef = useRef<number>(1);
  const frameRef = useRef<number>(0);

  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Imperative API ─────────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    const model = modelRef.current;
    const cam = cameraRef.current;
    const ctr = controlsRef.current;
    if (!cam || !ctr) return;
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 60;
      cam.position.set(0, maxDim * 0.7, maxDim * 1.6);
    } else {
      cam.position.set(0, 50, 100);
    }
    cam.lookAt(0, 0, 0);
    ctr.target.set(0, 0, 0);
    ctr.update();
  }, []);

  const dolly = useCallback((factor: number) => {
    const cam = cameraRef.current;
    const ctr = controlsRef.current;
    if (!cam || !ctr) return;
    const dir = new THREE.Vector3().subVectors(cam.position, ctr.target);
    dir.multiplyScalar(factor);
    const next = new THREE.Vector3().addVectors(ctr.target, dir);
    const dist = next.distanceTo(ctr.target);
    if (dist > ctr.minDistance && dist < ctr.maxDistance) {
      cam.position.copy(next);
      ctr.update();
    }
  }, []);

  const exportGLB = useCallback((filename = 'dynax-model.glb') => {
    const model = modelRef.current;
    if (!model) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      model,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      },
      () => setLoadError('Export failed'),
      { binary: true },
    );
  }, []);

  const snapshot = useCallback((filename = 'dynax-snapshot.png') => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    if (!renderer || !scene || !cam) return;
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  }, []);

  useImperativeHandle(apiRef, () => ({
    resetView,
    zoomIn: () => dolly(0.82),
    zoomOut: () => dolly(1.22),
    exportGLB,
    snapshot,
  }), [resetView, dolly, exportGLB, snapshot]);

  // ── Init scene (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.background);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(200, 40, 0x334155, 0x1e293b);
    grid.visible = p.showGrid;
    scene.add(grid);
    gridRef.current = grid;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6 * p.lightIntensity);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2 * p.lightIntensity);
    dir1.position.set(5, 10, 5);
    const dir2 = new THREE.DirectionalLight(0x3b82f6, 0.4 * p.lightIntensity);
    dir2.position.set(-5, -5, -5);
    scene.add(ambient, dir1, dir2);
    lightsRef.current = [ambient, dir1, dir2];

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera.position.set(0, 50, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 1000;
    controls.enabled = !readOnly ? true : true; // pan/zoom allowed even in read-only
    controlsRef.current = controls;

    // Demo capsule until a model is loaded.
    const geo = new THREE.CylinderGeometry(8, 8, 40, 32);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.modelColor), roughness: 0.3, metalness: 0.15 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'demo_mesh';
    mesh.castShadow = true;
    scene.add(mesh);
    modelRef.current = mesh;
    materialsRef.current = [mat];
    baseScaleRef.current = 1;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const applySize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      if (nw === 0 || nh === 0) return; // container not laid out yet
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    // Run once after layout, and whenever the container resizes (flex, sidebars,
    // mobile rotation, panel open/close). This fixes a blank canvas when the
    // container has 0 height at mount.
    applySize();
    const ro = new ResizeObserver(() => applySize());
    ro.observe(mount);
    window.addEventListener('resize', applySize);

    return () => {
      window.removeEventListener('resize', applySize);
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply visual params reactively ───────────────────────────────────────────
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.background = new THREE.Color(p.background);
  }, [p.background]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = p.showGrid;
  }, [p.showGrid]);

  useEffect(() => {
    const [ambient, dir1, dir2] = lightsRef.current;
    if (ambient) ambient.intensity = 0.6 * p.lightIntensity;
    if (dir1) dir1.intensity = 1.2 * p.lightIntensity;
    if (dir2) dir2.intensity = 0.4 * p.lightIntensity;
  }, [p.lightIntensity]);

  useEffect(() => {
    materialsRef.current.forEach((m) => {
      m.wireframe = p.wireframe;
      m.color.set(p.modelColor);
      m.opacity = p.opacity;
      m.transparent = p.opacity < 1;
      m.needsUpdate = true;
    });
  }, [p.wireframe, p.modelColor, p.opacity]);

  useEffect(() => {
    const model = modelRef.current;
    if (model) {
      const s = baseScaleRef.current * p.scale;
      model.scale.setScalar(s);
    }
  }, [p.scale]);

  useEffect(() => {
    const model = modelRef.current;
    if (model) model.rotation.y = p.rotationY;
  }, [p.rotationY]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = p.autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [p.autoRotate]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uploadedFile || !sceneRef.current) return;
    loadFile(uploadedFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFile]);

  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;
    loadRemote(modelUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  function clearScene() {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.children
      .filter((c) => c.name === 'loaded_model' || c.name === 'demo_mesh')
      .forEach((c) => scene.remove(c));
    materialsRef.current = [];
  }

  function fitAndScale(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // Normalise large/small scans into a comfortable ~60-unit view.
    const norm = 60 / maxDim;
    baseScaleRef.current = norm;
    object.position.sub(center.multiplyScalar(norm));
    object.scale.setScalar(norm * p.scale);
    object.rotation.y = p.rotationY;
  }

  function reportStats(object: THREE.Object3D) {
    let verts = 0; let tris = 0;
    object.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const pos = m.geometry.getAttribute('position');
        if (pos) verts += pos.count;
        const idx = m.geometry.getIndex();
        tris += idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
      }
    });
    onLoaded?.({ vertices: Math.round(verts), triangles: Math.round(tris) });
  }

  function addToScene(object: THREE.Object3D) {
    clearScene();
    object.name = 'loaded_model';
    const mats: THREE.MeshStandardMaterial[] = [];
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.modelColor),
          roughness: 0.45,
          metalness: 0.18,
          wireframe: p.wireframe,
          opacity: p.opacity,
          transparent: p.opacity < 1,
        });
        mesh.material = mat;
        mesh.castShadow = true;
        mats.push(mat);
      }
    });
    materialsRef.current = mats;
    fitAndScale(object);
    sceneRef.current!.add(object);
    modelRef.current = object;
    reportStats(object);
    setIsLoading(false);
    resetView();
  }

  function loadFile(file: File) {
    setIsLoading(true);
    setLoadError('');
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const fail = (msg: string) => { setLoadError(msg); setIsLoading(false); URL.revokeObjectURL(url); };

    if (ext === 'stl') {
      new STLLoader().load(url, (geo) => {
        addToScene(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()));
        URL.revokeObjectURL(url);
      }, undefined, () => fail('STL load failed'));
    } else if (ext === 'obj') {
      new OBJLoader().load(url, (obj) => { addToScene(obj); URL.revokeObjectURL(url); }, undefined, () => fail('OBJ load failed'));
    } else if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().load(url, (gltf) => { addToScene(gltf.scene); URL.revokeObjectURL(url); }, undefined, () => fail('GLTF load failed'));
    } else {
      fail('Unsupported format');
    }
  }

  function loadRemote(url: string) {
    setIsLoading(true);
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
    const fail = () => { setLoadError('Failed to load model'); setIsLoading(false); };
    if (ext === 'stl') {
      new STLLoader().load(url, (geo) => addToScene(new THREE.Mesh(geo, new THREE.MeshStandardMaterial())), undefined, fail);
    } else if (ext === 'obj') {
      new OBJLoader().load(url, (obj) => addToScene(obj), undefined, fail);
    } else if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().load(url, (gltf) => addToScene(gltf.scene), undefined, fail);
    } else {
      setLoadError('Unsupported remote format'); setIsLoading(false);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Loading model…</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 text-sm px-4 py-2 rounded-xl border border-red-700">
          {loadError}
        </div>
      )}
      {!uploadedFile && !modelUrl && (
        <div className="absolute bottom-4 right-4 bg-slate-800/90 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-700 pointer-events-none">
          🖱 Drag to rotate · Scroll to zoom · Right-click to pan
        </div>
      )}
    </div>
  );
}
