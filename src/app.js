// NH Fuel Finder - Main JavaScript Application
class FuelFinder {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.stations = [];
        this.markers = [];
        this.userMarker = null;
        
        this.init();
    }
    
    async init() {
        // Initialize map
        this.initMap();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Display all stations initially
        this.displayStations();
    }
    
    initMap() {
        // Initialize Leaflet map centered on India
        this.map = L.map('map').setView([20.5937, 78.9629], 5);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
        
        // Add map click handler to hide loading spinner
        this.map.on('load', () => {
            document.getElementById('loading').classList.add('hidden');
        });
    }
    
    setupEventListeners() {
        // Locate button
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.getUserLocation();
        });
        
        // Highway filter
        document.getElementById('highway-filter').addEventListener('change', (e) => {
            this.filterByHighway(e.target.value);
        });

        // City search
        document.getElementById('search-btn').addEventListener('click', () => {
            const city = document.getElementById('city-search').value;
            if(city) {
                this.searchByCity(city);
            }
        });
    }

    searchByCity(city) {
        const loadingEl = document.getElementById('loading');
        loadingEl.classList.remove('hidden');

        // Geocode the city to get its bounding box
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const boundingbox = data[0].boundingbox;
                    this.fetchPetrolPumps(boundingbox);
                } else {
                    alert('City not found!');
                    loadingEl.classList.add('hidden');
                }
            })
            .catch(error => {
                console.error('Error searching for city:', error);
                alert('An error occurred while searching for the city.');
                loadingEl.classList.add('hidden');
            });
    }

    fetchPetrolPumps(bbox) {
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="fuel"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});out;`;
        
        fetch(overpassUrl)
            .then(response => response.json())
            .then(data => {
                this.stations = data.elements.map(element => ({
                    id: element.id,
                    name: element.tags.name || 'Petrol Pump',
                    highway: element.tags.highway || 'N/A',
                    location: element.tags["addr:full"] || 'Address not available',
                    latitude: element.lat,
                    longitude: element.lon,
                    hours: element.tags.opening_hours || 'N/A',
                    services: this.getServices(element.tags)
                }));
                this.displayStations();
                if (this.stations.length > 0) {
                    // Zoom to the first station
                    this.map.setView([this.stations[0].latitude, this.stations[0].longitude], 12);
                }
                document.getElementById('loading').classList.add('hidden');
            })
            .catch(error => {
                console.error('Error fetching petrol pumps:', error);
                alert('Could not fetch petrol pump data.');
                document.getElementById('loading').classList.add('hidden');
            });
    }

    getServices(tags) {
        const services = [];
        if (tags.fuel_diesel === 'yes') services.push('Diesel');
        if (tags.fuel_petrol === 'yes' || tags.fuel_octane_95 === 'yes' || tags.fuel_octane_98 === 'yes' ) services.push('Petrol');
        if (tags.fuel_cng === 'yes') services.push('CNG');
        if (tags.fuel_lpg === 'yes') services.push('LPG');
        if (tags.charging_station === 'yes') services.push('Electric Vehicle Charging');
        if (tags.atm === 'yes') services.push('ATM');
        if (tags.toilets === 'yes') services.push('Restroom');
        if (tags.car_wash === 'yes') services.push('Car Wash');
        return services;
    }
    
    getUserLocation() {
        const loadingEl = document.getElementById('loading');
        loadingEl.classList.remove('hidden');
        
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            loadingEl.classList.add('hidden');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                this.showUserOnMap();
                this.findNearestStation();
                loadingEl.classList.add('hidden');
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Unable to get your location. Please ensure location services are enabled.');
                loadingEl.classList.add('hidden');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 600000 // 10 minutes
            }
        );
    }
    
    showUserOnMap() {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        
        // Add user marker
        const userIcon = L.divIcon({
            className: 'user-marker',
            html: '📍',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
            icon: userIcon
        }).addTo(this.map);
        
        this.userMarker.bindPopup('You are here').openPopup();
        
        // Center map on user location
        this.map.setView([this.userLocation.lat, this.userLocation.lng], 10);
    }
    
    calculateDistance(lat1, lng1, lat2, lng2) {
        // Haversine formula to calculate distance between two points
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    findNearestStation() {
        if (!this.userLocation || this.stations.length === 0) {
            return;
        }
        
        // Calculate distances and find nearest station
        let nearestStation = null;
        let minDistance = Infinity;
        
        this.stations.forEach(station => {
            const distance = this.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                station.latitude,
                station.longitude
            );
            
            station.distance = distance;
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = station;
            }
        });
        
        if (nearestStation) {
            this.displayNearestStation(nearestStation);
        }
        
        // Re-display stations with updated distances
        this.displayStations();
    }
    
    displayNearestStation(station) {
        const nearestEl = document.getElementById('nearest-station');
        const detailsEl = document.getElementById('station-details');
        
        detailsEl.innerHTML = this.createStationHTML(station, true);
        nearestEl.classList.remove('hidden');
        
        // Highlight on map
        this.highlightStationOnMap(station);
    }
    
    highlightStationOnMap(station) {
        // Remove existing markers
        this.clearMarkers();
        
        // Add markers for all stations
        this.addStationMarkers();
        
        // Find and highlight the nearest station marker
        const nearestMarker = this.markers.find(marker => 
            marker.options.stationId === station.id
        );
        
        if (nearestMarker) {
            nearestMarker.openPopup();
            this.map.setView([station.latitude, station.longitude], 12);
        }
    }
    
    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    }
    
    addStationMarkers() {
        this.stations.forEach(station => {
            const marker = L.marker([station.latitude, station.longitude], {
                stationId: station.id
            }).addTo(this.map);
            
            marker.bindPopup(this.createStationPopup(station));
            this.markers.push(marker);
        });
    }
    
    createStationPopup(station) {
        return `
            <div class="popup-content">
                <h4>${station.name}</h4>
                <p><strong>${station.highway}</strong></p>
                <p>${station.location}</p>
                <p>⏰ ${station.hours}</p>
                ${station.distance ? `<p>📍 ${station.distance.toFixed(1)} km away</p>` : ''}
            </div>
        `;
    }
    
    displayStations() {
        const container = document.getElementById('stations-container');
        
        // Sort by distance if user location is available
        const sortedStations = this.userLocation 
            ? [...this.stations].sort((a, b) => (a.distance || 0) - (b.distance || 0))
            : this.stations;
        
        if (sortedStations.length === 0) {
            container.innerHTML = '<p>No stations found for this area. Try another search.</p>';
        } else {
            container.innerHTML = sortedStations.map(station => 
                this.createStationHTML(station)
            ).join('');
        }
        
        // Add station markers to map
        this.clearMarkers();
        this.addStationMarkers();
    }
    
    createStationHTML(station, isNearest = false) {
        const distanceText = station.distance 
            ? `<span class="station-distance">${station.distance.toFixed(1)} km away</span>`
            : '';
            
        return `
            <div class="station-item">
                <div class="station-name">${station.name} ${distanceText}</div>
                <div class="station-highway">${station.highway}</div>
                <div class="station-location">${station.location}</div>
                <div class="station-hours">⏰ ${station.hours}</div>
                <div class="station-services">
                    ${station.services.map(service => 
                        `<span class="service-tag">${service}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    filterByHighway(highway) {
        if (!highway) {
            this.displayStations();
            return;
        }
        
        const filtered = this.stations.filter(station => 
            station.highway === highway
        );
        
        // Temporarily replace stations for display
        const originalStations = this.stations;
        this.stations = filtered;
        this.displayStations();
        this.stations = originalStations;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FuelFinder();
});
