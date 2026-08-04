import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, isTokenExpired } from './jwt.util';

function fakeToken(payload: Record<string, unknown>): string {
  const base64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${base64}.signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes a well-formed token payload', () => {
    const token = fakeToken({ user_id: 'abc-123', role: 'AGENT' });
    expect(decodeJwtPayload(token)).toEqual({ user_id: 'abc-123', role: 'AGENT' });
  });

  it('returns null for a token that does not have three segments', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('returns null for a token whose payload segment is not valid base64/JSON', () => {
    expect(decodeJwtPayload('header.not-valid-base64!!!.signature')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('treats a token with exp in the past as expired', () => {
    const token = fakeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('treats a token with exp well in the future as not expired', () => {
    const token = fakeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('applies the skew so a token expiring within the skew window counts as expired', () => {
    const token = fakeToken({ exp: Math.floor(Date.now() / 1000) + 5 });
    expect(isTokenExpired(token, 10)).toBe(true);
    expect(isTokenExpired(token, 1)).toBe(false);
  });

  it('treats an undecodable token as expired', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });
});
