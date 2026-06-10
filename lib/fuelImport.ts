import { Branch, FuelEntry, Vehicle } from '../types';
import { getCsvVehicleMapping } from './csvVehicleMapping';
import { normalizeRegistration as normalizeReg, formatRegistration } from './vehicleRegistration';

export interface ParsedFuelCsvRow {
  registration: string;
  date: string;
  odometer: number | null;
  litres: number | null;
  tripDistance: number | null;
  depot: string;
  pricePerLitre: number | null;
  assetType: string;
  sourceNote: string;
  raw: Record<string, string>;
  lineNumber: number;
}

const HEADER_ALIASES: { [key: string]: string[] } = {
  registration: ['registration', 'reg', 'vehicle', 'plate', 'plate_number', 'vehicle_registration'],
  date: ['date', 'fill_date', 'fuel_date'],
  odometer: ['odometer', 'odo', 'km', 'mileage'],
  litres: ['litres', 'liters', 'l', 'fuel'],
  tripDistance: ['trip_distance', 'distance', 'kms', 'km_travelled'],
  depot: ['depot', 'branch', 'location', 'site'],
  pricePerLitre: ['price_per_litre', 'price', 'unit_price'],
  assetType: ['asset_type', 'type', 'vehicle_type'],
  sourceNote: ['source_note', 'note', 'comments', 'remarks'],
};

const normalizeHeaderKey = (header: string) => header.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

const getHeaderMap = (headers: string[]) => {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeaderKey(header);
    for (const target of Object.keys(HEADER_ALIASES)) {
      if (HEADER_ALIASES[target].includes(normalized)) {
        map[target] = index;
        return;
      }
    }
    map[normalized] = index;
  });
  return map;
};

export const normalizeRegistration = normalizeReg;

const getAlphaNumericTokens = (value: string) => value.match(/[A-Z]+|[0-9]+/g) || [];

export const compareRegistration = (source: string, candidate: string) => {
  const normalizedSource = normalizeRegistration(source);
  const normalizedCandidate = normalizeRegistration(candidate);
  if (!normalizedSource || !normalizedCandidate) return false;
  if (normalizedSource === normalizedCandidate) return true;
  if (normalizedSource.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedSource)) return true;

  const digitsOnlySource = normalizedSource.replace(/[A-Z]/g, '');
  const digitsOnlyCandidate = normalizedCandidate.replace(/[A-Z]/g, '');
  if (digitsOnlySource && digitsOnlySource === digitsOnlyCandidate) return true;

  const sourceTokens = getAlphaNumericTokens(normalizedSource);
  const candidateTokens = getAlphaNumericTokens(normalizedCandidate);
  if (sourceTokens.length >= 2 && candidateTokens.length >= 2) {
    const sourceTail = sourceTokens.slice(-2).join('');
    const candidateTail = candidateTokens.slice(-2).join('');
    if (sourceTail === candidateTail) return true;
  }

  return false;
};

export const parseFuelCsv = (text: string): ParsedFuelCsvRow[] => {
  const lines = text.split(/\r?\n/);
  const rows = lines.map(line => line.trim());
  const nonEmpty = rows.filter(Boolean);
  if (nonEmpty.length === 0) return [];

  const headerRow = nonEmpty[0].split(',').map(h => h.trim());
  const headerMap = getHeaderMap(headerRow);

  return nonEmpty.slice(1).map((line, index) => {
    const cells = line.split(',').map(cell => cell.trim());
    const get = (key: string) => {
      const idx = headerMap[key];
      return typeof idx === 'number' ? (cells[idx] || '') : '';
    };

    const parseNumber = (value: string) => {
      if (!value || value.trim() === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const odometer = parseNumber(get('odometer'));
    const litres = parseNumber(get('litres'));
    const tripDistance = parseNumber(get('tripDistance'));
    const pricePerLitre = parseNumber(get('pricePerLitre'));

    return {
      registration: get('registration'),
      date: get('date'),
      odometer: Number.isFinite(odometer) ? odometer : null,
      litres: Number.isFinite(litres) ? litres : null,
      tripDistance: Number.isFinite(tripDistance) ? tripDistance : null,
      depot: get('depot'),
      pricePerLitre: Number.isFinite(pricePerLitre) ? pricePerLitre : null,
      assetType: get('assetType'),
      sourceNote: get('sourceNote'),
      raw: headerRow.reduce<Record<string, string>>((acc, header, i) => ({ ...acc, [header]: cells[i] || '' }), {}),
      lineNumber: index + 2,
    };
  });
};

export const getBranchForDepot = (depot: string): Branch => {
  if (/DBN/i.test(depot)) return 'FBN DBN';
  if (/JHB/i.test(depot)) return 'FBN JHB';
  if (/CPT/i.test(depot)) return 'FBN CPT';
  if (/LOADMASTER/i.test(depot)) return 'LOADMASTER';
  return 'FBN DBN';
};

export const mapRowToVehicle = (row: ParsedFuelCsvRow, vehicles: Vehicle[]) => {
  // First check explicit CSV vehicle mapping
  const mappedVehicleId = getCsvVehicleMapping(normalizeReg(row.registration));
  if (mappedVehicleId) {
    const vehicle = vehicles.find(v => v.id === mappedVehicleId);
    if (vehicle) return vehicle;
  }

  // Fall back to fuzzy registration matching
  const candidates = vehicles
    .map(vehicle => ({
      vehicle,
      score: compareRegistration(row.registration, vehicle.registration || vehicle.name || vehicle.id || '') ? 1 : 0,
    }))
    .filter(x => x.score > 0);

  if (candidates.length === 0) return null;
  return candidates[0].vehicle;
};

export const buildPlaceholderVehicle = (row: ParsedFuelCsvRow): Omit<Vehicle, 'id'> => {
  const branch = getBranchForDepot(row.depot);
  const make = row.assetType || 'Imported';
  const model = row.assetType ? `${row.assetType}` : 'Fuel Import';
  const weightCategory = row.assetType ? `${row.assetType.charAt(0).toUpperCase()}${row.assetType.slice(1)}` : 'Imported';

  const registration = formatRegistration(row.registration);
  return {
    name: registration,
    make,
    model,
    year: 0,
    registration,
    vin: '',
    branch,
    weightCategory,
    status: 'On the road',
    purchasePrice: 0,
    currentValue: 0,
  };
};

export const buildFuelEntry = (row: ParsedFuelCsvRow, vehicleId: string): Omit<FuelEntry, 'id'> | null => {
  if (row.litres === null || row.odometer === null || !row.date) return null;
  return {
    vehicleId,
    date: row.date,
    odometer: row.odometer,
    liters: row.litres,
    tripDistance: row.tripDistance ?? undefined,
  };
};
