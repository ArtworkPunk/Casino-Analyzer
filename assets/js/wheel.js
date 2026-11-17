/* =========================================================
   Three.js roulette wheel
   Procedural geometry — no external models, no licensing issues.
   ========================================================= */

import * as THREE from 'three';
import { colorOfNumber } from './analysis.js';

const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const POCKETS = ORDER.length;
const STEP = (Math.PI * 2) / POCKETS;
const R_IN = 0.68;
const R_OUT = 2.0;
const TOP_Y = 0.19;

const reduceMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeEnvironmentTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#f3e2b8');
  grad.addColorStop(0.28, '#8a6a3c');
  grad.addColorStop(0.55, '#241a10');
  grad.addColorStop(1, '#03060a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);

  const spot = g.createRadialGradient(70, 34, 2, 70, 34, 46);
  spot.addColorStop(0, 'rgba(255,250,235,.95)');
  spot.addColorStop(1, 'rgba(255,250,235,0)');
  g.fillStyle = spot;
  g.fillRect(0, 0, 256, 128);

  const spot2 = g.createRadialGradient(196, 60, 2, 196, 60, 34);
  spot2.addColorStop(0, 'rgba(255,180,130,.55)');
  spot2.addColorStop(1, 'rgba(255,180,130,0)');
  g.fillStyle = spot2;
  g.fillRect(0, 0, 256, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wedgeGeometry(a0, a1) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R_OUT, a0, a1, false);
  shape.absarc(0, 0, R_IN, a1, a0, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.075, 0);
  geo.computeVertexNormals();
  return geo;
}

