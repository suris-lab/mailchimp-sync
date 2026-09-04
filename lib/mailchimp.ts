/**
 * Mailchimp API keys end with their data-center name, e.g. `…-us19`.
 * Prefer that authoritative suffix over a separately configured prefix so a
 * key rotation cannot silently point requests to the previous data centre.
 */
export function getMailchimpServerPrefix(): string {
  const apiKey = process.env.MAILCHIMP_API_KEY?.trim() ?? "";
  const dataCenter = apiKey.match(/-([a-z]{2,}\d+)$/i)?.[1]?.toLowerCase();
  return dataCenter ?? process.env.MAILCHIMP_SERVER_PREFIX?.trim() ?? "us1";
}
