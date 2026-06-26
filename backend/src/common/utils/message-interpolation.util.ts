/**
 * Shared message interpolation utilities.
 *
 * Supports one variable for now: {{name}}
 *
 * Resolution priority for {{name}}:
 *   1. contact.whatsappName  — the name WhatsApp itself shows for the person
 *      (captured passively from msg.pushName on inbound messages)
 *   2. contact.name          — the CRM display name set by the tenant
 *   3. phoneNumber           — bare digits fallback; always available
 */

export function resolveDisplayName(
  contact: { whatsappName?: string | null; name?: string | null } | null,
  phoneNumber: string,
): string {
  return contact?.whatsappName?.trim() || contact?.name?.trim() || phoneNumber;
}

/**
 * Replaces every occurrence of {{name}} (case-sensitive, exact token) in
 * `template` with `displayName`.  Returns the interpolated string.
 * If `template` contains no {{name}} tokens, returns it unchanged.
 */
export function interpolateMessage(
  template: string,
  displayName: string,
): string {
  return template.replace(/\{\{name\}\}/g, displayName);
}
