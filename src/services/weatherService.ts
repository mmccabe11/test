export interface WeatherData {
  windSpeed: number; // knots
  waveHeight: number; // meters
  condition: string;
}

/**
 * Fetches marine weather data from Open-Meteo.
 * @param lat Latitude
 * @param lng Longitude
 */
export async function fetchMarineWeather(lat: number, lng: number): Promise<WeatherData> {
  try {
    // Open-Meteo Marine API is free and doesn't require an API key for standard usage.
    // We removed custom headers that were causing CORS preflight (Failed to fetch) issues.
    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wave_height&wind_speed_unit=kn&timezone=auto`
    );
    
    if (!response.ok) throw new Error('Weather data fetch failed');
    
    const data = await response.json();
    
    return {
      windSpeed: data.current.wind_speed_10m || 0,
      waveHeight: data.current.wave_height || 0,
      condition: getWeatherCondition(data.current.wave_height, data.current.wind_speed_10m)
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return { windSpeed: 0, waveHeight: 0, condition: 'Unknown' };
  }
}

function getWeatherCondition(waves: number, wind: number): string {
  if (waves > 4 || wind > 35) return 'Severe';
  if (waves > 2 || wind > 20) return 'Moderate';
  return 'Clear';
}
