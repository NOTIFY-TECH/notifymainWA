import { ApiProperty } from '@nestjs/swagger';

// ─── Row shape expected in the uploaded CSV ───────────────────────────────────
// Only phoneNumber is required. name is accepted if present but not enforced,
// matching the CampaignContact model which has no name field — it's stored on
// the linked Contact record (if one exists), not on CampaignContact itself.

export interface CampaignRecipientRow {
  phoneNumber: string;
  name?: string; // ignored during import; accepted so CSVs exported from Contacts work without stripping columns
}

// ─── Per-row error recorded during import ────────────────────────────────────

export interface RecipientImportError {
  row: number; // 1-based row number in the CSV (row 1 = header, so first data row = 2)
  reason: string;
}

// ─── Return shape from CampaignsService.importCampaignRecipients ─────────────
// and from the controller endpoint directly (no ApiResponse wrapper).

export interface ImportRecipientsResult {
  created: number;
  skipped: number;
  errors: RecipientImportError[];
}

// ─── Swagger stub ─────────────────────────────────────────────────────────────
// Used only to document the multipart file field in Swagger UI.
// Not used for class-validator input validation (file validation is done
// in the controller via the uploaded file object itself).

export class ImportRecipientsDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'CSV file with a phoneNumber column',
  })
  file: Express.Multer.File;
}
