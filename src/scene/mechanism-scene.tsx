import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createMechanism, type Mechanism} from './mechanisms.ts';
import {partOwner, partVisible, presentMechanism} from './kit.ts';
import {PointerTap} from './pointer-tap.ts';
import type {Theme} from '../theme.ts';
import type {Part, TopicId} from '../topics.ts';

export type SceneHandle = {zoom: (factor: number) => void; reset: () => void};

type Props = {
  topic: TopicId;
  theme: Theme;
  parts: Part[];
  value: number;
  variant: string;
  extras: Record<string, number>;
  playing: boolean;
  autoRotate: boolean;
  labels: boolean;
  isolated: boolean;
  selected: string;
  onSelect: (part: string) => void;
};

/** The studio's room, which follows the page theme. The machines themselves do not. */
const rooms = {
  dark: {
    backdrop: 0x050607,
    fog: [13, 40] as const,
    ground: 0x1b2128,
    plinth: 0x2c343d,
    ring: 0xa6b9c9,
    grid: [0x5a6673, 0x49535e] as const,
    gridOpacity: 0.2,
    exposure: 0.82,
    environment: 0.45,
    sky: 0xbdd3ea,
    earth: 0x2a2f36,
    hemisphere: 0.5,
    key: 2.2,
    rim: 0.9,
    fill: 0.55,
  },
  light: {
    backdrop: 0xe8ecf0,
    fog: [17, 52] as const,
    ground: 0xd2d9e0,
    plinth: 0xbcc6cf,
    ring: 0x6d7d8b,
    grid: [0x9aa6b1, 0xb0bac3] as const,
    gridOpacity: 0.5,
    exposure: 1.02,
    environment: 0.95,
    sky: 0xffffff,
    earth: 0xb9c2ca,
    hemisphere: 1.05,
    key: 2.1,
    rim: 0.55,
    fill: 0.7,
  },
} satisfies Record<Theme, unknown>;

