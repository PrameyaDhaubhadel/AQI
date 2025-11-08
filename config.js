// Configuration file for API keys and settings
// This file loads environment variables for the browser

class Config {
  constructor() {
    // In a real production environment, these would be loaded from environment variables
    // For client-side applications, you might want to use a build tool like Webpack or Vite
    // to inject environment variables at build time
    
    this.WAQI_TOKEN = this.getEnvVar('WAQI_TOKEN', '124e54109c32be405509436460da5957750685e2');
    this.DEDALUS_API_KEY = this.getEnvVar('DEDALUS_API_KEY', 'dsk_live_5588588647d1_29e6a46c01644069bf9c3f3603e53757');
    this.DEDALUS_BASE_URL = this.getEnvVar('DEDALUS_BASE_URL', 'https://api.dedaluslab.ai/v1/predict');
    this.WAQI_BASE_URL = this.getEnvVar('WAQI_BASE_URL', 'https://api.waqi.info/feed');
    this.DEFAULT_YEAR = parseInt(this.getEnvVar('DEFAULT_YEAR', '2025'));
    this.MAX_PREDICTION_YEAR = parseInt(this.getEnvVar('MAX_PREDICTION_YEAR', '2035'));
    this.MIN_PREDICTION_YEAR = parseInt(this.getEnvVar('MIN_PREDICTION_YEAR', '2023'));
  }

  getEnvVar(key, defaultValue) {
    // In browser environment, we can't directly access process.env
    // This would typically be handled by a build tool (Webpack, Vite, etc.)
    
    // For development, check if there's a global config
    if (window.ENV_CONFIG && window.ENV_CONFIG[key]) {
      return window.ENV_CONFIG[key];
    }
    
    // Fallback to default value
    return defaultValue;
  }

  // Method to validate that required environment variables are set
  validateConfig() {
    const requiredVars = ['WAQI_TOKEN', 'DEDALUS_API_KEY'];
    const missing = [];
    
    requiredVars.forEach(varName => {
      if (!this[varName] || this[varName] === '') {
        missing.push(varName);
      }
    });
    
    if (missing.length > 0) {
      console.warn('Missing required environment variables:', missing);
      return false;
    }
    
    return true;
  }

  // Method to get configuration for external display (without sensitive data)
  getPublicConfig() {
    return {
      DEDALUS_BASE_URL: this.DEDALUS_BASE_URL,
      WAQI_BASE_URL: this.WAQI_BASE_URL,
      DEFAULT_YEAR: this.DEFAULT_YEAR,
      MAX_PREDICTION_YEAR: this.MAX_PREDICTION_YEAR,
      MIN_PREDICTION_YEAR: this.MIN_PREDICTION_YEAR,
      hasWAQIToken: !!this.WAQI_TOKEN,
      hasDedalusKey: !!this.DEDALUS_API_KEY
    };
  }
}

// Export configuration instance
window.AppConfig = new Config();

// Validate configuration on load
if (!window.AppConfig.validateConfig()) {
  console.error('Configuration validation failed. Some features may not work properly.');
}