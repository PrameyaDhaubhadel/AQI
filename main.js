// threejs-earth-fixed/main.js
// High‑res Earth with proper color space, anti‑aliasing, anisotropic filtering,
// and polar artifact fixes. Also keeps your hotspot overlay logic.

// Make hotspotGroup globally accessible
window.hotspotGroup = null;

// Wait for Three.js to load
window.addEventListener('DOMContentLoaded', () => {
  if (!window.THREE) {
    console.error('Three.js not loaded! Check if three.js is included properly.');
    return;
  }
  initScene();
});

function initScene() {
// ---- Renderer & Scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;      // correct color management
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ---- Camera ----
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0, 14);

// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Get tooltip element from HTML
const tooltip = document.getElementById('tooltip');
if (!tooltip) {
  console.error('Tooltip element not found! Make sure the HTML has <div id="tooltip"></div>');
}

// ---- Lights (balanced to avoid gray poles) ----
const hemiLight = new THREE.HemisphereLight(0x88caff, 0x0a0f1a, 0.7);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(6, 3, 8);
dirLight.castShadow = false;
scene.add(dirLight);

// A gentle ambient to lift the dark side without washing out the day side
const ambLight = new THREE.AmbientLight(0x223344, 0.35);
scene.add(ambLight);

// ---- Helpers ----
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
  // For bump/normal maps (linear space)
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ---- Starfield ----
const starTex = configureColorTex(
  textureLoader.load(
    'texture/stars_4k.png',
    undefined,
    undefined,
    (error) => console.error('Error loading stars texture:', error)
  )
);
const starGeo = new THREE.SphereGeometry(90, 64, 64);
const starMat = new THREE.MeshBasicMaterial({ map: starTex, side: THREE.BackSide, depthWrite: false });
const starMesh = new THREE.Mesh(starGeo, starMat);
scene.add(starMesh);

// ---- Earth (high‑res, higher segment count to remove polar faceting) ----
const earthRadius = 5.0;
const earthGeo = new THREE.SphereGeometry(earthRadius, 128, 128);

const earthColor = configureColorTex(
  textureLoader.load(
    'texture/earth_8k.jpg',
    undefined,
    undefined,
    (error) => console.error('Error loading earth texture:', error)
  )
);
const earthBump = configureLinearTex(
  textureLoader.load(
    'texture/earth_bump_8k.jpg',
    undefined,
    undefined,
    (error) => console.error('Error loading bump texture:', error)
  )
);

const earthMat = new THREE.MeshStandardMaterial({
  map:       earthColor,
  metalness: 0.0,
  roughness: 1.0,            // matte diffuse look
  bumpMap:   earthBump,
  bumpScale: 0.25            // keep modest to avoid polar artifacts
});

const earthMesh = new THREE.Mesh(earthGeo, earthMat);
earthMesh.rotation.z = THREE.MathUtils.degToRad(23.5);  // axial tilt
scene.add(earthMesh);

// ---- Clouds (transparent, slightly above surface) ----
const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.01, 128, 128);
const cloudsTex = configureColorTex(
  textureLoader.load(
    'texture/earth_clouds_4k.png',
    undefined,
    undefined,
    (error) => console.error('Error loading clouds texture:', error)
  )
);
cloudsTex.premultiplyAlpha = true;

const cloudsMat = new THREE.MeshPhongMaterial({
  map:        cloudsTex,
  transparent: true,
  opacity:    0.9,
  depthWrite: false
});
const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
scene.add(cloudsMesh);

// ---- Hotspots group (keeps your existing API) ----
window.hotspotGroup = new THREE.Group();
// Parent hotspots to Earth so they rotate with it
earthMesh.add(window.hotspotGroup);

// Signal that the globe is ready
window.globeReady = true;
console.log('Globe initialization complete, hotspotGroup ready');

// Simple helper to convert lat/lon to 3D position
function latLngToVector3(lat, lon, radius = earthRadius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z =  radius * Math.sin(phi) * Math.sin(theta);
  const y =  radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Create a hotspot mesh with glow effect, now accepts color
function createHotspot({ lat, lng }, intensity = 0.5, color = new THREE.Color(1,0,0)) {
  // Create a group to hold both the marker and its glow
  const group = new THREE.Group();

  // Main marker (size scales with intensity)
  const markerGeom = new THREE.SphereGeometry(0.08 + 0.35 * intensity, 16, 16);
  const markerMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: Math.min(0.7, 0.3 + 0.4 * intensity)
  });
  const marker = new THREE.Mesh(markerGeom, markerMat);

  // Glow effect (size scales with intensity)
  const glowGeom = new THREE.SphereGeometry(0.15 + 0.5 * intensity, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: Math.min(0.25, 0.1 + 0.15 * intensity),
    depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeom, glowMat);

  group.add(marker);
  group.add(glow);
  group.position.copy(latLngToVector3(lat, lng, earthRadius * 1.02));
  return group;
}

// Make createHotspot globally available
window.createHotspot = createHotspot;

