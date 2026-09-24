import * as THREE from 'three';

/*
  A low, sharp hypercar built only from primitives and extruded profiles.
  Units are roughly metres. The car points down +X, sits on y = 0,
  and is centred on the origin.
*/

const WHEEL_R = 0.35;
const WHEEL_BASE = 1.42; // half wheelbase (front axle at +X)
const TRACK = 0.8; // half track
const ARCH_R = 0.42;

function sideProfile() {
  const s = new THREE.Shape();
  s.moveTo(-2.32, 0.3); // rear, bottom
  s.lineTo(-1.84, 0.2);
  s.absarc(-WHEEL_BASE, WHEEL_R, ARCH_R, Math.PI, 0, true); // rear arch
  s.lineTo(-0.98, 0.18);
  s.lineTo(0.98, 0.18);
  s.lineTo(1.0, WHEEL_R);
  s.absarc(WHEEL_BASE, WHEEL_R, ARCH_R, Math.PI, 0, true); // front arch
  s.lineTo(1.9, 0.2);
  s.lineTo(2.34, 0.16); // splitter
  s.lineTo(2.46, 0.26); // nose tip
  s.bezierCurveTo(2.32, 0.5, 1.98, 0.76, 1.42, 0.86); // nose → front fender crest
  s.quadraticCurveTo(1.05, 0.9, 0.8, 0.86); // scuttle
  s.lineTo(-0.9, 0.9); // under the canopy
  s.quadraticCurveTo(-1.4, 0.99, -1.95, 0.95); // rear haunch
  s.lineTo(-2.3, 0.93); // ducktail lip
  s.lineTo(-2.4, 0.64); // tail
  s.lineTo(-2.32, 0.3);
  return s;
}

function cabinProfile() {
  const s = new THREE.Shape();
  s.moveTo(1.02, 0.8);
  s.quadraticCurveTo(0.45, 1.13, -0.2, 1.2); // raked windscreen → roof
  s.quadraticCurveTo(-1.0, 1.19, -1.95, 0.97); // fastback
  s.lineTo(-1.8, 0.84);
  s.lineTo(0.95, 0.78);
  return s;
}

/* Squeeze an extrusion in Z so the car narrows toward the roof and the nose. */
function taper(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, p.getZ(i) * fn(x, y));
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

function extrude(shape, depth, bevel, segments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 5,
    curveSegments: segments,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildWheel(mats) {
  const wheel = new THREE.Group();

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 48, 1), mats.rubber);
  tire.rotation.x = Math.PI / 2;
  wheel.add(tire);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.31, 48, 1), mats.rimDark);
  rim.rotation.x = Math.PI / 2;
  wheel.add(rim);

  // Five sharp spokes on the outer face
  const spokeGeo = new THREE.BoxGeometry(0.035, 0.46, 0.03);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeo, mats.rim);
    spoke.rotation.z = (i / 5) * Math.PI * 2;
    spoke.position.z = 0.16;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), mats.rim);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.17;
  wheel.add(hub);

  // The one red detail on the car: brake calipers
  const caliper = box(0.16, 0.09, 0.06, mats.caliper, 0, 0.17, 0.1);
  caliper.rotation.z = -0.5;
  caliper.position.set(0.09, 0.14, 0.1);
  wheel.add(caliper);

  return wheel;
}