export function createWheel(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('WebGL недоступен', err);
    return null;
  }
  if (!renderer || !renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const FOV = 38;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);

  /* fit the wheel into the canvas, whatever its aspect */
  function frameCamera() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const aspect = w / h;
    const halfV = Math.tan((FOV * Math.PI) / 360);
    const halfH = halfV * aspect;
    const R = 2.36;
    const pitch = (36 * Math.PI) / 180;
    const dH = R / (0.78 * halfH);
    const dV = (R * Math.sin(pitch)) / (0.8 * halfV);
    const d = Math.max(dH, dV, 4.8);
    camera.position.set(0, Math.sin(pitch) * d, Math.cos(pitch) * d);
    camera.lookAt(0, 0.02, 0);
    camera.updateProjectionMatrix();
  }
  frameCamera();

  /* environment reflections */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSource = makeEnvironmentTexture();
  scene.environment = pmrem.fromEquirectangular(envSource).texture;
  envSource.dispose();
  pmrem.dispose();

  /* lights */
  const hemi = new THREE.HemisphereLight(0xffe9c0, 0x0a1a14, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2d2, 2.6);
  key.position.set(3.4, 6.2, 4.2);
  scene.add(key);

  const fill = new THREE.PointLight(0xff6a6a, 22, 12, 2);
  fill.position.set(-3.6, 2.2, 2.4);
  scene.add(fill);

  const rim = new THREE.PointLight(0x74d8ff, 16, 12, 2);
  rim.position.set(3.4, 1.6, -2.8);
  scene.add(rim);

  /* materials */
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24a,
    metalness: 1,
    roughness: 0.24,
    emissive: 0x241604,
    emissiveIntensity: 0.5,
  });
  const goldBright = new THREE.MeshStandardMaterial({
    color: 0xe8c77e,
    metalness: 1,
    roughness: 0.16,
    emissive: 0x3a2708,
    emissiveIntensity: 0.7,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1109,
    metalness: 0.55,
    roughness: 0.45,
  });

  const feltMat = new THREE.MeshStandardMaterial({
    color: 0x0a2c21,
    metalness: 0.1,
    roughness: 0.92,
  });

  const pocketMats = {
    red: new THREE.MeshStandardMaterial({
      color: 0xa3162a,
      metalness: 0.28,
      roughness: 0.42,
      emissive: 0x2c0409,
      emissiveIntensity: 0.45,
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x12171d,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x04070a,
      emissiveIntensity: 0.35,
    }),
    green: new THREE.MeshStandardMaterial({
      color: 0x0d6a46,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x032a1a,
      emissiveIntensity: 0.5,
    }),
  };

  const wheel = new THREE.Group();
  scene.add(wheel);

  /* base bowl */
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.34, 0.34, 96), darkMat);
  base.position.y = 0.0;
  wheel.add(base);

  const felt = new THREE.Mesh(new THREE.CylinderGeometry(2.06, 2.06, 0.05, 96), feltMat);
  felt.position.y = 0.165;
  wheel.add(felt);

  /* pockets */
  const gap = 0.008;
  for (let i = 0; i < POCKETS; i++) {
    const a0 = i * STEP + gap;
    const a1 = (i + 1) * STEP - gap;
    const num = ORDER[i];
    const color = colorOfNumber(num);
    const mesh = new THREE.Mesh(wedgeGeometry(a0, a1), pocketMats[color]);
    mesh.position.y = TOP_Y;
    wheel.add(mesh);
  }

  /* gold frets */
  const fretGeo = new THREE.BoxGeometry(0.016, 0.09, R_OUT - R_IN);
  fretGeo.translate(0, 0, (R_OUT + R_IN) / 2);
  for (let i = 0; i < POCKETS; i++) {
    const fret = new THREE.Mesh(fretGeo, goldMat);
    fret.position.y = TOP_Y + 0.04;
    fret.rotation.y = Math.PI / 2 - i * STEP;
    wheel.add(fret);
  }

  /* rings */
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(2.06, 0.085, 20, 128), goldMat);
  outerRim.rotation.x = Math.PI / 2;
  outerRim.position.y = 0.2;
  wheel.add(outerRim);

  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(R_IN, 0.035, 14, 96), goldBright);
  innerRim.rotation.x = Math.PI / 2;
  innerRim.position.y = 0.245;
  wheel.add(innerRim);

  const tableRing = new THREE.Mesh(new THREE.TorusGeometry(2.24, 0.02, 12, 128), goldMat);
  tableRing.rotation.x = Math.PI / 2;
  tableRing.position.y = 0.03;
  wheel.add(tableRing);

  /* hub */
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.38, 64), darkMat);
  hub.position.y = 0.22;
  wheel.add(hub);

  const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.06, 64), goldMat);
  hubTop.position.y = 0.43;
  wheel.add(hubTop);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), goldBright);
  knob.position.y = 0.52;
  wheel.add(knob);

  const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 24), goldMat);
  knobStem.position.y = 0.46;
  wheel.add(knobStem);

  /* pointer at 12 o'clock (far side, -Z) — fixed, does not rotate with the wheel */
  const pointer = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), goldBright);
  arm.position.y = 0.58;
  pointer.add(arm);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 24), goldBright);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.35;
  pointer.add(cone);

  const pointerBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 16), goldBright);
  pointerBall.position.y = 0.74;
  pointer.add(pointerBall);

  pointer.position.set(0, 0, -2.24);
  scene.add(pointer);

  /* soft shadow */
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sg = shadowCanvas.getContext('2d');
  const shadowGrad = sg.createRadialGradient(64, 64, 6, 64, 64, 64);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,.55)');
  shadowGrad.addColorStop(0.62, 'rgba(0,0,0,.28)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = shadowGrad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.2;
  scene.add(shadow);

  /* gold dust */
  const DUST = reduceMotion ? 0 : 80;
  const dustPos = new Float32Array(DUST * 3);
  const dustSpeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = 1.3 + Math.random() * 2.0;
    const a = Math.random() * Math.PI * 2;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = 0.2 + Math.random() * 1.7;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustSpeed[i] = 0.02 + Math.random() * 0.06;
  }
  let dust = null;
  if (DUST) {
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xffd98a,
        size: 0.035,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    scene.add(dust);
  }

  /* sizing */
  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frameCamera();
  }
  resize();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', resize);

  /* animation */
  let raf = 0;
  let last = performance.now();
  let spin = null;
  let hasResult = false;
  let idleAngle = wheel.rotation.y;

  function spinTo(num) {
    const idx = ORDER.indexOf(Number(num));
    if (idx < 0) return false;

    hasResult = true;
    const phi = (idx + 0.5) * STEP;
    const desired = phi + Math.PI / 2;
    const current = wheel.rotation.y;
    const twoPi = Math.PI * 2;
    const norm = ((desired - current) % twoPi + twoPi) % twoPi;
    const to = current + norm + twoPi * 4;

    if (reduceMotion) {
      wheel.rotation.y = desired;
      return true;
    }
    spin = { from: current, to, start: performance.now(), dur: 2850 };
    return true;
  }

  function pulse() {
    if (reduceMotion) return;
    const from = wheel.rotation.y;
    spin = { from, to: from + Math.PI * 2, start: performance.now(), dur: 1500 };
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (spin) {
      const k = Math.min(1, (now - spin.start) / spin.dur);
      const e = 1 - Math.pow(1 - k, 4);
      wheel.rotation.y = spin.from + (spin.to - spin.from) * e;
      if (k >= 1) {
        spin = null;
        idleAngle = wheel.rotation.y;
      }
    } else {
      if (!hasResult && !reduceMotion) {
        wheel.rotation.y += 0.075 * dt;
        idleAngle = wheel.rotation.y;
      } else {
        wheel.rotation.y = idleAngle + Math.sin(now * 0.0006) * 0.006;
      }
    }

    if (dust) {
      const p = dust.geometry.attributes.position.array;
      for (let i = 0; i < DUST; i++) {
        p[i * 3 + 1] += dustSpeed[i] * dt;
        if (p[i * 3 + 1] > 2.1) p[i * 3 + 1] = 0.15;
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.rotation.y += dt * 0.05;
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function onVisible() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
  }
  document.addEventListener('visibilitychange', onVisible);

  function dispose() {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisible);
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
  }

  return { spinTo, pulse, resize, dispose };
}
