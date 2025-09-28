# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common Development Commands

### Local Development
```bash
# Serve the application locally (any simple HTTP server)
python -m http.server 8000
# Or using Node.js
npx serve .
# Or using PHP
php -S localhost:8000

# Open in browser
start http://localhost:8000  # Windows
open http://localhost:8000   # macOS
```

### Testing
```bash
# Open index.html directly in browser for quick testing
start index.html  # Windows
open index.html   # macOS
```

### Data Management
```bash
# Validate JSON data structure
python -m json.tool data/petrol_pumps.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"

# Format JSON data
python -m json.tool data/petrol_pumps.json > temp.json && move temp.json data/petrol_pumps.json  # Windows
python -m json.tool data/petrol_pumps.json > temp.json && mv temp.json data/petrol_pumps.json    # macOS/Linux
```

## Architecture Overview

### Application Structure
This is a client-side web application built with vanilla JavaScript, HTML5, and CSS3. The architecture follows a simple single-page application (SPA) pattern:

- **Frontend**: Vanilla JavaScript with ES6 classes
- **Map Integration**: Leaflet.js for interactive mapping
- **Data Storage**: Static JSON file for fuel station data
- **Styling**: Custom CSS with responsive design

### Core Components

#### FuelFinder Class (`src/app.js`)
The main application class that orchestrates all functionality:
- **Map Management**: Initializes and manages Leaflet map instance
- **Geolocation**: Handles user location detection and permission requests
- **Distance Calculation**: Implements Haversine formula for calculating distances between coordinates
- **Data Processing**: Loads and filters fuel station data from JSON
- **UI Updates**: Manages DOM manipulation for displaying results

#### Key Methods:
- `init()`: Application initialization sequence
- `getUserLocation()`: Geolocation API integration with error handling
- `findNearestStation()`: Distance-based station sorting and nearest station identification
- `filterByHighway()`: Highway-specific filtering functionality
- `displayStations()`: Dynamic UI rendering with distance sorting

#### Data Structure (`data/petrol_pumps.json`)
Each fuel station contains:
- **id**: Unique identifier (brand prefix + number)
- **name**: Station name and brand
- **highway**: National Highway designation (NH44, NH48, etc.)
- **location**: Human-readable address
- **latitude/longitude**: GPS coordinates for mapping
- **hours**: Operating hours (24/7 or specific times)
- **services**: Array of available services (fuel types, amenities)

### State Management
The application maintains state through class properties:
- `userLocation`: Current user coordinates
- `stations`: Complete fuel station dataset
- `markers`: Map marker references for cleanup
- `map`: Leaflet map instance

### Geographic Coverage
Focuses on major National Highways:
- **NH44**: Chennai - Srinagar (longest highway)
- **NH48**: Chennai - Delhi 
- **NH27**: Porbandar - Silchar
- **NH16**: Chennai - Nizamabad
- **NH66**: Mumbai - Kanyakumari (coastal route)

### Browser Compatibility
- Requires Geolocation API support
- Uses modern JavaScript features (ES6 classes, async/await)
- CSS Grid and Flexbox for layout
- Responsive design with mobile breakpoints at 768px and 480px

### External Dependencies
- **Leaflet.js 1.9.4**: Loaded from CDN for mapping functionality
- **OpenStreetMap**: Tile layer provider for base maps
- No build process required - runs directly in browser

### Performance Considerations
- Lazy marker creation (only when needed)
- Efficient distance calculation with Haversine formula
- Marker cleanup to prevent memory leaks
- Responsive image loading and CSS optimization

## Development Guidelines

### Adding New Stations
1. Add entries to `data/petrol_pumps.json` following the existing schema
2. Ensure latitude/longitude coordinates are accurate
3. Use consistent naming conventions for highways (NH + number)
4. Include comprehensive service arrays for filtering

### Modifying Map Behavior
- Map initialization occurs in `initMap()` method
- Custom markers and popups are handled in `addStationMarkers()`
- User location marker styling defined in `showUserOnMap()`

### Extending Highway Coverage
- Update highway filter options in `index.html` select element
- Add corresponding filter logic in `filterByHighway()` method
- Ensure data includes new highway designations

### CSS Styling Patterns
- Uses CSS custom properties for consistent theming
- Gradient backgrounds for primary elements (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
- Component-based class naming (`.station-item`, `.service-tag`)
- Mobile-first responsive design approach