// Enhanced updateHotspots to show different colors based on AQI levels
function updateHotspots(hotspots) {
  if (!window.hotspotGroup) {
    console.error('Hotspot group not initialized yet');
    return;
  }
  console.log('Updating hotspots with', hotspots?.length || 0, 'cities');
  
  // clear existing hotspots
  while (window.hotspotGroup.children.length) {
    window.hotspotGroup.remove(window.hotspotGroup.children[0]);
  }
  if (!hotspots || hotspots.length === 0) return;

  hotspots.forEach((h, i) => {
    // Use exact coordinates from city data
    const position = h.position || { lat: 0, lng: 0 };
    console.log(`Creating hotspot for ${h.name} at coordinates:`, position);
    
    // Color and size based on 3 AQI categories with darker red shades
    // Convert intensity (0-1) back to AQI (0-500) for proper categorization
    const aqi = Math.round(h.intensity * 500);
    let color;
    let sizeMultiplier;
    let aqiCategory;
    
    if (aqi <= 50) {
      // Good (0-50): Green, small size
      color = new THREE.Color(0.2, 0.8, 0.2);
      sizeMultiplier = 0.3;
      aqiCategory = 'Good';
    } else if (aqi <= 100) {
      // Moderate (51-100): Orange, medium size
      color = new THREE.Color(1.0, 0.6, 0.1);
      sizeMultiplier = 0.6;
      aqiCategory = 'Moderate';
    } else {
      // Unhealthy (100+): Dark Red, large size
      color = new THREE.Color(0.6, 0.05, 0.05);
      sizeMultiplier = 1.0;
      aqiCategory = 'Unhealthy';
    }
    
    // Create hotspot at exact city coordinates
    const hs = createHotspot(position, sizeMultiplier, color);
    
    // Enhanced popup data with detailed information
    hs.userData.cityData = {
      name: h.name || 'Unknown City',
      aqi: aqi,
      category: aqiCategory,
      coordinates: `${position.lat.toFixed(2)}°, ${position.lng.toFixed(2)}°`,
      info: h.info || `AQI: ${aqi} (${aqiCategory})`
    };
    

    
    window.hotspotGroup.add(hs);
  });
  
  console.log('Added', hotspots.length, 'hotspots to globe');
}

// ---- Basic drag to rotate (keeps your UX) ----
let isDragging = false;
let prev = { x: 0, y: 0 };
// user-driven rotation offsets (from drag)
let userRotY = 0.0; // yaw (around Y)
let userRotX = 0.0; // pitch (around X)

// Earth's absolute rotation angle (radians). We advance this using real time.
let earthRotation = 0.0;

// Real-world sidereal rotation: 2π radians / 86164 seconds (~23h56m)
const SIDEREAL_SECONDS = 86164;
const siderealAngularSpeed = 2 * Math.PI / SIDEREAL_SECONDS; // rad / s

// Controls for speed - Starting with 1000x speed as default
let speedMultiplier = window.SPEED_CONFIG ? window.SPEED_CONFIG.DEFAULT_SPEED : 1000;
let useRealTime = false; // Start in custom speed mode, not real-time

// Clock for delta time
const clock = new THREE.Clock();

function onDown(e) {
  isDragging = true;
  prev.x = e.clientX; prev.y = e.clientY;
}
function onMove(e) {
  if (!isDragging) return;
  const dx = (e.clientX - prev.x) * 0.005;
  const dy = (e.clientY - prev.y) * 0.005;
  prev.x = e.clientX; prev.y = e.clientY;
  // user yaw/pan
  userRotY += dx;
  // clamp pitch
  userRotX = Math.max(-Math.PI/3, Math.min(Math.PI/3, userRotX + dy));
}
function onUp(){ isEulerDirty = true; isDragging = false; }

// Handle mouse hover for hotspots
function onMouseMove(event) {
  if (isDragging) {
    onMove(event);
    return;
  }

  // Calculate mouse position in normalized device coordinates (-1 to +1)
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Find all hotspot meshes in the hotspotGroup
  const hotspots = [];
  if (window.hotspotGroup) {
    window.hotspotGroup.traverse(child => {
      if (child.isMesh) hotspots.push(child);
    });
  }

  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(hotspots);

  if (intersects.length > 0) {
    const intersection = intersects[0];
    const hotspotGroup = intersection.object.parent;
    if (hotspotGroup && hotspotGroup.userData.cityData) {
      const cityData = hotspotGroup.userData.cityData;
      
      // Enhanced popup with detailed AQI information
      let aqiColor = '#33cc33'; // Default green
      if (cityData.aqi <= 50) {
        aqiColor = '#33cc33'; // Green for good
      } else if (cityData.aqi <= 100) {
        aqiColor = '#ff9933'; // Orange for moderate
      } else {
        aqiColor = '#b71c1c'; // Dark Red for unhealthy
      }
      
      tooltip.innerHTML = `
        <div style="font-family: Arial, sans-serif; background: rgba(0,0,0,0.9); padding: 12px; border-radius: 8px; color: white; border: 2px solid ${aqiColor};">
          <div style="font-size: 16px; font-weight: bold; color: ${aqiColor}; margin-bottom: 8px;">${cityData.name}</div>
          <div style="margin-bottom: 4px;"><strong>AQI:</strong> <span style="color: ${aqiColor};">${cityData.aqi}</span> (${cityData.category})</div>
          <div style="margin-bottom: 4px;"><strong>Coordinates:</strong> ${cityData.coordinates}</div>
          <div style="font-size: 12px; color: #ccc; margin-top: 8px;">${cityData.info}</div>
        </div>
      `;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.clientX + 15) + 'px';
      tooltip.style.top = (event.clientY - 10) + 'px';
      
      // Add some styling to make the tooltip look better
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '1000';
      tooltip.style.border = 'none';
      tooltip.style.borderRadius = '0';
      tooltip.style.background = 'transparent';
      tooltip.style.padding = '0';
    }
  } else {
    tooltip.style.display = 'none';
  }
}

function onMouseLeave() {
  tooltip.style.display = 'none';
}

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onUp);
renderer.domElement.addEventListener('mouseleave', onMouseLeave);

