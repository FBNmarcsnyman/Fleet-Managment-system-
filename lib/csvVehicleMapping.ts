/**
 * CSV-to-Fleet Vehicle Mapping
 * Maps external CSV registration formats to actual fleet vehicle IDs.
 * Used to match fuel import records to existing vehicles.
 */

export const CSV_VEHICLE_MAPPING: Record<string, string> = {
  // FBN_FUEL_IMPORT.csv registrations -> fleet vehicle IDs
  '12RLZN': 'v1',      // 12 RL ZN -> JHB-TRUCK-01 (JHB 01 GP)
  '42XYZN': 'v3',      // 42 XY ZN -> DBN-RIGID-01 (DBN 01 KZN)
  '74PDZN': 'v1',      // 74 PD ZN -> JHB-TRUCK-01 (or create placeholder)
};

export const getCsvVehicleMapping = (normalizedReg: string): string | undefined => {
  return CSV_VEHICLE_MAPPING[normalizedReg];
};
