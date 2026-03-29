export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
export const DEFAULT_USER_EMAIL = "default@mindstore.local";
export const DEFAULT_USER_NAME = "Default User";

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.AUTH_SECRET,
  );
}

export function isSingleUserModeEnabled(): boolean {
  return process.env.ALLOW_SINGLE_USER_MODE !== "false";
}

export function getIdentityMode(): "google-oauth" | "single-user" | "unconfigured" {
  if (isGoogleAuthConfigured()) {
    return "google-oauth";
  }

  if (isSingleUserModeEnabled()) {
    return "single-user";
  }

  return "unconfigured";
}
