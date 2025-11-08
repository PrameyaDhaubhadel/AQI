# 🌍 Global Air Quality Index (AQI) Visualization

An interactive 3D globe visualization showing real-time and predicted Air Quality Index (AQI) data for major cities worldwide, built with Three.js.

![Globe Visualization](https://img.shields.io/badge/Three.js-Interactive-blue)
![Status](https://img.shields.io/badge/Status-Active-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🎯 Core Functionality
- **Interactive 3D Earth Globe** with realistic textures and starfield background
- **Real-time AQI Data** from World Air Quality Index API
- **Future Predictions** with year slider (2023-2035)
- **City Search** functionality for quick location lookup
- **Hover Tooltips** showing detailed city information

### 🎨 Visual Design
- **3-Category Color System**: Red shades indicating AQI levels
  - 🟢 Good (0-50): Light red, small markers
  - 🟡 Moderate (51-100): Dark red, medium markers  
  - 🔴 Unhealthy (100+): Very dark red, large markers
- **Size-based Visualization**: Marker size scales with pollution severity
- **Enhanced Tooltips**: Detailed popup information with city name, AQI value, coordinates, and category

### 🔧 Technical Features
- **Responsive Design** that works on desktop and mobile
- **Smooth Animations** and transitions
- **Error Handling** with fallback data systems
- **Live API Integration** with CORS proxy support
- **Drag-to-rotate** globe interaction

## 🚀 Quick Start

### Prerequisites
- Modern web browser with WebGL support
- Python 3.x (for local development server)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PrameyaDhaubhadel/AQI.git
   cd AQI
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file and add your API keys:
   - Get WAQI token from: https://aqicn.org/data-platform/token/
   - Get Dedalus API key from: https://dedaluslab.ai/

3. **Start local server**
   ```bash
   python -m http.server 8000
   ```

4. **Open in browser**
   ```
   http://localhost:8000
   ```

## 📖 Usage Guide

### 🌐 Globe Interaction
- **Drag** to rotate the globe
- **Hover** over red markers to see city details
- **Scroll** to zoom in/out

### 🔍 Search Functionality
- Enter city name in the search box
- Supported cities: London, Beijing, New York, Paris, Tokyo, Delhi, and more
- Search results appear as temporary markers with detailed information

### 📅 Time Navigation
- Use the **year slider** to see predicted AQI data for future years
- Range: 2023-2035
- Watch how pollution levels change over time

### 💡 Understanding the Data
- **Marker Colors**: Darker red = higher pollution
- **Marker Sizes**: Larger = more severe air quality
- **Tooltip Information**: Shows AQI value, category, coordinates, and prediction details

## 🛠 Technical Architecture

### Core Technologies
- **Three.js r149**: 3D graphics and WebGL rendering
- **World Air Quality Index API**: Real-time pollution data
- **Dedalus Lab API**: Future prediction models (when available)
- **Vanilla JavaScript**: Core application logic
- **CSS3**: Modern styling and responsive design

### File Structure
```
threejs-earth-aqi/
├── index.html          # Main HTML structure
├── main.js             # Core Three.js application
├── carbonModel.js      # Data fetching and API integration
├── style.css           # Styling and responsive design
├── three.js            # Three.js library
├── texture/            # Earth textures and materials
└── README.md           # Project documentation
```

### Data Sources
- **Live AQI Data**: World Air Quality Index API
- **City Coordinates**: Built-in database of major cities
- **Predictions**: Mock data system with realistic trends
- **Textures**: High-resolution Earth surface and bump maps

## 🔧 Configuration

### API Keys
The project uses the following APIs:
- **WAQI Token**: Get your free token from [World Air Quality Index](https://aqicn.org/data-platform/token/)
- **Dedalus Lab API**: Get your API key from [Dedalus Lab](https://dedaluslab.ai/)

⚠️ **Security**: API keys are stored in environment variables (`.env` file) and should never be committed to version control.

### Customization Options
- **Colors**: Modify AQI color schemes in `main.js`
- **Cities**: Add more cities in `carbonModel.js`
- **Time Range**: Adjust prediction years in slider configuration
- **Styling**: Update visual themes in `style.css`

## 🌟 Features in Detail

### AQI Categories
| Category | AQI Range | Color | Health Impact |
|----------|-----------|-------|---------------|
| Good | 0-50 | Light Red | Little to no risk |
| Moderate | 51-100 | Dark Red | Acceptable for most people |
| Unhealthy | 100+ | Very Dark Red | Health warnings |

### Supported Cities
- Beijing, China
- New York, USA
- London, UK
- Paris, France
- Tokyo, Japan
- Delhi, India
- Los Angeles, USA
- Shanghai, China
- Moscow, Russia
- Sydney, Australia

## � Security

### Environment Variables
This project uses environment variables to protect sensitive API keys:

- **`.env`** - Contains your actual API keys (never commit this file)
- **`.env.example`** - Template file showing required variables
- **`config.js`** - Handles loading and validation of environment variables

### Best Practices
- ✅ API keys are stored in `.env` file
- ✅ `.env` is included in `.gitignore`
- ✅ Template file (`.env.example`) is provided for setup
- ✅ Configuration validation on application startup
- ✅ No hardcoded secrets in source code

### Setting Up Your API Keys
1. Copy `.env.example` to `.env`
2. Replace placeholder values with your actual API keys
3. Never commit the `.env` file to version control

## �🐛 Troubleshooting

### Common Issues
1. **Globe not loading**: Check browser WebGL support
2. **No data showing**: Verify API keys in `.env` file and internet connection
3. **Search not working**: Try known cities first
4. **Performance issues**: Close other browser tabs
5. **API errors**: Check that your API keys are valid and not expired

### Browser Support
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### Development Setup
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js Community** for the excellent 3D library
- **World Air Quality Index** for providing free AQI data
- **NASA** for Earth texture resources
- **Open Source Community** for inspiration and support

## 📧 Contact

For questions, suggestions, or collaboration opportunities, please open an issue on GitHub.

---

Made with ❤️ and JavaScript