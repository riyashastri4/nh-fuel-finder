// NH Fuel Finder - Main JavaScript Application
class FuelFinder {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.stations = [];
        this.markers = [];
        this.userMarker = null;
        this.searchCenter = null; // To store the center of a city search

        this.init();
    }

    async init() {
        this.initMap();
        this.setupEventListeners();
        this.displayStations();
    }

    initMap() {
        this.map = L.map('map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
        this.map.on('load', () => {
            document.getElementById('loading').classList.add('hidden');
        });
    }

    setupEventListeners() {
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.getUserLocation();
        });

        document.getElementById('highway-filter').addEventListener('change', (e) => {
            this.filterByHighway(e.target.value);
        });

        document.getElementById('search-btn').addEventListener('click', () => {
            const city = document.getElementById('city-search').value;
            if (city) {
                this.searchByCity(city);
            }
        });
    }

    searchByCity(city) {
        const loadingEl = document.getElementById('loading');
        loadingEl.classList.remove('hidden');

        // Geocode the city to get its coordinates and bounding box
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    this.searchCenter = { // Store city center for fallback
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                    const boundingbox = data[0].boundingbox;
                    this.fetchPetrolPumpsInBbox(boundingbox);
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

    fetchPetrolPumpsInBbox(bbox) {
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="fuel"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});out;`;

        fetch(overpassUrl)
            .then(response => response.json())
            .then(data => {
                if (data.elements.length > 0) {
                    this.stations = this.processOverpassData(data);
                    this.displayStations();
                    if (this.stations.length > 0) {
                        this.map.setView([this.stations[0].latitude, this.stations[0].longitude], 12);
                    }
                    document.getElementById('loading').classList.add('hidden');
                } else {
                    // If no stations are in the bounding box, search by expanding radius
                    this.fetchPetrolPumpsByRadius();
                }
            })
            .catch(error => {
                console.error('Error fetching petrol pumps in bbox:', error);
                alert('Could not fetch petrol pump data.');
                document.getElementById('loading').classList.add('hidden');
            });
    }

    fetchPetrolPumpsByRadius(radius = 20000, attempt = 1) { // Start with a 20km radius
        const MAX_ATTEMPTS = 5; // Try up to 5 times, doubling the radius each time
        if (attempt > MAX_ATTEMPTS || !this.searchCenter) {
            document.getElementById('loading').classList.add('hidden');
            const container = document.getElementById('stations-container');
            container.innerHTML = '<p>Could not find any stations, even after expanding the search.</p>';
            return;
        }

        const overpassQuery = `[out:json];node(around:${radius},${this.searchCenter.lat},${this.searchCenter.lon})["amenity"="fuel"];out;`;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

        fetch(overpassUrl)
            .then(response => response.json())
            .then(data => {
                if (data.elements.length > 0) {
                    this.stations = this.processOverpassData(data);
                    // Set the "user location" to the city center for distance sorting
                    this.userLocation = {
                        lat: this.searchCenter.lat,
                        lng: this.searchCenter.lon
                    };
                    this.findNearestStation(); // Calculate distances and find the nearest
                    document.getElementById('loading').classList.add('hidden');
                } else {
                    // No stations found, expand the radius and try again
                    this.fetchPetrolPumpsByRadius(radius * 2, attempt + 1);
                }
            })
            .catch(error => {
                console.error('Error fetching petrol pumps by radius:', error);
                document.getElementById('loading').classList.add('hidden');
            });
    }

    processOverpassData(data) {
        return data.elements.map(element => ({
            id: element.id,
            name: element.tags.name || 'Petrol Pump',
            highway: element.tags.highway || 'N/A',
            location: element.tags["addr:full"] || 'Address not available',
            latitude: element.lat,
            longitude: element.lon,
            hours: element.tags.opening_hours || 'N/A',
            services: this.getServices(element.tags)
        }));
    }


    getServices(tags) {
        const services = [];
        if (tags.fuel_diesel === 'yes') services.push('Diesel');
        if (tags.fuel_petrol === 'yes' || tags.fuel_octane_95 === 'yes' || tags.fuel_octane_98 === 'yes') services.push('Petrol');
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
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 600000
            }
        );
    }

    showUserOnMap() {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

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
        this.map.setView([this.userLocation.lat, this.userLocation.lng], 10);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
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
            this.displayStations(); // Still need to display the (potentially sorted) list
            return;
        }

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

        this.displayStations();
    }

    displayNearestStation(station) {
        const nearestEl = document.getElementById('nearest-station');
        const detailsEl = document.getElementById('station-details');
        detailsEl.innerHTML = this.createStationHTML(station, true);
        nearestEl.classList.remove('hidden');
        this.highlightStationOnMap(station);
    }

    highlightStationOnMap(station) {
        this.clearMarkers();
        this.addStationMarkers();
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
        const sortedStations = this.userLocation ?
            [...this.stations].sort((a, b) => (a.distance || 0) - (b.distance || 0)) :
            this.stations;

        if (sortedStations.length === 0) {
            container.innerHTML = '<p>Enter a city to begin your search.</p>';
        } else {
            container.innerHTML = sortedStations.map(station =>
                this.createStationHTML(station)
            ).join('');
        }

        this.clearMarkers();
        this.addStationMarkers();
    }

    createStationHTML(station, isNearest = false) {
        const distanceText = station.distance ?
            `<span class="station-distance">${station.distance.toFixed(1)} km away</span>` :
            '';
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
        const originalStations = this.stations;
        this.stations = filtered;
        this.displayStations();
        this.stations = originalStations;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FuelFinder();
});
