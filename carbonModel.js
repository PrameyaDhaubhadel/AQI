(function () {
  // World Air Quality Index API configuration
  const WAQI_API_TOKEN = '124e54109c32be405509436460da5957750685e2'; // Replace with your API token from https://aqicn.org/api/
  const WAQI_API_BASE = 'https://api.waqi.info/feed';
  
  let isInitialized = false;
  
  // Dedalus Lab API Configuration
  // TODO: Update this with the correct Dedalus API endpoint when you get it
  const DEDALUS_CONFIG = {
    enabled: true, // Set to false to skip Dedalus API and use only mock data
    apiKey: 'dsk_live_5588588647d1_29e6a46c01644069bf9c3f3603e53757',
    baseUrl: 'https://api.dedaluslab.ai', // Update this with correct base URL
  };
  
  function normalizeAQI(aqi) {
    // AQI ranges: 0-50 (good), 51-100 (moderate), 101-150 (unhealthy for sensitive),
    // 151-200 (unhealthy), 201-300 (very unhealthy), 300+ (hazardous)
    return Math.min(Math.max(aqi, 0), 500) / 500;
  }

  // Use a CORS proxy for development
  const API_URL = 'https://corsproxy.io/?https://api.carbonmonitorcities.org/v1/cities';

  const WAQI_TOKEN = '124e54109c32be405509436460da5957750685e2';
  const POPULAR_CITIES = [
    { name: 'Beijing', query: 'beijing' },
    { name: 'New York', query: 'new york' },
    { name: 'London', query: 'london' },
    { name: 'Paris', query: 'paris' },
    { name: 'Tokyo', query: 'tokyo' },
    { name: 'Delhi', query: 'delhi' },
    { name: 'Los Angeles', query: 'los angeles' },
    { name: 'Shanghai', query: 'shanghai' },
    { name: 'Moscow', query: 'moscow' },
    { name: 'Sydney', query: 'sydney' }
  ];

  class CarbonEmissionModel {
    async fetchYearData(year) {
      try {
        console.log('fetchYearData called with year:', year);
        
        // Try Dedalus API if enabled
        if (DEDALUS_CONFIG.enabled) {
          console.log('Attempting Dedalus API call for year:', year);
          
          // Try different possible Dedalus API endpoints
          const possibleEndpoints = [
            `${DEDALUS_CONFIG.baseUrl}/v1/predict?year=${year}`,
            `${DEDALUS_CONFIG.baseUrl}/api/predict?year=${year}`,
            `${DEDALUS_CONFIG.baseUrl}/predict?year=${year}`,
          ];
          
          // Only try the first endpoint to avoid multiple DNS errors in console
          try {
            const endpoint = possibleEndpoints[0]; // Just try one endpoint
            const res = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${DEDALUS_CONFIG.apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (res.ok) {
              const data = await res.json();
              console.log('✅ Dedalus API successful! Data received:', data);
              // Process Dedalus data
              const pts = (Array.isArray(data) ? data : []).map(city => {
                const aqi = city.aqi || city.predicted_aqi || 0;
                const intensity = Math.max(0, Math.min(1, aqi / 500));
                return {
                  position: { lat: city.lat, lng: city.lng },
                  intensity,
                  name: city.city || city.name,
                  info: `Predicted AQI: ${aqi}\nCity: ${city.city || city.name}\nYear: ${year}`
                };
              });
              this._hotspots = pts;
              return pts;
            }
          } catch (dedalusError) {
            // Silently continue to mock data
          }
          
          console.log('⚠️ Dedalus API not available, using mock predictions');
        } else {
          console.log('Dedalus API disabled, using mock predictions');
        }
        
        // Fallback to mock prediction data
        console.log('Using mock prediction data for year:', year);
        const mockPredictions = this._generateMockPredictions(year);
        this._hotspots = mockPredictions;
        return mockPredictions;
        
      } catch (e) {
        console.warn('Prediction fetch failed:', e);
        this._hotspots = [];
        return [];
      }
    }

    _generateMockPredictions(year) {
      // Generate realistic predictions based on year
      const baseCities = POPULAR_CITIES.map(city => {
        // Simulate different AQI trends based on city and year
        let baseAQI;
        switch(city.name) {
          case 'Beijing': baseAQI = 120; break;
          case 'Delhi': baseAQI = 150; break;
          case 'Los Angeles': baseAQI = 80; break;
          case 'London': baseAQI = 60; break;
          case 'Paris': baseAQI = 70; break;
          case 'Tokyo': baseAQI = 50; break;
          case 'New York': baseAQI = 75; break;
          case 'Shanghai': baseAQI = 110; break;
          case 'Moscow': baseAQI = 85; break;
          case 'Sydney': baseAQI = 45; break;
          default: baseAQI = 70;
        }
        
        // Simulate year-based changes (some cities improving, others worsening)
        const yearOffset = year - 2025;
        let trendMultiplier = 1;
        
        if (['Beijing', 'Delhi'].includes(city.name)) {
          // Polluted cities improving over time
          trendMultiplier = Math.max(0.5, 1 - (yearOffset * 0.03));
        } else if (['London', 'Paris', 'Tokyo'].includes(city.name)) {
          // Clean cities staying relatively stable
          trendMultiplier = 1 + (yearOffset * 0.01);
        } else {
          // Other cities with mixed trends
          trendMultiplier = 1 + (yearOffset * 0.02);
        }
        
        const predictedAQI = Math.round(baseAQI * trendMultiplier);
        const intensity = Math.max(0, Math.min(1, predictedAQI / 500));
        
        return {
          position: { lat: this._getCityCoords(city.name).lat, lng: this._getCityCoords(city.name).lng },
          intensity,
          name: city.name,
          info: `Predicted AQI: ${predictedAQI}\nCity: ${city.name}\nYear: ${year}`
        };
      });
      
      return baseCities;
    }

    _getCityCoords(cityName) {
      const coords = {
        'Beijing': { lat: 39.9042, lng: 116.4074 },
        'New York': { lat: 40.7128, lng: -74.0060 },
        'London': { lat: 51.5074, lng: -0.1278 },
        'Paris': { lat: 48.8566, lng: 2.3522 },
        'Tokyo': { lat: 35.6762, lng: 139.6503 },
        'Delhi': { lat: 28.7041, lng: 77.1025 },
        'Los Angeles': { lat: 34.0522, lng: -118.2437 },
        'Shanghai': { lat: 31.2304, lng: 121.4737 },
        'Moscow': { lat: 55.7558, lng: 37.6173 },
        'Sydney': { lat: -33.8688, lng: 151.2093 }
      };
      return coords[cityName] || { lat: 0, lng: 0 };
    }
    constructor() {
      // Wait for hotspotGroup to be available
      if (!isInitialized && window.hotspotGroup) {
        isInitialized = true;
      }
    }

    async fetchLiveData() {
      try {
        // Fetch all cities in parallel
        const results = await Promise.all(POPULAR_CITIES.map(async city => {
          const url = `https://api.waqi.info/feed/${encodeURIComponent(city.query)}/?token=${WAQI_TOKEN}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === 'ok') {
            const aqi = Number(data.data.aqi);
            const lat = data.data.city.geo[0];
            const lng = data.data.city.geo[1];
            // Use AQI as intensity (normalize: 0-500 AQI to 0-1)
            const intensity = Math.max(0, Math.min(1, aqi / 500));
            return {
              position: { lat, lng },
              intensity,
              name: city.name,
              info: `AQI: ${aqi}\nCity: ${city.name}\nStation: ${data.data.city.name}`
            };
          } else {
            return null;
          }
        }));
        // Filter out failed fetches
        const pts = results.filter(Boolean);
        this._hotspots = pts;
        return pts;
      } catch (e) {
        console.warn('WAQI API fetch failed:', e);
        this._hotspots = [];
        return [];
      }
    }

    getHotspots() {
      return this._hotspots || [];
    }

    
  }

  // Expose globally so main.js can use it
  window.CarbonEmissionModel = CarbonEmissionModel;
})();