// ---- Animation ----
let isEulerDirty = false;
function createControls() {
  // Enhanced control panel for better speed control
  const c = document.createElement('div');
  c.style.position = 'absolute';
  c.style.right = '12px';
  c.style.bottom = '12px';
  c.style.background = 'rgba(0,0,0,0.8)';
  c.style.color = 'white';
  c.style.padding = '12px 15px';
  c.style.borderRadius = '10px';
  c.style.fontSize = '13px';
  c.style.zIndex = 20;
  c.style.minWidth = '200px';
  c.style.border = '1px solid rgba(255,255,255,0.2)';

  // Title
  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '10px';
  title.style.fontSize = '14px';
  title.textContent = 'Earth Rotation Speed';
  c.appendChild(title);

  // Real-time checkbox
  const label = document.createElement('label');
  label.style.display = 'block';
  label.style.marginBottom = '8px';
  label.style.cursor = 'pointer';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = false; // Start unchecked since we default to 1000x speed
  chk.id = 'realtime-check';
  chk.style.marginRight = '6px';
  label.appendChild(chk);
  label.appendChild(document.createTextNode(' Real-time rotation (1×)'));
  c.appendChild(label);

  // Speed display and controls
  const speedSection = document.createElement('div');
  speedSection.style.marginTop = '10px';
  
  const rangeLabel = document.createElement('div');
  rangeLabel.style.marginBottom = '6px';
  rangeLabel.style.fontWeight = 'bold';
  rangeLabel.style.color = '#4CAF50';
  rangeLabel.textContent = `Speed: ${speedMultiplier.toFixed(1)}×`;
  speedSection.appendChild(rangeLabel);

  // Speed range slider
  const range = document.createElement('input');
  range.type = 'range';
  const config = window.SPEED_CONFIG || { MIN_SPEED: 0.1, MAX_SPEED: 10000, STEP: 0.1, DEFAULT_SPEED: 1000 };
  range.min = config.MIN_SPEED.toString();
  range.max = config.MAX_SPEED.toString();
  range.step = config.STEP.toString();
  range.value = speedMultiplier.toString();
  range.style.width = '100%';
  range.style.marginBottom = '8px';
  range.disabled = false; // Start enabled since we default to custom speed
  speedSection.appendChild(range);

  // Quick speed buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '4px';
  buttonContainer.style.marginTop = '6px';
  
  const quickSpeeds = [0.1, 1, 10, 100, 1000, 5000];
  quickSpeeds.forEach(speed => {
    const btn = document.createElement('button');
    btn.textContent = `${speed}×`;
    btn.style.flex = '1';
    btn.style.padding = '4px 2px';
    btn.style.fontSize = '10px';
    btn.style.background = speed === speedMultiplier ? '#4CAF50' : 'rgba(255,255,255,0.1)';
    btn.style.color = 'white';
    btn.style.border = '1px solid rgba(255,255,255,0.3)';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      if (!useRealTime) {
        speedMultiplier = speed;
        range.value = speed.toString();
        rangeLabel.textContent = `Speed: ${speedMultiplier.toFixed(1)}×`;
        
        // Update button styles
        buttonContainer.querySelectorAll('button').forEach(b => {
          b.style.background = 'rgba(255,255,255,0.1)';
        });
        btn.style.background = '#4CAF50';
      }
    };
    buttonContainer.appendChild(btn);
  });
  
  speedSection.appendChild(buttonContainer);
  c.appendChild(speedSection);

  // Event listeners
  chk.addEventListener('change', () => {
    useRealTime = chk.checked;
    if (useRealTime) {
      speedMultiplier = 1.0;
      range.disabled = true;
      rangeLabel.textContent = 'Speed: 1.0× (Real-time)';
      rangeLabel.style.color = '#FF9800';
      buttonContainer.style.opacity = '0.5';
      buttonContainer.querySelectorAll('button').forEach(b => {
        b.disabled = true;
        b.style.background = 'rgba(255,255,255,0.1)';
      });
    } else {
      range.disabled = false;
      speedMultiplier = parseFloat(range.value) || config.DEFAULT_SPEED;
      rangeLabel.textContent = `Speed: ${speedMultiplier.toFixed(1)}×`;
      rangeLabel.style.color = '#4CAF50';
      buttonContainer.style.opacity = '1';
      buttonContainer.querySelectorAll('button').forEach(b => {
        b.disabled = false;
      });
      // Highlight current speed button
      buttonContainer.querySelectorAll('button').forEach(b => {
        const btnSpeed = parseFloat(b.textContent.replace('×', ''));
        b.style.background = btnSpeed === speedMultiplier ? '#4CAF50' : 'rgba(255,255,255,0.1)';
      });
    }
  });

  range.addEventListener('input', () => {
    if (!useRealTime) {
      speedMultiplier = parseFloat(range.value) || config.DEFAULT_SPEED;
      rangeLabel.textContent = `Speed: ${speedMultiplier.toFixed(1)}×`;
      
      // Update button highlights
      buttonContainer.querySelectorAll('button').forEach(b => {
        const btnSpeed = parseFloat(b.textContent.replace('×', ''));
        b.style.background = Math.abs(btnSpeed - speedMultiplier) < 0.1 ? '#4CAF50' : 'rgba(255,255,255,0.1)';
      });
    }
  });

  document.body.appendChild(c);
}

createControls();

// --- Year slider UI ---
let selectedYear = new Date().getFullYear();
const minYear = 2023;
const maxYear = 2035;

