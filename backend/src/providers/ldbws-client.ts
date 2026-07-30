// LDBWS client — confirmed against a real call to the subscribed Rail Data
// Marketplace product, not just the OpenAPI spec (backend/docs/ldbws-swagger-json.txt).
//
// Uses GetArrDepBoardWithDetails, not the plain GetDepartureBoard originally
// planned: this subscription's gateway only routes the WithDetails variant
// (GetDepartureBoard 500s on it). Tradeoff accepted as a result: the row cap
// is ~10 regardless of `numRows` requested (not the ~149 the reference PDF
// suggested for the plain endpoint — that number doesn't apply here). The
// extra calling-point/origin/destination detail WithDetails adds over the
// plain endpoint is simply ignored; LdbwsServiceItem only models the fields
// this app actually reads. See backend/docs/data-source-decisions.md.
//
// Confirmed live: std/etd (and sta/eta) come back as "HH:mm", and etd/eta
// are sometimes a status string like "On time" instead of a time.
//
// Auth header name is NOT in the OpenAPI spec (it's a Rail Data Marketplace
// gateway concern, not the underlying service's own contract) — confirmed
// live as x-apikey.
//
// Still no atd/ata on this response either — actual departure/arrival times
// only exist via the separate GetServiceDetails call, which we don't make
// per-service here (see data-source-decisions.md).

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
  baseUrl: string; // subscription-specific Rail Data Marketplace gateway URL — see backend/.env.example
  apiKey: string;
  authHeader: string; // confirmed: x-apikey
}

export async function getDepartureBoard(config: LdbwsClientConfig, crs: string, numRows = 149): Promise<LdbwsStationBoard> {
  const url = new URL(`${config.baseUrl}/api/20220120/GetArrDepBoardWithDetails/${crs}`);
  url.searchParams.set('numRows', String(numRows)); // server caps at ~10 regardless — see module comment
  url.searchParams.set('timeWindow', '120');

  const response = await fetch(url, {
    headers: {
      [config.authHeader]: config.apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    // Includes the URL (safe — the API key is a header, never part of the
    // URL) and a snippet of the response body, not just the status code:
    // a bare "500 Internal Server Error" gave no way to tell a malformed
    // URL/header apart from a genuine upstream outage when this first hit
    // production. Never worked from one environment and not another
    // without this extra detail.
    const bodySnippet = await response.text().then(
      (text) => text.slice(0, 500),
      () => '<unreadable body>',
    );
    throw new Error(
      `LDBWS GetArrDepBoardWithDetails(${crs}) failed: ${response.status} ${response.statusText} — url: ${url.toString()} — body: ${bodySnippet}`,
    );
  }

  return (await response.json()) as LdbwsStationBoard;
}
