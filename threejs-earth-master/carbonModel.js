// Mock carbon emission hotspots data for fallback

// Function to get emission data - now using local data instead of API
function getEmissionData() {
    return new Promise((resolve) => {
        // Transform the static data into the format needed for hotspots
        const hotspots = staticEmissionData.map(city => ({
            position: {
                lat: city.lat,
                lng: city.lng
            },
            intensity: city.intensity,
            name: city.name,
            emissions: city.emissions
        }));
        
        // Simulate a small delay to make the loading feel more natural
        setTimeout(() => {
            resolve(hotspots);
        }, 500);
    });
}

// Function to initialize carbon emission visualization
async function initializeCarbonEmissions() {
    try {
        // Get emission data from our static dataset
        const emissionData = await getEmissionData();
        
        // Update the visualization with the data
        updateHotspots(emissionData);
        
        console.log('Carbon emission visualization initialized successfully');
    } catch (error) {
        console.error('Error initializing carbon emissions:', error);
    }
}

// Add event listener to initialize carbon emissions when the page loads
window.addEventListener('load', initializeCarbonEmissions);

// CarbonEmissionModel
class CarbonEmissionModel {
    async fetchLiveData() {
      try {
        const API_URL = 'https://api.waqi.info/feed/here/?token=124e54109c32be405509436460da5957750685e2';
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.status === 'ok') {
          const aqi = Number(data.data.aqi);
          const lat = data.data.city.geo[0];
          const lng = data.data.city.geo[1];
          // Use AQI as intensity (normalize: 0-500 AQI to 0-1)
          const intensity = Math.max(0, Math.min(1, aqi / 500));
          const pts = [{
            position: { lat, lng },
            intensity,
            name: data.data.city.name,
            info: `AQI: ${aqi}\nCity: ${data.data.city.name}\nStation: ${data.data.city.name}`
          }];
          this._hotspots = pts;
          return pts;
        } else {
          this._hotspots = [];
          return [];
        }
      } catch (e) {
        console.warn('WAQI API fetch failed:', e);
        this._hotspots = [];
        return [];
      }
    }
}