export function buildCar(cfg) {
  const car = new THREE.Group();
  car.name = 'veloce';

  const first = cfg.paint[0];
  const paint = new THREE.MeshPhysicalMaterial({
    color: first.color,
    metalness: first.metalness,
    roughness: first.roughness,
    clearcoat: cfg.clearcoat,
    clearcoatRoughness: cfg.clearcoatRoughness,
    envMapIntensity: 1,
  });

  const mats = {
    paint,
    glass: new THREE.MeshPhysicalMaterial({
      color: '#020203',
      metalness: 0.9,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    carbon: new THREE.MeshStandardMaterial({ color: '#0b0b0c', metalness: 0.4, roughness: 0.45 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#070707', metalness: 0, roughness: 0.85 }),
    rim: new THREE.MeshStandardMaterial({ color: '#3a3c40', metalness: 1, roughness: 0.25 }),
    rimDark: new THREE.MeshStandardMaterial({ color: '#0e0f11', metalness: 0.8, roughness: 0.4 }),
    caliper: new THREE.MeshStandardMaterial({ color: '#b00d24', metalness: 0.3, roughness: 0.35 }),
    headlight: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    taillight: new THREE.MeshBasicMaterial({ color: cfg.tailLightColor, toneMapped: false }),
  };

  // ---- Main body
  const bodyGeo = extrude(sideProfile(), 1.66, 0.14, 32);
  taper(bodyGeo, (x, y) => {
    const ny = THREE.MathUtils.clamp((y - 0.2) / 0.78, 0, 1);
    let s = 1 - 0.22 * ny * ny; // tumblehome
    if (x > 0.6) s *= 1 - 0.4 * ((x - 0.6) / 1.86) ** 1.6; // pointed nose
    if (x < -1.8) s *= 1 - 0.1 * ((-1.8 - x) / 0.6) ** 2;
    s *= 1 - 0.035 * Math.exp(-((x + 0.1) ** 2) / 0.5) * ny; // coke-bottle waist
    return s;
  });
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  // ---- Canopy
  const cabinGeo = extrude(cabinProfile(), 0.96, 0.12, 32);
  taper(cabinGeo, (x, y) => {
    const ny = THREE.MathUtils.clamp((y - 0.78) / 0.42, 0, 1);
    const nx = THREE.MathUtils.clamp((x + 0.45) / 1.5, -1, 1);
    return (1 - 0.34 * ny) * (1 - 0.22 * nx * nx); // teardrop in plan
  });
  const cabin = new THREE.Mesh(cabinGeo, mats.glass);
  car.add(cabin);

  // ---- Carbon: side skirts, splitter, diffuser
  car.add(box(1.9, 0.05, 2.0, mats.carbon, 0, 0.17, 0));
  const splitter = box(0.4, 0.025, 1.5, mats.carbon, 2.26, 0.16, 0);
  car.add(splitter);
  const diffuser = box(0.4, 0.14, 1.4, mats.carbon, -2.2, 0.26, 0);
  diffuser.rotation.z = -0.25;
  car.add(diffuser);
  for (let i = -2; i <= 2; i++) {
    const fin = box(0.42, 0.12, 0.02, mats.carbon, -2.22, 0.27, i * 0.26);
    fin.rotation.z = -0.25;
    car.add(fin);
  }

  // ---- Rear wing
  const wing = box(0.36, 0.025, 1.84, mats.carbon, -2.06, 1.16, 0);
  wing.rotation.z = 0.08;
  car.add(wing);
  [-0.5, 0.5].forEach((z) => car.add(box(0.14, 0.24, 0.03, mats.carbon, -2.02, 1.04, z)));
  [-0.93, 0.93].forEach((z) => car.add(box(0.42, 0.14, 0.02, mats.carbon, -2.06, 1.14, z)));

  // ---- Lights, snapped onto the painted surface with a raycast
  const ray = new THREE.Raycaster();
  const surface = (origin, dir) => {
    ray.set(origin, dir);
    const hit = ray.intersectObject(body, false)[0];
    return hit ? hit.point : origin;
  };
  [-1, 1].forEach((side) => {
    const p = surface(new THREE.Vector3(4, 0.4, side * 0.46), new THREE.Vector3(-1, 0, 0));
    const hl = box(0.03, 0.028, 0.36, mats.headlight, p.x + 0.005, p.y, p.z);
    hl.rotation.y = side * -0.5;
    car.add(hl);
  });
  const tail = surface(new THREE.Vector3(-4, 0.82, 0), new THREE.Vector3(1, 0, 0));
  car.add(box(0.03, 0.04, 1.5, mats.taillight, tail.x - 0.005, tail.y, 0));
  const rearLow = surface(new THREE.Vector3(-4, 0.42, 0), new THREE.Vector3(1, 0, 0));
  const rearPanel = box(0.03, 0.3, 1.56, mats.carbon, rearLow.x - 0.01, 0.42, 0);
  rearPanel.rotation.z = -0.12;
  car.add(rearPanel);

  // ---- Side intakes (dark blades just behind the doors)
  [-1, 1].forEach((side) => {
    const p = surface(new THREE.Vector3(-0.72, 0.52, side * 3), new THREE.Vector3(0, 0, -side));
    const intake = box(0.6, 0.16, 0.04, mats.carbon, p.x, p.y, p.z);
    intake.rotation.y = side * 0.08;
    car.add(intake);
  });

  // ---- Wheels
  const wheels = [];
  [
    [WHEEL_BASE, TRACK],
    [WHEEL_BASE, -TRACK],
    [-WHEEL_BASE, TRACK],
    [-WHEEL_BASE, -TRACK],
  ].forEach(([x, z]) => {
    const w = buildWheel(mats);
    w.position.set(x, WHEEL_R, z);
    if (z < 0) w.rotation.y = Math.PI; // spokes face outward on both sides
    car.add(w);
    wheels.push(w);
  });

  return { car, paint, materials: mats, wheels };
}
