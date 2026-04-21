export interface Coord {
  lat: number;
  lng: number;
}

const GIBRALTAR: Coord = { lat: 35.94, lng: -5.60 };
const FLORIDA_STRAITS: Coord = { lat: 25.0, lng: -80.0 };
const ST_LAWRENCE: Coord = { lat: 47.5, lng: -60.0 };

/**
 * Generates a realistic maritime path between two points by injecting necessary waypoints.
 */
export function getMaritimePath(start: Coord, end: Coord): Coord[] {
  const path: Coord[] = [start];
  
  // 1. Exit Mediterranean via Strait of Gibraltar
  if (start.lng > GIBRALTAR.lng && end.lng < GIBRALTAR.lng) {
    path.push(GIBRALTAR);
  }
  
  // 2. Entrance to Gulf of Mexico (for Tampa, Manatee ports)
  if (end.lng < -81 && end.lat < 30) {
    path.push(FLORIDA_STRAITS);
  }
  
  // 3. Entrance to St. Lawrence River (for Montreal)
  if (end.lng < -70 && end.lat > 44) {
    path.push(ST_LAWRENCE);
  }
  
  path.push(end);
  return path;
}

/**
 * Calculates the total Haversine distance for a path of coordinates.
 */
export function calculateTotalPathDistance(path: Coord[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += calculateDistance(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
  }
  return total;
}

/**
 * Calculates the Haversine distance between two points on the Earth.
 * @returns Distance in kilometers.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the estimated travel time for a bulk carrier, adjusted for weather.
 * Average speed for a gypsum bulk carrier is around 13 knots (approx 24 km/h).
 * @param distanceKm Distance in kilometers
 * @param windSpeed Wind speed in knots
 * @param waveHeight Wave height in meters
 * @returns Duration in hours.
 */
export function calculateTravelTime(distanceKm: number, windSpeed: number = 0, waveHeight: number = 0): number {
  let speedKnots = 13;

  // Weather impact adjustments
  if (windSpeed > 35) speedKnots *= 0.75; // 25% reduction for severe wind
  else if (windSpeed > 20) speedKnots *= 0.90; // 10% reduction for moderate wind

  if (waveHeight > 4) speedKnots *= 0.70; // 30% reduction for severe waves
  else if (waveHeight > 2) speedKnots *= 0.85; // 15% reduction for moderate waves

  const speedKmh = speedKnots * 1.852; // Convert knots to km/h
  return distanceKm / speedKmh;
}

/**
 * Calculates the estimated port handling time (loading/unloading) based on cargo weight.
 * @param weightTons Cargo weight in metric tons
 * @returns Duration in hours.
 */
export function calculateHandlingTime(weightTons: number): number {
  if (!weightTons || weightTons <= 0) return 0;
  
  // Base handling time: 1 hour per 1000 tons
  let handlingHours = weightTons / 1000;
  
  // Heavy load penalty: if over 35,000 tons, add 24 hours for logistics complexity
  if (weightTons > 35000) {
    handlingHours += 24;
  }
  
  return handlingHours;
}

/**
 * Formats a duration in hours into a human-readable string.
 */
export function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  
  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${remainingHours}h`;
}
