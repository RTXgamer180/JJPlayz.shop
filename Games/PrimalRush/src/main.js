import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { GorillaLocomotion } from "./GorillaLocomotion.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0f1d15, 9, 34);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
const rig = new THREE.Group();
rig.position.set(0, 1.7, 4);
rig.add(camera);
scene.add(rig);

const ambient = new THREE.HemisphereLight(0xd7edcf, 0x132016, 1.35);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff0c2, 1.6);
sun.position.set(6, 12, 4);
sun.castShadow = true;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(12, 14, 1.5, 40),
  new THREE.MeshStandardMaterial({ color: 0x284730, roughness: 0.96 })
);
floor.position.y = -0.75;
floor.receiveShadow = true;
scene.add(floor);

const canopy = new THREE.Mesh(
  new THREE.SphereGeometry(20, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0x0c1712, side: THREE.BackSide })
);
scene.add(canopy);

const surfaces = [];

function addSurface(size, position, color, slipPercentage = 0.03) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const box = new THREE.Box3().setFromObject(mesh);
  surfaces.push({ mesh, box, slipPercentage });
  return mesh;
}

addSurface(new THREE.Vector3(2.2, 5.5, 2.2), new THREE.Vector3(0, 2.25, -3), 0x7f5d3a, 0.015);
addSurface(new THREE.Vector3(1.8, 4.4, 1.8), new THREE.Vector3(3.6, 1.8, -5.5), 0x77502d, 0.015);
addSurface(new THREE.Vector3(1.6, 3.4, 1.6), new THREE.Vector3(-3.8, 1.2, -5), 0x6f4826, 0.015);
addSurface(new THREE.Vector3(4.4, 0.45, 2.4), new THREE.Vector3(1.5, 3.6, -1.4), 0x476b42, 0.09);
addSurface(new THREE.Vector3(3.5, 0.35, 1.5), new THREE.Vector3(-2.8, 5.2, -4.2), 0x4d7248, 0.09);

for (let i = 0; i < 12; i += 1) {
  const angle = (i / 12) * Math.PI * 2;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.08, 0),
    new THREE.MeshStandardMaterial({ color: 0x55614d, roughness: 1 })
  );
  rock.position.set(Math.cos(angle) * 6.7, 0.15, Math.sin(angle) * 6.2 - 3.2);
  rock.rotation.set(angle * 0.7, angle * 0.35, 0);
  scene.add(rock);
}

const controllerFactory = new XRControllerModelFactory();

function buildHand(color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.14 })
  );
}

const leftController = renderer.xr.getController(0);
const rightController = renderer.xr.getController(1);
rig.add(leftController);
rig.add(rightController);

const leftGrip = renderer.xr.getControllerGrip(0);
const rightGrip = renderer.xr.getControllerGrip(1);
leftGrip.add(controllerFactory.createControllerModel(leftGrip));
rightGrip.add(controllerFactory.createControllerModel(rightGrip));
rig.add(leftGrip);
rig.add(rightGrip);

const leftHandVisual = buildHand(0xe0b887);
const rightHandVisual = buildHand(0xe0b887);
leftController.add(leftHandVisual);
rightController.add(rightHandVisual);

const leftFollower = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 14, 14),
  new THREE.MeshBasicMaterial({ color: 0x5df2b1, transparent: true, opacity: 0.95 })
);
const rightFollower = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 14, 14),
  new THREE.MeshBasicMaterial({ color: 0x69d4ff, transparent: true, opacity: 0.95 })
);
scene.add(leftFollower);
scene.add(rightFollower);

const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.22, 0.9, 6, 12),
  new THREE.MeshStandardMaterial({
    color: 0x9fc07f,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  })
);
rig.add(body);

const locomotion = new GorillaLocomotion({
  rig,
  head: camera,
  leftHand: leftController,
  rightHand: rightController,
  leftFollower,
  rightFollower,
  surfaces
});

const xrCameraWorld = new THREE.Vector3();
const clock = new THREE.Clock();

renderer.xr.addEventListener("sessionstart", () => {
  locomotion.initialize();
  clock.start();
});

renderer.xr.addEventListener("sessionend", () => {
  locomotion.initialize();
});

locomotion.initialize();

function updateDesktopFallback(timeSeconds) {
  if (renderer.xr.isPresenting) {
    return;
  }

  camera.position.set(0, 0, 0);
  const sway = Math.sin(timeSeconds * 1.7) * 0.12;
  const reach = 0.38 + Math.sin(timeSeconds * 1.3) * 0.06;

  leftController.position.set(-0.32 + sway, -0.35, -reach);
  rightController.position.set(0.32 - sway, -0.35, -reach);
}

function updateBodyVisual() {
  renderer.xr.getCamera(camera).getWorldPosition(xrCameraWorld);
  body.position.set(0, -0.95, 0);
  body.visible = !renderer.xr.isPresenting;
}

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta() || 1 / 72;
  const elapsed = clock.elapsedTime;

  updateDesktopFallback(elapsed);
  updateBodyVisual();
  locomotion.update(dt);

  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