function createYearSlider() {
  const sliderContainer = document.createElement('div');
  sliderContainer.style.position = 'absolute';
  sliderContainer.style.left = '50%';
  sliderContainer.style.bottom = '24px';
  sliderContainer.style.transform = 'translateX(-50%)';
  sliderContainer.style.background = 'rgba(0,0,0,0.6)';
  sliderContainer.style.color = 'white';
  sliderContainer.style.padding = '8px 16px';
  sliderContainer.style.borderRadius = '8px';
  sliderContainer.style.zIndex = 30;
  sliderContainer.style.fontSize = '16px';
  sliderContainer.style.display = 'flex';
  sliderContainer.style.alignItems = 'center';
  sliderContainer.style.gap = '10px';

  const label = document.createElement('span');
  label.textContent = 'Year:';
  sliderContainer.appendChild(label);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = minYear;
  slider.max = maxYear;
  slider.value = selectedYear;
  slider.step = 1;
  slider.style.width = '200px';
  sliderContainer.appendChild(slider);

  const yearValue = document.createElement('span');
  yearValue.textContent = selectedYear;
  sliderContainer.appendChild(yearValue);

  slider.addEventListener('input', () => {
    selectedYear = parseInt(slider.value);
    yearValue.textContent = selectedYear;
    console.log('Year slider changed to:', selectedYear);
    
    // Update visualization for the selected year
    updateDataForYear(selectedYear);
    
    // Update AI explanation if there's a current city selected
    if (window.currentSelectedCity) {
      updateAIExplanationForYear(window.currentSelectedCity.name, window.currentSelectedCity.baseAqi, selectedYear);
    }
  });

  document.body.appendChild(sliderContainer);
}

createYearSlider();

// Initialize with current year data
setTimeout(() => {
  updateDataForYear(selectedYear);
}, 1000);

// --- Year-based data update logic ---
async function updateDataForYear(year) {
  console.log('Updating data for year:', year);
  // If you have a prediction API or file, fetch it here using the year
  // For now, fallback to live data or mock
  if (window.CarbonEmissionModel && window.CarbonEmissionModel.prototype.fetchYearData) {
    console.log('Found CarbonEmissionModel with fetchYearData method');
    try {
      const model = new window.CarbonEmissionModel();
      console.log('Created model instance');
      const data = await model.fetchYearData(year);
      console.log('Fetched year data:', data);
      const hotspots = model.getHotspots();
      console.log('Got hotspots:', hotspots);
      updateHotspots(hotspots);
    } catch (e) {
      console.error('Year data update failed:', e);
    }
  } else {
    console.log('No fetchYearData method found, using live data');
    // fallback: just use live data (current year)
    updateData();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(); // seconds since last frame

  // advance earth's absolute rotation (real-world sidereal by default)
  const multiplier = useRealTime ? 1.0 : speedMultiplier;
  earthRotation += siderealAngularSpeed * delta * multiplier;

  // apply rotation + user offsets
  earthMesh.rotation.y = earthRotation + userRotY;
  earthMesh.rotation.x = userRotX; // allow pitching via drag

  // clouds drift slightly faster than surface (visual effect)
  cloudsMesh.rotation.y = earthRotation * 1.15 + userRotY;
  cloudsMesh.rotation.x = userRotX;

  renderer.render(scene, camera);
}
animate();

// ---- Window resize ----
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---- Example hook to plug your model in (kept minimal) ----
// If you keep carbonModel.js, you can continue to call it here.
async function updateData() {
  if (!window.CarbonEmissionModel) return;
  try {
    const model = new window.CarbonEmissionModel();
    const data = await model.fetchLiveData();
    const hotspots = model.getHotspots();
    updateHotspots(hotspots);
  } catch (e) {
    console.warn('Data update failed:', e);
  }
}

// Refresh every 5 minutes
setInterval(updateData, 5 * 60 * 1000);
updateData();

} // Close initScene function


