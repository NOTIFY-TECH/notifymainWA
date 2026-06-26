import { useMutation } from '@tanstack/react-query';
import { submitSupportTicket, CreateSupportTicketPayload } from '@/services/support-api';

export function useSubmitSupportTicket(tenantId: string) {
  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) => submitSupportTicket(tenantId, payload),
  });
}
