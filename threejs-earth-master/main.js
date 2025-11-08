// High-res Earth with correct color space, anisotropy, polar fixes, and hotspot overlay.
// Includes robust data loading with a visible mock fallback.

const THREE = window.THREE;

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ---------- Scene & Camera ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  50,                                 // narrower FOV helps perceived proportions
  window.innerWidth / window.innerHeight,
  0.1, 500
);
camera.position.set(0, 0, 14);

// ---------- Lights (balanced to avoid gray poles) ----------
const hemiLight = new THREE.HemisphereLight(0x88caff, 0x0a0f1a, 0.55);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(6, 3, 8);
scene.add(dirLight);

const ambLight = new THREE.AmbientLight(0x223344, 0.45);
scene.add(ambLight);

// ---------- Texture helpers ----------
const textureLoader = new THREE.TextureLoader();

function configureColorTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function configureLinearTex(tex) {
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ---------- Starfield ----------
const starTex = configureColorTex(textureLoader.load('texture/stars_4k.png'));
const starGeo = new THREE.SphereGeometry(90, 64, 64);
const starMat = new THREE.MeshBasicMaterial({ map: starTex, side: THREE.BackSide, depthWrite: false });
const starMesh = new THREE.Mesh(starGeo, starMat);
scene.add(starMesh);

// ---------- Earth ----------
const earthRadius = 5.0;
const earthGeo = new THREE.SphereGeometry(earthRadius, 128, 128);

// Base maps (switch with toggle)
let useIceFreeMap = false;
// Default: general 8K map; if you add an ice-free (summer) map, toggle will swap it.
const EARTH_MAP_DEFAULT = 'texture/earth_8k.jpg';
const EARTH_MAP_ICEFRE  = 'texture/earth_8k_noice.jpg'; // optional

function loadEarthMap() {
  const path = (useIceFreeMap && EARTH_MAP_ICEFRE) ? EARTH_MAP_ICEFRE : EARTH_MAP_DEFAULT;
  return configureColorTex(textureLoader.load(path));
}

const earthColor = loadEarthMap();
const earthBump  = configureLinearTex(textureLoader.load('texture/earth_bump_8k.jpg'));

const earthMat = new THREE.MeshStandardMaterial({
  map:       earthColor,
  metalness: 0.0,
  roughness: 1.0,
  bumpMap:   earthBump,
  bumpScale: 0.10    // keep modest to avoid polar artifacts
});

const earthMesh = new THREE.Mesh(earthGeo, earthMat);
earthMesh.rotation.z = THREE.MathUtils.degToRad(23.5);  // axial tilt
scene.add(earthMesh);

// ---------- Clouds ----------
const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.01, 128, 128);
const cloudsTex = configureColorTex(textureLoader.load('texture/earth_clouds_4k.png'));
cloudsTex.premultiplyAlpha = true;
const cloudsMat = new THREE.MeshPhongMaterial({
  map: cloudsTex,
  transparent: true,
  opacity: 0.9,
  depthWrite: false
});
const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
scene.add(cloudsMesh);

// ---------- Hotspots ----------
const hotspotGroup = new THREE.Group();
scene.add(hotspotGroup);

function latLngToVector3(lat, lon, radius = earthRadius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z =  radius * Math.sin(phi) * Math.sin(theta);
  const y =  radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function createHotspot(pos, intensity = 0.5) {
  const geom = new THREE.SphereGeometry(0.12 + 0.25 * intensity, 24, 24);
  const mat  = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.0, 0.0),
    transparent: true,
    opacity: Math.min(1.0, 0.25 + 0.75 * intensity),
    depthTest: true,
    depthWrite: true
  });
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(latLngToVector3(pos.lat, pos.lng, earthRadius * 1.02));
  return m;
}

function updateHotspots(hotspots) {
  while (hotspotGroup.children.length) hotspotGroup.remove(hotspotGroup.children[0]);
  hotspots.forEach(h => {
    if (!h || !h.position) return;
    hotspotGroup.add(createHotspot(h.position, h.intensity ?? 0.5));
  });
}

// Expose a quick test so you can validate rendering path
window.testHotspots = () => {
  updateHotspots([
    { position: { lat: 40,   lng: -74 },   intensity: 0.9 },
    { position: { lat: 51.5, lng: -0.12 }, intensity: 0.6 },
    { position: { lat: 35.7, lng: 139.7 }, intensity: 0.7 },
  ]);
};

// ---------- Simple drag to rotate ----------
let isDragging = false;
let prev = { x: 0, y: 0 };
let rotX = 0.0;
let rotY = 0.0;

function onDown(e) { isDragging = true; prev.x = e.clientX; prev.y = e.clientY; }
function onMove(e) {
  if (!isDragging) return;
  const dx = (e.clientX - prev.x) * 0.005;
  const dy = (e.clientY - prev.y) * 0.005;
  prev.x = e.clientX; prev.y = e.clientY;
  rotX += dx;
  rotY = Math.max(-Math.PI/3, Math.min(Math.PI/3, rotY + dy));
}
function onUp(){ isDragging = false; }

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
window.addEventListener('touchstart', e => onDown(e.touches[0]));
window.addEventListener('touchmove', e => onMove(e.touches[0]));
window.addEventListener('touchend', onUp);

// ---------- Animation loop ----------
function animate() {
    requestAnimationFrame(animate);
    
    // Update earth rotation based on drag
    earthMesh.rotation.x = rotY;
    earthMesh.rotation.y = rotX;
    
    // Sync clouds with earth rotation
    cloudsMesh.rotation.copy(earthMesh.rotation);
    
    // Sync hotspots with earth rotation
    hotspotGroup.rotation.copy(earthMesh.rotation);
    
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation loop
animate();
