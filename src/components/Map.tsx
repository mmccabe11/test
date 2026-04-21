import React, { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Port, Shipment } from '../types';
import { getMaritimePath, calculateDistance, Coord } from '../lib/utils';

interface MapProps {
  departurePort?: Port;
  arrivalPort?: Port;
  allPorts: Port[];
  shipments: Shipment[];
  etaLabel?: string;
}

const Map: React.FC<MapProps> = ({ departurePort, arrivalPort, allPorts, shipments, etaLabel }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapError, setMapError] = React.useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setMapError('Google Maps API Key is missing. Please add VITE_GOOGLE_MAPS_API_KEY to your Secrets in AI Studio Settings to enable the map.');
      return;
    }

    (setOptions as any)({
      apiKey: apiKey,
      version: 'weekly',
    });

    const initMap = async () => {
      try {
        const { Map: GoogleMap } = await importLibrary('maps') as google.maps.MapsLibrary;
        
        if (mapRef.current && !googleMapRef.current) {
          googleMapRef.current = new GoogleMap(mapRef.current, {
            center: { lat: 37.0, lng: 2.0 },
            zoom: 5,
            styles: [
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#1e293b' }], // Deep navy water
              },
              {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#0f172a' }], // Slate land
              },
              {
                featureType: 'administrative',
                elementType: 'geometry',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }],
              },
              {
                featureType: 'road',
                stylers: [{ visibility: 'off' }],
              },
              {
                elementType: 'labels.text.fill',
                stylers: [{ color: '#94a3b8' }],
              },
              {
                elementType: 'labels.text.stroke',
                stylers: [{ visibility: 'off' }],
              },
            ],
          });
        }
        updateMarkers();
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setMapError('Failed to load Google Maps. Please ensure the Maps JavaScript API is enabled in your Google Cloud Console.');
      }
    };

    initMap();
  }, []);

  useEffect(() => {
    updateMarkers();
  }, [departurePort, arrivalPort, allPorts, shipments]);

  // Periodic update for vessel positions
  useEffect(() => {
    const interval = setInterval(() => {
      updateMarkers();
    }, 30000); // 30 seconds for smoother updates
    return () => clearInterval(interval);
  }, [allPorts, shipments]);

  const updateMarkers = () => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Clear existing polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    // Clear existing info window
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Add markers for all ports
    allPorts.forEach(port => {
      const isSelected = port.id === departurePort?.id || port.id === arrivalPort?.id;
      const isInTransit = shipments.some(s => 
        s.status === 'in-transit' && (s.departurePort === port.id || s.arrivalPort === port.id)
      );
      
      const marker = new google.maps.Marker({
        position: { lat: port.lat, lng: port.lng },
        map: googleMapRef.current,
        title: port.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: (isSelected || isInTransit) ? 8 : 4,
          fillColor: port.type === 'departure' ? '#f87171' : '#60a5fa',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff',
        },
      });
      markersRef.current.push(marker);
    });

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Draw lines for all in-transit shipments
    shipments.filter(s => s.status === 'in-transit').forEach(shipment => {
      const dep = allPorts.find(p => p.id === shipment.departurePort);
      const arr = allPorts.find(p => p.id === shipment.arrivalPort);
      
      if (dep && arr) {
        const path = getMaritimePath(dep, arr);

        const polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: shipment.color || '#0ea5e9',
          strokeOpacity: 0.4,
          strokeWeight: 2,
          map: googleMapRef.current,
          icons: [{
            icon: { path: 'M 0,-1 L 0,1', strokeOpacity: 0.6, scale: 2 },
            offset: '0',
            repeat: '10px'
          }],
        });

        // Add hover details for the route line
        polyline.addListener('mouseover', (e: google.maps.PolyMouseEvent) => {
          if (!googleMapRef.current) return;
          
          if (infoWindowRef.current) infoWindowRef.current.close();
          
          const cargoInfo = shipment.cargoWeight ? `${shipment.cargoWeight.toLocaleString()} kg` : 'N/A';
          const weatherInfo = shipment.weather ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <div style="font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Current Weather</div>
            <div style="font-size: 10px; color: #475569;">${shipment.weather.condition} • ${shipment.weather.windSpeed} kn</div>
          </div>` : '';

          infoWindowRef.current = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; font-family: 'Inter', system-ui, sans-serif; min-width: 180px; background: white; border-radius: 8px;">
                <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.05em;">Tactical Asset Info</div>
                <div style="font-size: 15px; font-weight: 800; color: ${shipment.color || '#0ea5e9'}; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 18px;">🚢</span> Shipment #${shipment.id.toUpperCase()}
                </div>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 11px; color: #334155; line-height: 1.4;">
                  <span style="font-weight: 600; color: #94a3b8;">DEPARTURE</span> <span style="font-weight: 500;">${dep.name}</span>
                  <span style="font-weight: 600; color: #94a3b8;">ARRIVAL</span> <span style="font-weight: 500;">${arr.name}</span>
                  <span style="font-weight: 600; color: #94a3b8;">CARGO</span> <span style="font-weight: 500;">${cargoInfo}</span>
                </div>
                ${weatherInfo}
              </div>
            `,
            position: e.latLng,
            disableAutoPan: true
          });
          infoWindowRef.current.open(googleMapRef.current);
          polyline.setOptions({ strokeOpacity: 0.9, strokeWeight: 4 });
        });

        polyline.addListener('mouseout', () => {
          polyline.setOptions({ strokeOpacity: 0.4, strokeWeight: 2 });
          // We keep the info window open for easier reading, or close it?
          // For a true "hover" feel, we might want to close it, 
          // but Google Maps InfoWindows are usually best kept until next hover or manual close.
          // Let's close it to stick to the "hover" request.
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }
        });

        polylinesRef.current.push(polyline);
        
        path.forEach(coord => bounds.extend(coord));
        hasPoints = true;
      }
    });

    // Draw preview path if both ports are selected in form
    if (departurePort && arrivalPort) {
      const path = getMaritimePath(departurePort, arrivalPort);

      const previewPolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#f87171', // Red for pending/preview
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: googleMapRef.current,
        icons: [{
          icon: { path: 'M 0,-1 L 0,1', strokeOpacity: 0.8, scale: 2 },
          offset: '0',
          repeat: '10px'
        }],
      });
      polylinesRef.current.push(previewPolyline);

      // Show ETA Label if provided
      if (etaLabel) {
        const midLat = (departurePort.lat + arrivalPort.lat) / 2;
        const midLng = (departurePort.lng + arrivalPort.lng) / 2;
        
        infoWindowRef.current = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; font-family: sans-serif; font-weight: bold; color: #1e40af;">
                      <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Est. Travel Time</div>
                      <div>${etaLabel}</div>
                    </div>`,
          position: { lat: midLat, lng: midLng },
          disableAutoPan: true
        });
        infoWindowRef.current.open(googleMapRef.current);
      }

      path.forEach(coord => bounds.extend(coord));
      hasPoints = true;
    }

    if (hasPoints) {
      googleMapRef.current.fitBounds(bounds, 50);
    }

    const interpolate = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }, fraction: number) => {
      return {
        lat: p1.lat + (p2.lat - p1.lat) * fraction,
        lng: p1.lng + (p2.lng - p1.lng) * fraction
      };
    };

    const getHeading = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      const lat1 = from.lat * Math.PI / 180;
      const lat2 = to.lat * Math.PI / 180;
      const dLon = (to.lng - from.lng) * Math.PI / 180;

      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const brng = Math.atan2(y, x);
      return (brng * 180 / Math.PI + 360) % 360;
    };

    const getPathPosition = (path: Coord[], progress: number) => {
      if (path.length < 2) return { pos: path[0], heading: 0 };
      
      const segmentDistances = [];
      let totalDist = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const d = calculateDistance(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
        segmentDistances.push(d);
        totalDist += d;
      }
      
      if (totalDist === 0) return { pos: path[0], heading: 0 };
      
      const targetDist = totalDist * progress;
      let currentDist = 0;
      
      for (let i = 0; i < segmentDistances.length; i++) {
        if (currentDist + segmentDistances[i] >= targetDist) {
          const segmentProgress = (targetDist - currentDist) / segmentDistances[i];
          const pos = interpolate(path[i], path[i+1], segmentProgress);
          const heading = getHeading(path[i], path[i+1]);
          return { pos, heading };
        }
        currentDist += segmentDistances[i];
      }
      
      return { pos: path[path.length - 1], heading: getHeading(path[path.length - 2], path[path.length - 1]) };
    };

    // Add markers for vessels
    shipments.filter(s => s.status === 'in-transit' && s.actualDepartureTime && s.eta).forEach(shipment => {
      const dep = allPorts.find(p => p.id === shipment.departurePort);
      const arr = allPorts.find(p => p.id === shipment.arrivalPort);

      if (dep && arr) {
        const start = new Date(shipment.actualDepartureTime!).getTime();
        const end = new Date(shipment.eta!).getTime();
        const now = new Date().getTime();
        
        let progress = (now - start) / (end - start);
        progress = Math.max(0, Math.min(1, progress));

        const path = getMaritimePath(dep, arr);
        const { pos, heading } = getPathPosition(path, progress);

        // Add a subtle shadow/glow marker beneath the ship
        const glowMarker = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: shipment.color || '#1e40af',
            fillOpacity: 0.15,
            strokeWeight: 0,
          },
          zIndex: 99,
          clickable: false
        });
        markersRef.current.push(glowMarker);

        const vesselMarker = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: `Shipment #${shipment.id.toUpperCase()} - ${Math.round(progress * 100)}% Complete`,
          icon: {
            // Path representing a more detailed top-down cargo vessel
            path: 'M 0,-14 L 6,-6 L 6,12 L -6,12 L -6,-6 Z M 0,-10 L 0,8 M -3,0 L 3,0',
            fillColor: shipment.color || '#1e40af',
            fillOpacity: 1,
            strokeWeight: 1.2,
            strokeColor: '#ffffff',
            scale: 1.6,
            rotation: heading,
            anchor: new google.maps.Point(0, 0)
          },
          zIndex: 100
        });
        markersRef.current.push(vesselMarker);
      }
    });
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-xl shadow-inner bg-gray-100 border border-gray-200"
        id="google-map-container"
      />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 rounded-xl p-6 text-center z-10">
          <div className="max-w-xs">
            <p className="text-sm font-bold text-red-600 mb-2">Map Configuration Required</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {mapError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
