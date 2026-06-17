const ACCESS_TOKEN_KEY = "mundra_access_token";
const AUTH_TOKEN_CHANGE_EVENT = "mundra_auth_token_change";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGE_EVENT));
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGE_EVENT));
}

export function getAuthTokenChangeEventName() {
  return AUTH_TOKEN_CHANGE_EVENT;
}
