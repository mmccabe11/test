export interface Port {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'departure' | 'arrival';
}

export interface Shipment {
  id: string;
  startDate: string;
  departurePort: string;
  arrivalPort: string;
  status: 'pending' | 'in-transit' | 'delivered';
  notes?: string;
  eta?: string;
  actualDepartureTime?: string;
  cargoWeight?: number;
  coa?: string;
  color?: string;
  operationalSlowdownFlag?: 0 | 1;
  weather?: {
    windSpeed: number;
    waveHeight: number;
    condition: string;
  };
}
