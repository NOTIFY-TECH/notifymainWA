// Documents the expected CSV row shape — no class-validator needed
export interface ImportContactRow {
  name: string;
  phoneNumber: string;
  email?: string;
  tags?: string; // comma-separated in cell, e.g. "vip,loyal"
}

export interface ImportContactsResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}
