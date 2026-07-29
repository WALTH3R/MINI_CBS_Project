/** Decodes a JWT's payload segment without verifying the signature — verification is the API's job. */
export function decodeJwtPayload<T>(token: string): T | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 10): boolean {
  const claims = decodeJwtPayload<{ exp: number }>(token);
  if (!claims) {
    return true;
  }
  return Date.now() >= (claims.exp - skewSeconds) * 1000;
}