const MechanismScene = forwardRef<SceneHandle, Props>(function MechanismScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const engine = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    fit: () => void;
    hold: () => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      zoom(factor) {
        const it = engine.current;
        if (!it) return;
        it.hold();
        it.camera.position.sub(it.controls.target).multiplyScalar(factor).add(it.controls.target);
      },
      reset() {
        engine.current?.fit();
      },
    }),
    [],
  );

  useEffect(() => {
    setError(null);
    const el = host.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    } catch {
      setError('This browser could not start the 3D view.');
      return;
    }
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color();
    const fog = new THREE.Fog(0x000000, 13, 40);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = 0.15;
    controls.autoRotateSpeed = 0.6;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;

    const ambient = new THREE.HemisphereLight(0xbdd3ea, 0x2a2f36, 0.5);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff8ef, 2.2);
    key.position.set(-5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const frustum = key.shadow.camera;
    frustum.left = -9;
    frustum.right = 9;
    frustum.top = 9;
    frustum.bottom = -9;
    frustum.far = 40;
    key.shadow.bias = -0.0012;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb6e0, 0.9);
    rim.position.set(4, 5, -6);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xdfe9f5, 0.55);
    fill.position.set(6, 3, 7);
    scene.add(fill);

    const plinthMaterial = new THREE.MeshStandardMaterial({color: 0x2c343d, metalness: 0.35, roughness: 0.55});
    const ringMaterial = new THREE.MeshStandardMaterial({color: 0xa6b9c9, metalness: 0.7, roughness: 0.35});
    const groundMaterial = new THREE.MeshStandardMaterial({color: 0x1b2128, roughness: 0.95, metalness: 0.05});

    /** Repaint the room without touching the machine standing in it. */
    function dressRoom(theme: Theme) {
      const room = rooms[theme];
      (scene.background as THREE.Color).setHex(room.backdrop);
      fog.color.setHex(room.backdrop);
      fog.near = room.fog[0];
      fog.far = room.fog[1];
      renderer.toneMappingExposure = room.exposure;
      scene.environmentIntensity = room.environment;
      ambient.color.setHex(room.sky);
      ambient.groundColor.setHex(room.earth);
      ambient.intensity = room.hemisphere;
      key.intensity = room.key;
      rim.intensity = room.rim;
      fill.intensity = room.fill;
      plinthMaterial.color.setHex(room.plinth);
      ringMaterial.color.setHex(room.ring);
      groundMaterial.color.setHex(room.ground);
      // A GridHelper bakes its colors into vertices, so a repaint means a new one.
      if (grid) {
        scene.remove(grid);
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
      }
      grid = new THREE.GridHelper(120, 120, room.grid[0], room.grid[1]);
      grid.position.y = -0.235;
      const lines = grid.material as THREE.Material;
      lines.transparent = true;
      lines.opacity = room.gridOpacity;
      scene.add(grid);
    }
    let grid: THREE.GridHelper | null = null;

    // A low display plinth and studio floor frame the mechanism without extra render passes.
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.28, 0.16, 96), plinthMaterial);
    plinth.position.y = -0.16;
    plinth.receiveShadow = true;
    scene.add(plinth);
    for (const radius of [4.95, 5.12]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 5, 128), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.08;
      scene.add(ring);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.24;
    ground.receiveShadow = true;
    scene.add(ground);
    dressRoom(props.theme);

    const mechanism: Mechanism = createMechanism(props.topic);
    scene.add(mechanism.group);

    const labelNodes = props.parts.map((part, index) => {
      const button = document.createElement('button');
      button.className = 'scene-label';
      button.setAttribute('aria-label', `Inspect ${part.name}`);
      button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><strong></strong>`;
      const strong = button.querySelector('strong');
      if (strong) strong.textContent = part.name;
      button.addEventListener('click', () => latest.current.onSelect(part.id));
      el.appendChild(button);
      return {button, id: part.id};
    });

    let viewWidth = 1;
    let viewHeight = 1;
    // Until the reader moves the camera themselves, the view refits whenever
    // the stage changes shape. After that their framing is left alone.
    let touched = false;
    let framed = false;
    controls.addEventListener('start', () => {
      touched = true;
    });
    const resize = () => {
      viewWidth = Math.max(1, el.clientWidth);
      viewHeight = Math.max(1, el.clientHeight);
      renderer.setSize(viewWidth, viewHeight);
      camera.aspect = viewWidth / viewHeight;
      camera.updateProjectionMatrix();
      if (!touched) framed = false;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const bounds = new THREE.Box3();
    const sphere = new THREE.Sphere();
    const direction = mechanism.view;
    const sideways = new THREE.Vector3();
    // Frame the bounding sphere, which fits whatever way the model is turned.
    function frameOn(target: THREE.Object3D, padding = viewWidth > 980 ? 1.2 : 1.32) {
      target.updateWorldMatrix(true, true);
      bounds.setFromObject(target);
      if (bounds.isEmpty()) return;
      bounds.getBoundingSphere(sphere);
      // A bench whose parts swing out has to be framed for where they get to,
      // not only for where they start.
      sphere.radius = Math.max(sphere.radius, mechanism.reach ?? 0);
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const horizontal = vertical * camera.aspect;
      const distance = Math.max(2.4, (sphere.radius / Math.min(vertical, horizontal)) * padding);
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      // The reading column sits on the left, so the model is nudged into the clear space on the right.
      if (viewWidth > 980) {
        camera.updateMatrixWorld();
        sideways.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(distance * horizontal * -0.16);
        camera.position.add(sideways);
        controls.target.add(sideways);
      }
      controls.update();
    }
    const fit = () => frameOn(mechanism.group);
    engine.current = {
      camera,
      controls,
      fit,
      hold: () => {
        touched = true;
      },
    };

    const tap = new PointerTap();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onDown = (e: PointerEvent) => tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 10 : 5);
    const onMove = (e: PointerEvent) => tap.move(e.pointerId, e.clientX, e.clientY);
    const onCancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const onUp = (e: PointerEvent) => {
      if (!tap.up(e.pointerId, e.clientX, e.clientY)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      for (const hit of raycaster.intersectObject(mechanism.group, true)) {
        let node: THREE.Object3D | null = hit.object;
        let visible = true;
        while (node) {
          if (!node.visible) visible = false;
          node = node.parent;
        }
        if (!visible) continue;
        const owner = partOwner(mechanism, hit.object);
        if (owner) {
          latest.current.onSelect(owner);
          return;
        }
      }
    };
    // Keyboard users get the same view control the mouse has.
    const spherical = new THREE.Spherical();
    const offset = new THREE.Vector3();
    const orbit = (turn: number, tilt: number) => {
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      spherical.theta += turn;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + tilt, controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    };
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.28 : 0.09;
      if (event.key === 'ArrowLeft') orbit(-step, 0);
      else if (event.key === 'ArrowRight') orbit(step, 0);
      else if (event.key === 'ArrowUp') orbit(0, -step);
      else if (event.key === 'ArrowDown') orbit(0, step);
      else if (event.key === '+' || event.key === '=') camera.position.sub(controls.target).multiplyScalar(0.88).add(controls.target);
      else if (event.key === '-' || event.key === '_') camera.position.sub(controls.target).multiplyScalar(1.14).add(controls.target);
      else if (event.key === 'Home') fit();
      else return;
      touched = true;
      event.preventDefault();
      controls.update();
    };
    el.addEventListener('keydown', onKey);

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerup', onUp);
    const onLost = (e: Event) => {
      e.preventDefault();
      setError('The graphics connection was interrupted. Reload to bring the view back.');
    };
    canvas.addEventListener('webglcontextlost', onLost);

    let phase = 0;
    let elapsed = 0;
    let last = performance.now();
    let presentation: ReturnType<typeof presentMechanism> | undefined;
    let dressed: Theme = props.theme;
    let raf = 0;
    const projected = new THREE.Vector3();

    function render(now: number) {
      raf = requestAnimationFrame(render);
      // The first frame timestamp may precede setup in the same browser frame.
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      if (document.hidden) return;
      const p = latest.current;

      if (p.theme !== dressed) {
        dressed = p.theme;
        dressRoom(dressed);
      }
      if (p.playing) {
        phase = (phase + dt * 0.22) % 1;
        elapsed += dt;
      }
      presentation?.restore();
      mechanism.update({value: p.value, variant: p.variant, extras: p.extras, phase, elapsed});

      if (!framed) {
        fit();
        framed = true;
      }

      presentation = presentMechanism(mechanism, p.selected, p.isolated);

      controls.autoRotate = p.autoRotate;
      controls.update();

      for (const {button, id} of labelNodes) {
        const anchor = mechanism.anchors[id];
        // A part the mechanism has switched off should not keep a label floating over it.
        const present = partVisible(mechanism.parts[id]);
        const show = p.labels && present && Boolean(anchor) && (!presentation.isolating || p.selected === id);
        if (button.hidden === show) button.hidden = !show;
        if (!show || !anchor) continue;
        projected.copy(anchor).project(camera);
        button.style.display = projected.z < 1 ? 'flex' : 'none';
        button.classList.toggle('chosen', id === p.selected);
        button.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * viewWidth}px,${
          (-projected.y * 0.5 + 0.5) * viewHeight
        }px,0) translate(-12px,-50%)`;
      }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener('keydown', onKey);
      engine.current = null;
      for (const {button} of labelNodes) button.remove();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
        }
      });
      env.dispose();
      pmrem.dispose();
      room.dispose();
      renderer.dispose();
      canvas.remove();
    };
    // The scene is rebuilt only when the topic changes; everything else arrives through the props ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.topic]);

  return (
    <>
      <div
        ref={host}
        className="canvas-host"
        tabIndex={0}
        role="application"
        aria-label="3D model of the mechanism. Drag to orbit, or use the arrow keys once this view has focus. Plus and minus zoom, Home resets."
      />
      {error && (
        <div className="scene-error">
          <h3>The 3D view needs a moment.</h3>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Reload the view</button>
        </div>
      )}
    </>
  );
});

export default MechanismScene;
