# FBN Fleet Management System - Technical Specification

## 1. Project Overview
FBN Fleet Management is a comprehensive, full-stack React application designed to manage logistics operations, vehicle maintenance, personnel, and financial performance for a transport fleet.

## 2. Tech Stack
- **Frontend**: React 18 (Functional Components, Hooks)
- **Language**: TypeScript (Strict typing)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Visualization**: Recharts / D3 (where applicable)
- **State Management**: Multi-Context API (Domain-driven)
- **Persistence**: LocalStorage (with JSON serialization)

## 3. Architecture: Domain-Driven Contexts
The application uses a refactored, modular Context API structure to ensure performance and maintainability. All contexts are located in `/contexts/`.

### Core Contexts:
1. **RawDataContext**: The "Source of Truth". Handles the primary state object, `useReducer` logic, and `localStorage` synchronization.
2. **CommonDataContext**: Manages shared data like `users`, `notifications`, and `messages`.
3. **AuthContext**: Handles user sessions, login/logout, and granular permission checks (`hasPermission`).
4. **UIContext**: Controls global UI state, including active views, modal management, toast notifications, and online/offline status.

### Domain Contexts:
5. **FleetContext**: Manages `vehicles`, `fuelEntries`, `serviceEntries`, and `tires`. Includes complex derived data for vehicle health scores and fuel performance (CPK, consumption).
6. **OperationsContext**: Handles `clients`, `suppliers`, `quotes`, `loadConfirmations`, `manifests`, and `tripSheets`.
7. **WorkshopContext**: Manages the maintenance lifecycle: `jobCards`, `parts` inventory, and `purchaseRequests`.
8. **ManagementContext**: Focuses on high-level business logic: `budgets`, `forecasts`, `incidentReports`, and `hrCases`.

## 4. Key Data Models (Types)
Defined in `/types.ts`.

### Vehicle
- `id`, `registration`, `make`, `model`, `branch`, `status`.
- `currentOdometer`, `currentHours`, `healthScore`.

### LoadConfirmation (Logistics)
- `loadConNumber`, `clientId`, `status` (Booked -> Delivered).
- `collectionPoint`, `deliveryPoint`, `totalAmount`, `podPhoto`.

### JobCard (Maintenance)
- `vehicleId`, `type` (Repair/Service), `status` (Reported -> Resolved).
- `priority`, `severity`, `partsUsed`.

### User
- `name`, `email`, `role` (Admin, Driver, Staff, Client, Supplier).
- `permissions` (Array of access strings).

## 5. Portals & Features
- **Management Portal**: Executive dashboard with financial summaries and action centers.
- **Fleet Portal**: Real-time vehicle tracking, health monitoring, and fuel management.
- **Operations Portal**: Quote generation, load booking, driver assignment, and POD tracking.
- **Workshop Portal**: Maintenance scheduling, job card management, and inventory control.
- **Finance Portal**: Cost analysis, budget tracking, and QuickBooks integration.
- **Incident Management**: Reporting and tracking of accidents, fines, and claims.
- **HR Portal**: Driver performance tracking and disciplinary cases.

## 6. Performance Optimizations
- **Memoization**: Heavy calculations (health scores, fuel metrics) are wrapped in granular `useMemo` blocks.
- **O(1) Lookups**: Uses `Map` objects for grouping data by `vehicleId` or `userId`.
- **Lazy Loading**: Modals and heavy portal components are loaded via `React.lazy` and `Suspense`.

## 7. File Structure
- `/src/components/`: Reusable UI components and portal views.
- `/src/contexts/`: Domain-specific state providers.
- `/src/hooks/`: Custom hooks (e.g., `useServiceStatus`).
- `/src/types.ts`: Centralized TypeScript interfaces.
- `/src/constants.ts`: Global configuration and enums.
- `/App.tsx`: Main routing and modal registry.

## 8. Integration Points
- **AI Dispatch Assistant**: Uses Gemini API for optimizing load assignments.
- **AI Triage**: Automated maintenance prioritization.
- **QuickBooks**: Sync logic for financial data.
- **QR Scanning**: Standalone driver checklist flow via URL parameters.
