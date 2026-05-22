'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Props {
  uploadedFile?: File | null;
  modelUrl?: string;       // remote URL to load
  readOnly?: boolean;      // for share view
  onAnnotate?: (point: THREE.Vector3) => void;
}

export default function ModelViewer({ uploadedFile, modelUrl, readOnly = false, onAnnotate }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number>(0);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    // Grid
    const grid = new THREE.GridHelper(200, 40, 0x334155, 0x1e293b);
    scene.add(grid);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(5, 10, 5);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x3b82f6, 0.4);
    dir2.position.set(-5, -5, -5);
    scene.add(dir2);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 50, 100);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 10;
    controls.maxDistance = 500;
    controlsRef.current = controls;

    // Default demo mesh (placeholder limb shape)
    const geo = new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(8, 40, 16, 32)
      : new THREE.CylinderGeometry(8, 8, 40, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.3,
      metalness: 0.15,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'demo_mesh';
    mesh.castShadow = true;
    scene.add(mesh);

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!mount) return;
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load uploaded file
  useEffect(() => {
    if (!uploadedFile || !sceneRef.current) return;
    loadFile(uploadedFile);
  }, [uploadedFile]);

  // Load remote URL
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;
    loadRemote(modelUrl);
  }, [modelUrl]);

  function clearScene() {
    const scene = sceneRef.current;
    if (!scene) return;
    const toRemove = scene.children.filter(
      (c) => c.name === 'loaded_model' || c.name === 'demo_mesh'
    );
    toRemove.forEach((c) => scene.remove(c));
  }

  function centerAndFit(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    object.position.sub(center);
    if (cameraRef.current) {
      cameraRef.current.position.set(0, maxDim * 0.8, maxDim * 1.5);
      cameraRef.current.lookAt(0, 0, 0);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }

  function addToScene(object: THREE.Object3D) {
    clearScene();
    object.name = 'loaded_model';
    // Apply material to all meshes
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.4,
          metalness: 0.2,
        });
        child.castShadow = true;
      }
    });
    sceneRef.current!.add(object);
    centerAndFit(object);
    setIsLoading(false);
  }

  function loadFile(file: File) {
    setIsLoading(true);
    setLoadError('');
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'stl') {
      new STLLoader().load(url, (geo) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.2 }));
        addToScene(mesh);
        URL.revokeObjectURL(url);
      }, undefined, (e) => { setLoadError('STL load failed'); setIsLoading(false); URL.revokeObjectURL(url); });
    } else if (ext === 'obj') {
      new OBJLoader().load(url, (obj) => { addToScene(obj); URL.revokeObjectURL(url); },
        undefined, () => { setLoadError('OBJ load failed'); setIsLoading(false); URL.revokeObjectURL(url); });
    } else if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().load(url, (gltf) => { addToScene(gltf.scene); URL.revokeObjectURL(url); },
        undefined, () => { setLoadError('GLTF load failed'); setIsLoading(false); URL.revokeObjectURL(url); });
    } else {
      setLoadError('Unsupported format');
      setIsLoading(false);
    }
  }

  function loadRemote(url: string) {
    setIsLoading(true);
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
    if (ext === 'stl') {
      new STLLoader().load(url, (geo) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x64748b }));
        addToScene(mesh);
      }, undefined, () => { setLoadError('Failed to load model'); setIsLoading(false); });
    } else if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().load(url, (gltf) => addToScene(gltf.scene),
        undefined, () => { setLoadError('Failed to load model'); setIsLoading(false); });
    } else {
      setLoadError('Unsupported remote format');
      setIsLoading(false);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Loading model…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 text-sm px-4 py-2 rounded-xl border border-red-700">
          {loadError}
        </div>
      )}

      {/* Help text */}
      {!uploadedFile && !modelUrl && (
        <div className="absolute bottom-4 right-4 bg-slate-800/90 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-700 pointer-events-none">
          🖱 Drag to rotate · Scroll to zoom · Right-click to pan
        </div>
      )}
    </div>
  );
}
