import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Ship, 
  MapPin, 
  Calendar, 
  Plus, 
  Search, 
  LayoutGrid, 
  Table as TableIcon,
  ChevronRight,
  Anchor,
  Navigation,
  DollarSign
} from 'lucide-react';
import { format, isWeekend, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import Map from './components/Map';
import { Port, Shipment } from './types';
import { DEPARTURE_PORTS, INITIAL_ARRIVAL_PORTS, COA_LIST, TACTICAL_COLORS } from './constants';
import { 
  calculateDistance, 
  calculateTravelTime, 
  formatDuration, 
  calculateHandlingTime,
  getMaritimePath,
  calculateTotalPathDistance 
} from './lib/utils';
import { fetchMarineWeather, WeatherData } from './services/weatherService';
import { Wind, Droplets, CloudRain, CloudSun, CloudLightning, AlertTriangle, Weight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [arrivalPorts, setArrivalPorts] = useState<Port[]>(INITIAL_ARRIVAL_PORTS);
  
  // Form State
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDeparture, setSelectedDeparture] = useState<string>('');
  const [selectedArrival, setSelectedArrival] = useState<string>('');
  const [cargoWeight, setCargoWeight] = useState<string>('');
  const [selectedCoa, setSelectedCoa] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  // New Port State
  const [showAddPort, setShowAddPort] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [newPortLat, setNewPortLat] = useState('');
  const [newPortLng, setNewPortLng] = useState('');

  const [loadingStatuses, setLoadingStatuses] = useState<Record<string, boolean>>({});

  const isSlowdownDay = useMemo(() => {
    if (!startDate) return false;
    try {
      const date = parseISO(startDate);
      
      // 1. Weekend Check
      if (isWeekend(date)) return true;

      // 2. Simple Holiday Check (MM-DD)
      const monthDay = format(date, 'MM-dd');
      const holidays = [
        '01-01', // New Year
        '05-01', // Labor Day
        '07-04', // US Independence
        '12-25', // Christmas
        '12-31'  // New Year Eve
      ];
      
      if (holidays.includes(monthDay)) return true;

      return false;
    } catch {
      return false;
    }
  }, [startDate]);

  const departurePort = useMemo(() => 
    DEPARTURE_PORTS.find(p => p.id === selectedDeparture), 
  [selectedDeparture]);

  const arrivalPort = useMemo(() => 
    arrivalPorts.find(p => p.id === selectedArrival), 
  [selectedArrival, arrivalPorts]);

  const allPorts = useMemo(() => 
    [...DEPARTURE_PORTS, ...arrivalPorts], 
  [arrivalPorts]);

  // Fetch weather for current route preview
  React.useEffect(() => {
    const updateWeather = async () => {
      if (departurePort && arrivalPort) {
        setIsWeatherLoading(true);
        const midLat = (departurePort.lat + arrivalPort.lat) / 2;
        const midLng = (departurePort.lng + arrivalPort.lng) / 2;
        const weather = await fetchMarineWeather(midLat, midLng);
        setCurrentWeather(weather);
        setIsWeatherLoading(false);
      } else {
        setCurrentWeather(null);
      }
    };
    updateWeather();
  }, [departurePort, arrivalPort]);

  const handleAddShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeparture || !selectedArrival) return;

    const newShipment: Shipment = {
      id: Math.random().toString(36).substr(2, 9),
      startDate,
      departurePort: selectedDeparture,
      arrivalPort: selectedArrival,
      status: 'pending',
      cargoWeight: cargoWeight ? parseFloat(cargoWeight) : undefined,
      coa: selectedCoa || undefined,
      color: TACTICAL_COLORS[shipments.length % TACTICAL_COLORS.length],
      operationalSlowdownFlag: isSlowdownDay ? 1 : 0,
    };

    setShipments([newShipment, ...shipments]);
    setCargoWeight('');
    setSelectedCoa('');
    setSelectedDeparture('');
    setSelectedArrival('');
  };

  const handleDeleteShipment = (id: string) => {
    setShipments(shipments.filter(s => s.id !== id));
  };

  const handleUpdateStatus = async (id: string) => {
    setLoadingStatuses(prev => ({ ...prev, [id]: true }));
    try {
      // Get the current shipment state
      const currentShipment = shipments.find(s => s.id === id);
      if (!currentShipment) return;

      const nextStatus: Shipment['status'] = 
        currentShipment.status === 'pending' ? 'in-transit' : 
        currentShipment.status === 'in-transit' ? 'delivered' : 'pending';
      
      let eta = currentShipment.eta;
      let weather = currentShipment.weather;
      let actualDepartureTime = currentShipment.actualDepartureTime;

      if (nextStatus === 'in-transit') {
        const departure = DEPARTURE_PORTS.find(p => p.id === currentShipment.departurePort);
        const arrival = arrivalPorts.find(p => p.id === currentShipment.arrivalPort);
        if (departure && arrival) {
          const midLat = (departure.lat + arrival.lat) / 2;
          const midLng = (departure.lng + arrival.lng) / 2;
          weather = await fetchMarineWeather(midLat, midLng);
          
          const maritimePath = getMaritimePath(
            { lat: departure.lat, lng: departure.lng },
            { lat: arrival.lat, lng: arrival.lng }
          );
          const totalDistance = calculateTotalPathDistance(maritimePath);
          
          const travelHours = calculateTravelTime(totalDistance, weather.windSpeed, weather.waveHeight);
          const handlingHours = calculateHandlingTime(currentShipment.cargoWeight || 0);
          const slowdownBuffer = currentShipment.operationalSlowdownFlag === 1 ? 24 : 0;
          const totalHours = travelHours + handlingHours + slowdownBuffer;
          
          const now = new Date();
          const arrivalDate = new Date(now.getTime() + totalHours * 60 * 60 * 1000);
          eta = arrivalDate.toISOString();
          actualDepartureTime = now.toISOString();
        }
      } else if (nextStatus === 'pending') {
        eta = undefined;
        actualDepartureTime = undefined;
      } else if (nextStatus === 'delivered') {
        eta = undefined;
      }

      setShipments(prev => prev.map(s => 
        s.id === id ? { ...s, status: nextStatus, eta, weather, actualDepartureTime } : s
      ));
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setLoadingStatuses(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const departure = DEPARTURE_PORTS.find(p => p.id === s.departurePort)?.name || '';
      const arrival = arrivalPorts.find(p => p.id === s.arrivalPort)?.name || '';
      const searchStr = `${departure} ${arrival} ${s.status}`.toLowerCase();
      return searchStr.includes(filterText.toLowerCase());
    });
  }, [shipments, filterText, arrivalPorts]);

  const handleAddPort = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortName || !newPortLat || !newPortLng) return;

    const newPort: Port = {
      id: newPortName.toLowerCase().replace(/\s+/g, '-'),
      name: newPortName,
      lat: parseFloat(newPortLat),
      lng: parseFloat(newPortLng),
      type: 'arrival',
    };

    setArrivalPorts([...arrivalPorts, newPort]);
    setNewPortName('');
    setNewPortLat('');
    setNewPortLng('');
    setShowAddPort(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1C1E] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Ship size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Freight Flow Tracker</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Transportation Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            System Active
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls & Inputs */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* New Shipment Form */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Plus size={18} className="text-blue-600" />
                New Freight Entry
              </h2>
            </div>
            <form onSubmit={handleAddShipment} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={14} />
                  Departure Date
                </label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Anchor size={14} />
                  Departure Port
                </label>
                <select 
                  value={selectedDeparture}
                  onChange={(e) => setSelectedDeparture(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                  required
                >
                  <option value="" disabled>Select departure...</option>
                  {DEPARTURE_PORTS.map(port => (
                    <option key={port.id} value={port.id}>{port.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Navigation size={14} />
                  Arrival Destination
                </label>
                <select 
                  value={selectedArrival}
                  onChange={(e) => setSelectedArrival(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                  required
                >
                  <option value="" disabled>Select destination...</option>
                  {arrivalPorts.map(port => (
                    <option key={port.id} value={port.id}>{port.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Weight size={14} />
                  Cargo Weight (Tons) - Optional
                </label>
                <input 
                  type="number" 
                  placeholder="e.g. 30000"
                  value={cargoWeight}
                  onChange={(e) => setCargoWeight(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <LayoutGrid size={14} />
                  Contract of Affreightment (COA)
                </label>
                <select 
                  value={selectedCoa}
                  onChange={(e) => setSelectedCoa(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                >
                  <option value="">Select COA (Optional)...</option>
                  {COA_LIST.map(coa => (
                    <option key={coa} value={coa}>{coa}</option>
                  ))}
                </select>
              </div>

              {isSlowdownDay && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-700 font-bold uppercase">
                    Slowdown Potential: Weekend or Shared Holiday detected
                  </p>
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add to Tracking
              </button>

              {/* Weather Preview */}
              {departurePort && arrivalPort && (
                <div className={cn(
                  "p-4 rounded-xl border transition-all",
                  isWeatherLoading ? "bg-gray-50 border-gray-100 animate-pulse" : 
                  currentWeather?.condition === 'Severe' ? "bg-red-50 border-red-100" :
                  currentWeather?.condition === 'Moderate' ? "bg-amber-50 border-amber-100" :
                  "bg-blue-50 border-blue-100"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                      <CloudSun size={14} />
                      Route Weather Forecast
                    </h3>
                    {currentWeather?.condition !== 'Clear' && (
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        currentWeather?.condition === 'Severe' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      )}>
                        <AlertTriangle size={10} />
                        {currentWeather?.condition} Impact
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Wind Speed</p>
                      <div className="flex items-center gap-2">
                        <Wind size={16} className="text-blue-500" />
                        <span className="text-sm font-bold">{currentWeather?.windSpeed || 0} kts</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Wave Height</p>
                      <div className="flex items-center gap-2">
                        <Droplets size={16} className="text-blue-500" />
                        <span className="text-sm font-bold">{currentWeather?.waveHeight || 0} m</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </section>

          {/* Port Management Section */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Anchor size={18} className="text-gray-600" />
                Manage Destinations
              </h2>
              <button 
                onClick={() => setShowAddPort(!showAddPort)}
                className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1"
              >
                {showAddPort ? 'Cancel' : 'Add New'}
              </button>
            </div>
            
            {showAddPort ? (
              <form onSubmit={handleAddPort} className="p-6 space-y-4 bg-blue-50/30 border-b border-gray-100">
                <div className="grid grid-cols-1 gap-3">
                  <input 
                    type="text" 
                    placeholder="Port Name"
                    value={newPortName}
                    onChange={(e) => setNewPortName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Latitude"
                      value={newPortLat}
                      onChange={(e) => setNewPortLat(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Longitude"
                      value={newPortLng}
                      onChange={(e) => setNewPortLng(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-gray-800 hover:bg-black text-white text-xs font-bold py-2 rounded-lg transition-all"
                >
                  Save Destination
                </button>
              </form>
            ) : null}

            <div className="max-h-[200px] overflow-y-auto p-2">
              {arrivalPorts.map(port => (
                <div key={port.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{port.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{port.lat.toFixed(4)}, {port.lng.toFixed(4)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setArrivalPorts(arrivalPorts.filter(p => p.id !== port.id))}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Active Lanes</p>
              <p className="text-2xl font-bold text-blue-600">{shipments.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Ports</p>
              <p className="text-2xl font-bold text-gray-800">{allPorts.length}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Map & Spreadsheet */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Map Section */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-[500px] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <MapPin size={18} className="text-red-500" />
                Route Visualization
              </h2>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                  Departure
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  Arrival
                </div>
              </div>
            </div>
            <div className="flex-1 p-4">
              <Map 
                departurePort={departurePort} 
                arrivalPort={arrivalPort} 
                allPorts={allPorts} 
                shipments={shipments}
                etaLabel={(() => {
                  if (departurePort && arrivalPort) {
                    const maritimePath = getMaritimePath(
                      { lat: departurePort.lat, lng: departurePort.lng },
                      { lat: arrivalPort.lat, lng: arrivalPort.lng }
                    );
                    const totalDistance = calculateTotalPathDistance(maritimePath);
                    
                    const travelHours = calculateTravelTime(
                      totalDistance, 
                      currentWeather?.windSpeed || 0, 
                      currentWeather?.waveHeight || 0
                    );
                    const handlingHours = calculateHandlingTime(parseFloat(cargoWeight) || 0);
                    const slowdownHours = isSlowdownDay ? 24 : 0;
                    
                    const total = formatDuration(travelHours + handlingHours + slowdownHours);
                    const travel = formatDuration(travelHours);
                    const handling = formatDuration(handlingHours);
                    
                    return `
                      <div style="margin-top: 4px; font-weight: normal; font-size: 10px; min-width: 120px;">
                        <div style="display: flex; justify-content: space-between; gap: 8px; color: #6b7280; margin-bottom: 2px;">
                          <span>Transit:</span> <span>${travel}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 8px; color: #6b7280; margin-bottom: 2px;">
                          <span>Handling:</span> <span>${handling}</span>
                        </div>
                        ${slowdownHours > 0 ? `
                        <div style="display: flex; justify-content: space-between; gap: 8px; color: #ef4444; margin-bottom: 2px;">
                          <span>Slowdown:</span> <span>${formatDuration(slowdownHours)}</span>
                        </div>` : ''}
                        <div style="border-top: 1px solid #e5e7eb; margin-top: 4px; padding-top: 4px; font-weight: bold; color: #1e40af; font-size: 11px;">
                          Total: ${total}
                        </div>
                      </div>
                    `;
                  }
                  return undefined;
                })()}
              />
            </div>
          </section>

          {/* Spreadsheet / Table Section */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <TableIcon size={18} className="text-green-600" />
                Shipment Ledger
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const data = [
                      ['Date', 'COA (Contract of Affreightment)', 'Departure', 'Arrival', 'Status', 'Estimated Cost'],
                      ...shipments.map(s => [
                        s.startDate,
                        s.coa || 'N/A',
                        DEPARTURE_PORTS.find(p => p.id === s.departurePort)?.name,
                        arrivalPorts.find(p => p.id === s.arrivalPort)?.name,
                        s.status,
                        '' // Blank for manual entry later
                      ])
                    ];
                    
                    const worksheet = XLSX.utils.aoa_to_sheet(data);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Shipments");
                    XLSX.writeFile(workbook, "shipment_tracking_log.xlsx");
                  }}
                  className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-full text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <TableIcon size={12} />
                  Export to Excel
                </button>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Filter shipments..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">COA</th>
                    <th className="px-6 py-4">Route</th>
                    <th className="px-6 py-4">ETA / Travel Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                        {filterText ? 'No shipments match your search.' : 'No shipments recorded. Use the form to start tracking.'}
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((shipment) => (
                      <tr key={shipment.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 text-sm font-medium text-gray-600">
                          {shipment.startDate}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-1.5 h-8 rounded-full shadow-sm" 
                              style={{ backgroundColor: shipment.color || '#0ea5e9' }}
                            />
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400" />
                                <span className="text-sm font-bold text-gray-800">
                                  {DEPARTURE_PORTS.find(p => p.id === shipment.departurePort)?.name}
                                </span>
                              </div>
                              {shipment.coa && (
                                <div className="flex items-center gap-2">
                                  <LayoutGrid size={12} className="text-blue-500" />
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    {shipment.coa}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-blue-600">
                              {DEPARTURE_PORTS.find(p => p.id === shipment.departurePort)?.name}
                            </span>
                            <ChevronRight size={14} className="text-gray-300" />
                            <span className="font-semibold text-gray-800">
                              {arrivalPorts.find(p => p.id === shipment.arrivalPort)?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-3 min-w-[200px]">
                            {shipment.eta && (
                              <div className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md w-fit">
                                <Calendar size={14} />
                                <span className="text-sm">{format(new Date(shipment.eta), 'MMM d, HH:mm')}</span>
                              </div>
                            )}

                            {(() => {
                              const departure = DEPARTURE_PORTS.find(p => p.id === shipment.departurePort);
                              const arrival = arrivalPorts.find(p => p.id === shipment.arrivalPort);
                              if (departure && arrival) {
                                const maritimePath = getMaritimePath(departure, arrival);
                                const distance = calculateTotalPathDistance(maritimePath);
                                const travelHours = calculateTravelTime(
                                  distance, 
                                  shipment.weather?.windSpeed || 0, 
                                  shipment.weather?.waveHeight || 0
                                );
                                const handlingHours = calculateHandlingTime(shipment.cargoWeight || 0);
                                const slowdownHours = shipment.operationalSlowdownFlag === 1 ? 24 : 0;
                                const totalHours = travelHours + handlingHours + slowdownHours;
                                
                                return (
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-blue-700 font-black text-base leading-none">
                                        {formatDuration(totalHours)}
                                      </div>
                                      <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">
                                        Total Estimated Transit
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-1 pl-3 border-l-2 border-gray-100">
                                      <div className="flex justify-between items-center text-[10px] text-gray-500">
                                        <span className="font-medium">Sea Voyage (Kts/Weather)</span>
                                        <span className="font-mono bg-gray-50 px-1.5 rounded">{formatDuration(travelHours)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-gray-500">
                                        <span className="font-medium">Terminal Ops (Tonnage)</span>
                                        <span className="font-mono bg-gray-50 px-1.5 rounded">{formatDuration(handlingHours)}</span>
                                      </div>
                                      {slowdownHours > 0 && (
                                        <div className="flex justify-between items-center text-[10px] text-red-500 font-bold">
                                          <span>Op. Slowdown Buffer</span>
                                          <span className="font-mono bg-red-50 px-1.5 rounded">+{formatDuration(slowdownHours)}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {shipment.cargoWeight && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-600 rounded">
                                          <Weight size={10} />
                                          {shipment.cargoWeight.toLocaleString()}T
                                        </div>
                                      )}
                                      {shipment.weather && (
                                        <div className="flex items-center gap-2 px-1.5 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-500 rounded">
                                          <Wind size={10} className="w-2.5 h-2.5" />
                                          {shipment.weather.windSpeed}KT / {shipment.weather.waveHeight}M
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              if (shipment.status === 'delivered') {
                                return (
                                  <div className="flex items-center gap-1.5 text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md w-fit">
                                    <MapPin size={14} />
                                    <span className="text-sm uppercase tracking-wider">Arrived</span>
                                  </div>
                                );
                              }
                              return <span className="text-xs text-gray-400 italic font-medium">Calculation Pending...</span>;
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleUpdateStatus(shipment.id)}
                            disabled={loadingStatuses[shipment.id]}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                              loadingStatuses[shipment.id] ? "bg-gray-100 text-gray-400 cursor-not-allowed" :
                              shipment.status === 'pending' ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                              shipment.status === 'in-transit' ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                              "bg-green-100 text-green-700 hover:bg-green-200"
                            )}
                          >
                            {loadingStatuses[shipment.id] ? (
                              <>
                                <span className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Updating...
                              </>
                            ) : (
                              shipment.status
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono italic">
                            <DollarSign size={10} />
                            -
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteShipment(shipment.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Plus size={16} className="rotate-45" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>

      {/* Footer / Info */}
      <footer className="p-8 text-center border-t border-gray-200 mt-12 bg-white">
        <p className="text-sm text-gray-400">
          &copy; 2026 Freight Flow Tracker &bull; Logistics Visualization System
        </p>
      </footer>
    </div>
  );
}
