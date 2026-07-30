// LDBWS client — base URL/paths/params confirmed against
// backend/docs/ldbws-swagger-json.txt. Auth header name is NOT in that spec
// (it's a Rail Data Marketplace gateway concern, not the underlying
// service's own contract) — confirm LDBWS_AUTH_HEADER against the
// marketplace subscription page; see backend/docs/data-source-decisions.md.
//
// Note: GetDepartureBoard's ServiceItem has `std`/`etd` but no `atd` —
// actual departure times only exist via the separate GetServiceDetails
// call, which we don't make per-service here (see data-source-decisions.md).

export interface LdbwsServiceItem {
  rsid?: string;
  sta?: string;
  eta?: string;
  std?: string;
  etd?: string;
  operator: string;
  operatorCode: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  serviceID: string;
}

export interface LdbwsStationBoard {
  generatedAt: string;
  locationName: string;
  crs: string;
  trainServices?: LdbwsServiceItem[];
}

export interface LdbwsClientConfig {
  baseUrl: string; // e.g. https://realtime.nationalrail.co.uk/LDBWS
  apiKey: string;
  authHeader: string; // UNCONFIRMED default — see module comment above
}

export async function getDepartureBoard(config: LdbwsClientConfig, crs: string, numRows = 149): Promise<LdbwsStationBoard> {
  const url = new URL(`${config.baseUrl}/api/20220120/GetDepartureBoard/${crs}`);
  url.searchParams.set('numRows', String(numRows));
  url.searchParams.set('timeWindow', '120');

  const response = await fetch(url, {
    headers: {
      [config.authHeader]: config.apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`LDBWS GetDepartureBoard(${crs}) failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as LdbwsStationBoard;
}