// --- City Search Bar Logic ---
function setupCitySearchBar() {
  console.log('setupCitySearchBar called');
  const input = document.getElementById('city-search-input');
  const btn = document.getElementById('city-search-btn');
  const resultDiv = document.getElementById('search-result-info');
  console.log('Search elements found:', !!input, !!btn, !!resultDiv);
  if (!input || !btn) {
    console.error('Search elements not found!');
    return;
  }

  function getApiUrl(cityName) {
    const token = '124e54109c32be405509436460da5957750685e2';
    // Try direct API first, then fallback to CORS proxy if needed
    return `https://api.waqi.info/feed/${encodeURIComponent(cityName)}/?token=${token}`;
  }

  async function searchCity(cityName) {
    if (!cityName) return;
    console.log('Searching for city:', cityName);
    // Wait for globe to be ready
    if (!window.hotspotGroup || typeof createHotspot !== 'function') {
      resultDiv.textContent = 'Please wait for the globe to finish loading.';
      resultDiv.style.display = 'block';
      return;
    }
    resultDiv.style.display = 'none';
    resultDiv.textContent = 'Searching...';
    resultDiv.style.display = 'block';
    let url = getApiUrl(cityName);
    console.log('API URL:', url);
    let res, data;
    
    try {
      // Try direct API first
      res = await fetch(url);
      console.log('Direct API response:', res.status, res.statusText);
      
      if (!res.ok && res.status === 0) {
        // CORS issue, try with proxy
        console.log('CORS issue detected, trying with proxy...');
        const token = '124e54109c32be405509436460da5957750685e2';
        const directUrl = `https://api.waqi.info/feed/${encodeURIComponent(cityName)}/?token=${token}`;
        url = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
        console.log('Proxy URL:', url);
        res = await fetch(url);
        console.log('Proxy API response:', res.status, res.statusText);
      }
      
      data = await res.json();
      console.log('API response data:', data);
      if (data.status === 'ok') {
        const aqi = Number(data.data.aqi);
        const lat = data.data.city.geo[0];
        const lng = data.data.city.geo[1];
        
        // Use the same color and size system as the main visualization
        let color, sizeMultiplier, colorHex;
        
        if (aqi <= 50) {
          color = new THREE.Color(0.2, 0.8, 0.2);
          sizeMultiplier = 0.3;
          colorHex = '#33cc33';
        } else if (aqi <= 100) {
          color = new THREE.Color(1.0, 0.6, 0.1);
          sizeMultiplier = 0.6;
          colorHex = '#ff9933';
        } else {
          color = new THREE.Color(0.6, 0.05, 0.05);
          sizeMultiplier = 1.0;
          colorHex = '#b71c1c';
        }
        
        // Info
        resultDiv.innerHTML = `<b>${data.data.city.name}</b><br>AQI: <span style='color:${colorHex}'>${aqi}</span><br>Lat: ${lat}, Lng: ${lng}`;
        resultDiv.style.display = 'block';
        
        // Store current selected city for year updates
        window.currentSelectedCity = {
          name: data.data.city.name,
          baseAqi: aqi,
          coordinates: { lat, lng }
        };
        
        // Show AI explanation
        showAIExplanation(aqi, data.data.city.name);
        
        // Add a temporary hotspot for the searched city
        if (window.hotspotGroup) {
          // Remove previous search marker if any
          if (window.__searchHotspot) {
            window.hotspotGroup.remove(window.__searchHotspot);
            window.__searchHotspot = null;
          }
          // Create marker with consistent styling
          const marker = createHotspot({lat, lng}, sizeMultiplier, color);
          
          // Determine AQI category
          let aqiCategory;
          if (aqi <= 50) {
            aqiCategory = 'Good';
          } else if (aqi <= 100) {
            aqiCategory = 'Moderate';
          } else {
            aqiCategory = 'Unhealthy';
          }
          
          marker.userData.cityData = {
            name: data.data.city.name,
            aqi: aqi,
            category: aqiCategory,
            coordinates: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
            info: `Live AQI: ${aqi} (${aqiCategory})`
          };
          window.hotspotGroup.add(marker);
          window.__searchHotspot = marker;
        }
      } else {
        resultDiv.textContent = 'City not found or no AQI data.';
        resultDiv.style.display = 'block';
      }
    } catch (e) {
      console.error('Search error:', e);
      resultDiv.textContent = 'Error fetching data: ' + e.message;
      resultDiv.style.display = 'block';
    }
  }

  // Add a test function for known cities
  function searchKnownCity(cityName) {
    const knownCities = {
      // Original cities
      'london': { lat: 51.5074, lng: -0.1278, aqi: 45 },
      'beijing': { lat: 39.9042, lng: 116.4074, aqi: 120 },
      'new york': { lat: 40.7128, lng: -74.0060, aqi: 75 },
      'paris': { lat: 48.8566, lng: 2.3522, aqi: 60 },
      'tokyo': { lat: 35.6762, lng: 139.6503, aqi: 50 },
      'delhi': { lat: 28.7041, lng: 77.1025, aqi: 150 },
      'los angeles': { lat: 34.0522, lng: -118.2437, aqi: 85 },
      'mumbai': { lat: 19.0760, lng: 72.8777, aqi: 135 },
      'sydney': { lat: -33.8688, lng: 151.2093, aqi: 25 },
      'cairo': { lat: 30.0444, lng: 31.2357, aqi: 165 },
      'moscow': { lat: 55.7558, lng: 37.6176, aqi: 95 },
      'mexico city': { lat: 19.4326, lng: -99.1332, aqi: 110 },
      'singapore': { lat: 1.3521, lng: 103.8198, aqi: 35 },
      'lahore': { lat: 31.5204, lng: 74.3587, aqi: 180 },
      'stockholm': { lat: 59.3293, lng: 18.0686, aqi: 20 },
      'bangkok': { lat: 13.7563, lng: 100.5018, aqi: 105 },
      'dhaka': { lat: 23.8103, lng: 90.4125, aqi: 190 },
      'vancouver': { lat: 49.2827, lng: -123.1207, aqi: 30 },
      'milan': { lat: 45.4642, lng: 9.1900, aqi: 70 },
      'seoul': { lat: 37.5665, lng: 126.9780, aqi: 80 },
      'jakarta': { lat: -6.2088, lng: 106.8456, aqi: 125 },
      'kathmandu': { lat: 27.7172, lng: 85.3240, aqi: 170 }
    };
    
    const cityData = knownCities[cityName.toLowerCase()];
    if (cityData) {
      console.log('Using known city data for:', cityName);
      
      const aqi = cityData.aqi;
      let color, sizeMultiplier, colorHex;
      
      if (aqi <= 50) {
        color = new THREE.Color(0.2, 0.8, 0.2);
        sizeMultiplier = 0.3;
        colorHex = '#33cc33';
      } else if (aqi <= 100) {
        color = new THREE.Color(1.0, 0.6, 0.1);
        sizeMultiplier = 0.6;
        colorHex = '#ff9933';
      } else {
        color = new THREE.Color(0.6, 0.05, 0.05);
        sizeMultiplier = 1.0;
        colorHex = '#b71c1c';
      }
      
      resultDiv.innerHTML = `<b>${cityName}</b><br>AQI: <span style='color:${colorHex}'>${aqi}</span><br>Lat: ${cityData.lat}, Lng: ${cityData.lng}`;
      resultDiv.style.display = 'block';
      
      // Store current selected city for year updates
      window.currentSelectedCity = {
        name: cityName,
        baseAqi: aqi,
        coordinates: { lat: cityData.lat, lng: cityData.lng }
      };
      
      // Show AI explanation
      showAIExplanation(aqi, cityName);
      
      // Remove previous search marker
      if (window.__searchHotspot) {
        window.hotspotGroup.remove(window.__searchHotspot);
        window.__searchHotspot = null;
      }
      
      // Create marker
      const marker = createHotspot({lat: cityData.lat, lng: cityData.lng}, sizeMultiplier, color);
      
      // Determine AQI category
      let aqiCategory;
      if (aqi <= 50) {
        aqiCategory = 'Good';
      } else if (aqi <= 100) {
        aqiCategory = 'Moderate';
      } else {
        aqiCategory = 'Unhealthy';
      }
      
      marker.userData.cityData = {
        name: cityName,
        aqi: aqi,
        category: aqiCategory,
        coordinates: `${cityData.lat.toFixed(2)}°, ${cityData.lng.toFixed(2)}°`,
        info: `Known city AQI: ${aqi} (${aqiCategory})`
      };
      window.hotspotGroup.add(marker);
      window.__searchHotspot = marker;
      
      return true;
    }
    return false;
  }

  btn.addEventListener('click', () => {
    console.log('Search button clicked');
    const city = input.value.trim();
    console.log('City entered:', city);
    if (city) {
      // Try known cities first, then API
      if (!searchKnownCity(city)) {
        searchCity(city);
      }
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      console.log('Enter key pressed in search');
      const city = input.value.trim();
      console.log('City entered:', city);
      if (city) {
        // Try known cities first, then API
        if (!searchKnownCity(city)) {
          searchCity(city);
        }
      }
    }
  });
  console.log('Search bar event listeners added');
}

