import { Port } from './types';

export const DEPARTURE_PORTS: Port[] = [
  { id: 'garrucha', name: 'Garrucha', lat: 37.1822, lng: -1.8222, type: 'departure' },
  { id: 'almeria', name: 'Almeria', lat: 36.8340, lng: -2.4637, type: 'departure' },
];

export const INITIAL_ARRIVAL_PORTS: Port[] = [
  { id: 'baltimore-rukert', name: 'Baltimore - Rukert', lat: 39.2680, lng: -76.5850, type: 'arrival' },
  { id: 'bristol', name: 'Bristol', lat: 36.5951, lng: -82.1887, type: 'arrival' },
  { id: 'buchanan', name: 'Buchanan', lat: 41.2598, lng: -73.9390, type: 'arrival' },
  { id: 'camden', name: 'Camden', lat: 39.9448, lng: -75.1199, type: 'arrival' },
  { id: 'cementon', name: 'Cementon', lat: 42.1465, lng: -73.9412, type: 'arrival' },
  { id: 'charleston-carver', name: 'Charleston - Carver', lat: 32.8200, lng: -79.9400, type: 'arrival' },
  { id: 'charleston-kmi', name: 'Charleston - KMI', lat: 32.8300, lng: -79.9500, type: 'arrival' },
  { id: 'charleston-pier-j', name: 'Charleston - Pier J', lat: 32.8400, lng: -79.9600, type: 'arrival' },
  { id: 'coeymans', name: 'Coeymans', lat: 42.4770, lng: -73.7912, type: 'arrival' },
  { id: 'jacksonville', name: 'Jacksonville', lat: 30.3322, lng: -81.6557, type: 'arrival' },
  { id: 'montreal', name: 'Montreal', lat: 45.5017, lng: -73.5673, type: 'arrival' },
  { id: 'newington', name: 'Newington', lat: 43.1000, lng: -70.8300, type: 'arrival' },
  { id: 'norfolk', name: 'Norfolk', lat: 36.8508, lng: -76.2859, type: 'arrival' },
  { id: 'port-everglades', name: 'Port Everglades', lat: 26.0850, lng: -80.1200, type: 'arrival' },
  { id: 'port-manatee', name: 'Port Manatee', lat: 27.6380, lng: -82.5600, type: 'arrival' },
  { id: 'savannah', name: 'Savannah', lat: 32.0835, lng: -81.0998, type: 'arrival' },
  { id: 'searsport', name: 'Searsport', lat: 44.4587, lng: -68.9228, type: 'arrival' },
  { id: 'tampa', name: 'Tampa', lat: 27.9506, lng: -82.4572, type: 'arrival' },
];

export const COA_LIST = [
  'EDF-2018_ALMERIA',
  'EDF-2018_GARRUCHA',
  'NORDEN_ALMERIA',
  'NORDEN_GARRUCHA',
  'NORDEN-OPTIONALS_ALMERIA',
  'NORDEN-OPTIONALS_GARRUCHA',
  'PB-2016_ALMERIA',
  'PB-2016_GARRUCHA',
  'PB-2019_ALMERIA',
  'PB-2019_GARRUCHA',
  'PHOENIX_ALMERIA',
  'PHOENIX_GARRUCHA'
];

export const TACTICAL_COLORS = [
  '#0ea5e9', // Cyan
  '#f472b6', // Pink
  '#a855f7', // Purple
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#ec4899', // Rose
  '#14b8a6', // Teal
];
