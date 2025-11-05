export interface RFIDStatus {
  rfid_data: string;
  rfid_status: boolean;
}

export interface RFIDLog {
  time_log: string;
  rfid_data: string;
  rfid_status: boolean;
}

export interface LogsResponse {
  logs: RFIDLog[];
  total: number;
  limit: number;
  offset: number;
}