// City Image Handling with specific city mappings
function getCityImageUrl(cityName) {
  const cityLower = cityName.toLowerCase();
  
  // Predefined specific images for major cities for accuracy
  const specificCityImages = {
    'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=300&fit=crop',
    'paris': 'https://images.unsplash.com/photo-1502602898536-47ad22581b52?w=400&h=300&fit=crop',
    'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&h=300&fit=crop',
    'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
    'beijing': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    'delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=300&fit=crop',
    'mumbai': 'https://images.unsplash.com/photo-1595659074391-2d41bbcfcc5e?w=400&h=300&fit=crop',
    'sydney': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    'los angeles': 'https://images.unsplash.com/photo-1515896769750-31548aa180ed?w=400&h=300&fit=crop',
    'moscow': 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=400&h=300&fit=crop',
    'cairo': 'https://images.unsplash.com/photo-1539650116574-75c0c6d73400?w=400&h=300&fit=crop',
    'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&h=300&fit=crop',
    'bangkok': 'https://images.unsplash.com/photo-1519541312645-4aed5736bea3?w=400&h=300&fit=crop',
    'seoul': 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=300&fit=crop',
    'jakarta': 'https://images.unsplash.com/photo-1555899434-94d1454febf7?w=400&h=300&fit=crop',
    'mexico city': 'https://images.unsplash.com/photo-1583571493329-0ba8c86de4b1?w=400&h=300&fit=crop',
    'lahore': 'https://images.unsplash.com/photo-1578091675973-b1f4db1e9e26?w=400&h=300&fit=crop',
    'dhaka': 'https://images.unsplash.com/photo-1539020699717-72eabceed3db?w=400&h=300&fit=crop',
    'kathmandu': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop',
    'stockholm': 'https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=400&h=300&fit=crop',
    'vancouver': 'https://images.unsplash.com/photo-1549068106-48ebcf2dd7b7?w=400&h=300&fit=crop',
    'milan': 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=400&h=300&fit=crop'
  };
  
  // Check if we have a specific image for this city
  if (specificCityImages[cityLower]) {
    return specificCityImages[cityLower];
  }
  
  // For other cities, use targeted Unsplash searches
  const searchTerms = [
    `${encodeURIComponent(cityName)}+landmark`,
    `${encodeURIComponent(cityName)}+skyline`,
    `${encodeURIComponent(cityName)}+city+center`,
    `${encodeURIComponent(cityName)}+downtown`,
    `${encodeURIComponent(cityName)}+architecture`
  ];
  
  // Use the first search term initially
  return `https://source.unsplash.com/400x300/${searchTerms[0]}`;
}

let imageRetryCount = new Map();

// Preload popular city images for better performance
function preloadCityImages() {
  const popularCities = ['london', 'paris', 'new york', 'tokyo', 'beijing'];
  popularCities.forEach(city => {
    const img = new Image();
    img.src = getCityImageUrl(city);
  });
}

// Call preload after page loads
window.addEventListener('load', () => {
  setTimeout(preloadCityImages, 2000); // Preload after 2 seconds
});

function handleImageError(img, cityName) {
  const currentRetries = imageRetryCount.get(cityName) || 0;
  
  if (currentRetries < 5) { // Try up to 5 different sources
    imageRetryCount.set(cityName, currentRetries + 1);
    
    const searchTerms = [
      `${encodeURIComponent(cityName)}+landmark`,
      `${encodeURIComponent(cityName)}+skyline`,
      `${encodeURIComponent(cityName)}+city+center`,
      `${encodeURIComponent(cityName)}+downtown`,
      `${encodeURIComponent(cityName)}+architecture`,
      `https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop` // Generic city fallback
    ];
    
    setTimeout(() => {
      if (currentRetries < 5) {
        img.src = `https://source.unsplash.com/400x300/${searchTerms[currentRetries + 1]}`;
      } else {
        img.src = searchTerms[5]; // Use generic city image
      }
    }, 500);
  } else {
    // All sources failed, show fallback
    img.style.display = 'none';
    if (img.nextElementSibling) {
      img.nextElementSibling.style.display = 'flex';
    }
    imageRetryCount.delete(cityName);
  }
}

