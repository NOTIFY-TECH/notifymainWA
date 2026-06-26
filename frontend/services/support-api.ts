import api from './api';

export interface CreateSupportTicketPayload {
  subject: string;
  message: string;
}

export async function submitSupportTicket(
  tenantId: string,
  payload: CreateSupportTicketPayload,
): Promise<{ data: { message: string } }> {
  const { data } = await api.post(`/tenants/${tenantId}/support/contact`, payload);
  return data;
}
