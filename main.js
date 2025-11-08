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
    opacity: Math.min(1.0, 0.5 + 0.5 * intensity)
  });
  const marker = new THREE.Mesh(markerGeom, markerMat);

  // Glow effect (size scales with intensity)
  const glowGeom = new THREE.SphereGeometry(0.15 + 0.5 * intensity, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: Math.min(0.4, 0.2 + 0.2 * intensity),
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
      // Good (0-50): Medium red, small size
      color = new THREE.Color(0.8, 0.2, 0.2);
      sizeMultiplier = 0.3;
      aqiCategory = 'Good';
    } else if (aqi <= 100) {
      // Moderate (51-100): Dark red, medium size
      color = new THREE.Color(0.6, 0.1, 0.1);
      sizeMultiplier = 0.6;
      aqiCategory = 'Moderate';
    } else {
      // Unhealthy (100+): Very dark red, large size
      color = new THREE.Color(0.4, 0, 0);
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

// Controls for speed (1 = real time). Users may want to speed up for demo.
let speedMultiplier = 1.0;
let useRealTime = true;

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
      let aqiColor = '#cc6666'; // Default medium red
      if (cityData.aqi <= 50) {
        aqiColor = '#cc6666'; // Medium red for good
      } else if (cityData.aqi <= 100) {
        aqiColor = '#991a1a'; // Dark red for moderate
      } else {
        aqiColor = '#660000'; // Very dark red for unhealthy
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
  // small control panel appended to body so we can toggle real/demo speed
  const c = document.createElement('div');
  c.style.position = 'absolute';
  c.style.right = '12px';
  c.style.bottom = '12px';
  c.style.background = 'rgba(0,0,0,0.5)';
  c.style.color = 'white';
  c.style.padding = '8px 10px';
  c.style.borderRadius = '8px';
  c.style.fontSize = '12px';
  c.style.zIndex = 20;

  const label = document.createElement('label');
  label.style.display = 'block';
  label.style.marginBottom = '6px';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = true;
  chk.id = 'realtime-check';
  label.appendChild(chk);
  label.appendChild(document.createTextNode(' Real-time rotation (1x)'));
  c.appendChild(label);

  const rangeLabel = document.createElement('div');
  rangeLabel.style.marginBottom = '4px';
  rangeLabel.textContent = 'Speed multiplier: 1.0×';
  c.appendChild(rangeLabel);

  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0.01';
  range.max = '1000';
  range.step = '0.01';
  range.value = '1';
  range.style.width = '160px';
  range.disabled = true;
  c.appendChild(range);

  chk.addEventListener('change', () => {
    useRealTime = chk.checked;
    if (useRealTime) {
      speedMultiplier = 1.0;
      range.disabled = true;
      rangeLabel.textContent = `Speed multiplier: ${speedMultiplier.toFixed(2)}×`;
    } else {
      range.disabled = false;
      speedMultiplier = parseFloat(range.value) || 1.0;
      rangeLabel.textContent = `Speed multiplier: ${speedMultiplier.toFixed(2)}×`;
    }
  });
  range.addEventListener('input', () => {
    speedMultiplier = parseFloat(range.value) || 1.0;
    rangeLabel.textContent = `Speed multiplier: ${speedMultiplier.toFixed(2)}×`;
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
          color = new THREE.Color(0.8, 0.2, 0.2);
          sizeMultiplier = 0.3;
          colorHex = '#cc3333';
        } else if (aqi <= 100) {
          color = new THREE.Color(0.6, 0.1, 0.1);
          sizeMultiplier = 0.6;
          colorHex = '#991a1a';
        } else {
          color = new THREE.Color(0.4, 0, 0);
          sizeMultiplier = 1.0;
          colorHex = '#660000';
        }
        
        // Info
        resultDiv.innerHTML = `<b>${data.data.city.name}</b><br>AQI: <span style='color:${colorHex}'>${aqi}</span><br>Lat: ${lat}, Lng: ${lng}`;
        resultDiv.style.display = 'block';
        
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
      'london': { lat: 51.5074, lng: -0.1278, aqi: 45 },
      'beijing': { lat: 39.9042, lng: 116.4074, aqi: 120 },
      'new york': { lat: 40.7128, lng: -74.0060, aqi: 75 },
      'paris': { lat: 48.8566, lng: 2.3522, aqi: 60 },
      'tokyo': { lat: 35.6762, lng: 139.6503, aqi: 50 },
      'delhi': { lat: 28.7041, lng: 77.1025, aqi: 150 }
    };
    
    const cityData = knownCities[cityName.toLowerCase()];
    if (cityData) {
      console.log('Using known city data for:', cityName);
      
      const aqi = cityData.aqi;
      let color, sizeMultiplier, colorHex;
      
      if (aqi <= 50) {
        color = new THREE.Color(0.8, 0.2, 0.2);
        sizeMultiplier = 0.3;
        colorHex = '#cc3333';
      } else if (aqi <= 100) {
        color = new THREE.Color(0.6, 0.1, 0.1);
        sizeMultiplier = 0.6;
        colorHex = '#991a1a';
      } else {
        color = new THREE.Color(0.4, 0, 0);
        sizeMultiplier = 1.0;
        colorHex = '#660000';
      }
      
      resultDiv.innerHTML = `<b>${cityName}</b><br>AQI: <span style='color:${colorHex}'>${aqi}</span><br>Lat: ${cityData.lat}, Lng: ${cityData.lng}`;
      resultDiv.style.display = 'block';
      
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