// AQI Prediction System
function predictAQIForYear(baseAqi, cityName, targetYear) {
  const currentYear = new Date().getFullYear();
  const yearDiff = targetYear - currentYear;
  
  // City-specific factors
  const cityFactors = {
    'beijing': { trend: -2, volatility: 0.3, baseline: 'high' },
    'delhi': { trend: -1.5, volatility: 0.4, baseline: 'very_high' },
    'mumbai': { trend: -1, volatility: 0.3, baseline: 'high' },
    'lahore': { trend: -0.5, volatility: 0.5, baseline: 'very_high' },
    'dhaka': { trend: -0.8, volatility: 0.4, baseline: 'very_high' },
    'cairo': { trend: -1.2, volatility: 0.3, baseline: 'high' },
    'jakarta': { trend: -0.7, volatility: 0.3, baseline: 'moderate' },
    'mexico city': { trend: -1.8, volatility: 0.2, baseline: 'moderate' },
    'bangkok': { trend: -1, volatility: 0.3, baseline: 'moderate' },
    'seoul': { trend: -2.5, volatility: 0.2, baseline: 'moderate' },
    'london': { trend: -0.5, volatility: 0.1, baseline: 'low' },
    'paris': { trend: -0.8, volatility: 0.15, baseline: 'low' },
    'new york': { trend: -1, volatility: 0.2, baseline: 'moderate' },
    'tokyo': { trend: -1.5, volatility: 0.15, baseline: 'moderate' },
    'sydney': { trend: -0.3, volatility: 0.1, baseline: 'low' },
    'singapore': { trend: -0.5, volatility: 0.2, baseline: 'low' },
    'stockholm': { trend: -0.2, volatility: 0.1, baseline: 'very_low' },
    'vancouver': { trend: -0.3, volatility: 0.15, baseline: 'low' },
    'moscow': { trend: -1.2, volatility: 0.25, baseline: 'moderate' },
    'milan': { trend: -1.5, volatility: 0.2, baseline: 'moderate' },
    'los angeles': { trend: -2, volatility: 0.25, baseline: 'moderate' }
  };
  
  const cityKey = cityName.toLowerCase();
  const factors = cityFactors[cityKey] || { trend: -0.8, volatility: 0.3, baseline: 'moderate' };
  
  // Calculate predicted AQI
  let predictedAqi = baseAqi + (yearDiff * factors.trend);
  
  // Add some realistic variation
  const variation = Math.sin(yearDiff * 0.5) * factors.volatility * baseAqi * 0.1;
  predictedAqi += variation;
  
  // Ensure realistic bounds
  predictedAqi = Math.max(5, Math.min(500, Math.round(predictedAqi)));
  
  return {
    aqi: predictedAqi,
    factors: factors,
    yearDiff: yearDiff,
    isCurrentYear: yearDiff === 0
  };
}

function generateYearReasoning(predictedData, cityName, targetYear) {
  const { yearDiff, isCurrentYear } = predictedData;
  
  if (isCurrentYear) {
    return "Current year data based on live measurements and real-time monitoring stations.";
  }
  
  const cityKey = cityName.toLowerCase();
  let reasoning = "";
  
  if (yearDiff > 0) { // Future prediction
    reasoning = `**${targetYear} Prediction Analysis:**\n`;
    
    if (cityKey.includes('beijing') || cityKey.includes('delhi') || cityKey.includes('mumbai')) {
      reasoning += `• **Policy Impact**: Government air quality initiatives and industrial regulations expected to reduce emissions\n`;
      reasoning += `• **Technology**: Increased adoption of electric vehicles and renewable energy sources\n`;
      reasoning += `• **Urban Planning**: Smart city developments and green infrastructure improvements\n`;
    } else if (cityKey.includes('london') || cityKey.includes('paris') || cityKey.includes('stockholm')) {
      reasoning += `• **Climate Goals**: EU carbon neutrality targets driving cleaner air policies\n`;
      reasoning += `• **Transport**: Expansion of public transit and electric vehicle infrastructure\n`;
      reasoning += `• **Energy**: Continued shift away from fossil fuels toward renewables\n`;
    } else {
      reasoning += `• **Global Trends**: Worldwide shift toward cleaner energy and stricter emissions standards\n`;
      reasoning += `• **Technology Adoption**: Electric vehicles and renewable energy becoming more widespread\n`;
      reasoning += `• **Policy Evolution**: Strengthening environmental regulations and air quality monitoring\n`;
    }
  } else { // Historical data
    reasoning = `**${targetYear} Historical Context:**\n`;
    reasoning += `• **Industrial Period**: Based on historical emissions patterns and industrial activity\n`;
    reasoning += `• **Regulatory Environment**: Air quality standards and enforcement levels of that era\n`;
    reasoning += `• **Technology**: Transportation and energy infrastructure available at the time\n`;
    reasoning += `• **Urban Development**: City planning and population density factors from ${targetYear}\n`;
  }
  
  return reasoning;
}

function updateAIExplanationForYear(cityName, baseAqi, targetYear) {
  const aiContainer = document.getElementById('ai-explanation-container');
  const aiContent = document.getElementById('ai-explanation-content');
  
  if (!aiContainer || !aiContent) return;
  
  // Show loading
  aiContent.innerHTML = `
    <div class="loading-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  
  setTimeout(() => {
    const prediction = predictAQIForYear(baseAqi, cityName, targetYear);
    const reasoning = generateYearReasoning(prediction, cityName, targetYear);
    const explanation = generateAQIExplanation(prediction.aqi, cityName, targetYear, reasoning, prediction.isCurrentYear);
    aiContent.innerHTML = explanation;
  }, 800);
}

// AI Explanation System
function showAIExplanation(aqi, cityName) {
  const aiContainer = document.getElementById('ai-explanation-container');
  const aiContent = document.getElementById('ai-explanation-content');
  
  if (!aiContainer || !aiContent) return;
  
  // Show container with loading animation
  aiContainer.style.display = 'block';
  aiContent.innerHTML = `
    <div class="loading-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  
  // Simulate AI processing delay
  setTimeout(() => {
    const currentYear = new Date().getFullYear();
    const explanation = generateAQIExplanation(aqi, cityName, selectedYear || currentYear, null, true);
    aiContent.innerHTML = explanation;
  }, 1500);
}

