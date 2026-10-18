// Percent-decodes a URL segment, leaving it untouched if it isn't valid
// percent-encoding (e.g. a literal "%"). Shared by the client param hook
// and the API's storeSlug normalization — see use-decoded-params.ts.
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
