// ─── Contact Types ────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  tenantId: string;
  phone: string;
  name?: string;
  email?: string;
  tags: string[];
  notes?: string;
  isBlocked: boolean;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactRequest {
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateContactRequest {
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  isBlocked?: boolean;
}

export interface ContactImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}