function generateAQIExplanation(aqi, cityName, year = new Date().getFullYear(), customReasoning = null, isCurrentYear = true) {
  let level, levelClass, healthEffects, recommendations, description, envCauses;
  const currentYear = new Date().getFullYear();
  
  if (aqi <= 50) {
    level = "Good";
    levelClass = "aqi-good";
    description = "Air quality is considered satisfactory, and air pollution poses little or no risk.";
    healthEffects = "Air quality is acceptable for most people. Enjoy outdoor activities!";
    recommendations = "Perfect time for outdoor exercises, jogging, and recreational activities.";
    envCauses = "Favorable weather conditions, effective emission controls, and natural air circulation are maintaining clean air.";
  } else if (aqi <= 100) {
    level = "Moderate";
    levelClass = "aqi-moderate";
    description = "Air quality is acceptable; however, there may be a concern for some sensitive individuals.";
    healthEffects = "Unusually sensitive people may experience minor breathing discomfort.";
    recommendations = "Sensitive individuals should consider reducing prolonged outdoor exertion.";
    envCauses = "Contributing factors may include vehicle emissions, industrial activities, seasonal weather patterns, or dust from construction sites.";
  } else if (aqi <= 150) {
    level = "Unhealthy for Sensitive Groups";
    levelClass = "aqi-unhealthy";
    description = "Members of sensitive groups may experience health effects.";
    healthEffects = "People with heart/lung disease, older adults, and children may experience symptoms.";
    recommendations = "Sensitive groups should avoid outdoor activities. Others should limit prolonged outdoor exertion.";
    envCauses = "Likely caused by increased traffic congestion, industrial pollution, power plant emissions, wildfires, or unfavorable weather conditions trapping pollutants.";
  } else if (aqi <= 200) {
    level = "Unhealthy";
    levelClass = "aqi-unhealthy";
    description = "Everyone may begin to experience health effects.";
    healthEffects = "Increased likelihood of respiratory symptoms and breathing difficulties for everyone.";
    recommendations = "Everyone should avoid outdoor activities. Stay indoors and use air purifiers if available.";
    envCauses = "Major contributors include heavy industrial emissions, fossil fuel burning, vehicle exhaust, agricultural burning, or severe weather inversions preventing pollutant dispersion.";
  } else {
    level = "Very Unhealthy to Hazardous";
    levelClass = "aqi-unhealthy";
    description = "Health alert: everyone may experience serious health effects.";
    healthEffects = "Serious risk of respiratory effects and premature mortality for all populations.";
    recommendations = "Everyone should avoid all outdoor activities. Emergency conditions - stay indoors with windows closed.";
    envCauses = "Critical pollution sources: massive industrial emissions, large-scale fires, extreme weather events, coal burning, uncontrolled vehicle emissions, or atmospheric conditions creating pollution domes.";
  }
  
  // Year-based content
  const yearPrefix = year === currentYear ? "currently has" : 
                    year > currentYear ? `projected to have in ${year}` : 
                    `had in ${year}`;
  
  const dataType = year === currentYear ? "📊 Live Data" : 
                  year > currentYear ? "🔮 AI Prediction" : 
                  "📚 Historical Estimate";

  return `
    <div class="aqi-explanation">
      <div class="city-header">
        <div class="city-image-container">
          <img src="${getCityImageUrl(cityName)}" 
               alt="${cityName} cityscape" 
               class="city-image"
               onload="this.style.opacity='1'; this.nextElementSibling.querySelector('.loading-spinner').style.display='none';"
               onerror="handleImageError(this, '${cityName}')">
          <div class="city-image-fallback">
            <div class="loading-spinner">📸</div>
            <div class="city-icon">🏙️</div>
            <div class="city-name">${cityName}</div>
          </div>
        </div>
        <div class="city-info">
          <div class="year-indicator">${dataType} - ${year}</div>
          <div class="aqi-level ${levelClass}">AQI ${aqi} - ${level}</div>
          <p><strong>${cityName}</strong> ${yearPrefix} ${level.toLowerCase()} air quality.</p>
        </div>
      </div>
      <p>${description}</p>
    </div>
    
    ${customReasoning ? `
    <div class="prediction-reasoning">
      <strong>🧠 AI Analysis:</strong><br>
      ${customReasoning.replace(/\n/g, '<br>')}
    </div>
    ` : ''}
    
    <div class="environmental-causes">
      <strong>🌍 Environmental Causes:</strong><br>
      ${envCauses}
    </div>
    
    <div class="health-effects">
      <strong>🏥 Health Effects:</strong><br>
      ${healthEffects}
    </div>
    
    <div class="recommendations">
      <strong>💡 Recommendations:</strong><br>
      ${recommendations}
    </div>
    
    <div style="margin-top: 12px; font-size: 11px; color: #64748b; text-align: center;">
      Generated by Dedalus AI • ${year === currentYear ? 'Based on WHO guidelines' : `${year > currentYear ? 'Predictive' : 'Historical'} analysis`}
    </div>
  `;
}

// Wait for DOM and globe to be ready before enabling search
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up search bar...');
  const input = document.getElementById('city-search-input');
  const btn = document.getElementById('city-search-btn');
  console.log('Found search elements:', !!input, !!btn);
  
  // Wait for Three.js globe to be initialized
  let attempts = 0;
  const maxAttempts = 30; // 3 seconds max wait
  
  function waitForGlobe() {
    attempts++;
    if (window.globeReady && window.hotspotGroup && window.createHotspot) {
      console.log('Globe ready, setting up search bar');
      setupCitySearchBar();
    } else if (attempts < maxAttempts) {
      if (attempts % 10 === 0) { // Only log every 10th attempt to reduce spam
        console.log(`Globe not ready yet (attempt ${attempts}/${maxAttempts})`);
      }
      setTimeout(waitForGlobe, 100);
    } else {
      console.log('Setting up search bar anyway after timeout');
      setupCitySearchBar();
    }
  }
  
  // Small delay to ensure createHotspot is available
  setTimeout(waitForGlobe, 500);
});
