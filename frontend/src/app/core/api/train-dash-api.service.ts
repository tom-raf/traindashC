import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type {
  OperatorBreakdownResponse,
  ReliabilitySummaryResponse,
  StationCode,
  StationInfo,
  TrainOperator,
} from '@shared/types';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrainDashApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  getStations(): Observable<StationInfo[]> {
    return this.http.get<StationInfo[]>(`${this.baseUrl}/stations`);
  }

  getOperatorsForStation(station: StationCode): Observable<TrainOperator[]> {
    return this.http.get<TrainOperator[]>(`${this.baseUrl}/stations/${station}/operators`);
  }

  getReliabilitySummary(station: StationCode, from?: string, to?: string): Observable<ReliabilitySummaryResponse> {
    return this.http.get<ReliabilitySummaryResponse>(`${this.baseUrl}/stations/${station}/reliability`, {
      params: buildRangeParams(from, to),
    });
  }

  getOperatorBreakdown(station: StationCode, from?: string, to?: string): Observable<OperatorBreakdownResponse> {
    return this.http.get<OperatorBreakdownResponse>(`${this.baseUrl}/stations/${station}/operator-breakdown`, {
      params: buildRangeParams(from, to),
    });
  }
}

function buildRangeParams(from?: string, to?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (from) params['from'] = from;
  if (to) params['to'] = to;
  return params;
}
