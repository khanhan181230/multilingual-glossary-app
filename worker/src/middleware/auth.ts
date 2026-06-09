import type { Env } from "../types/glossary";
import { AppError, HTTP } from "./errorHandler";

// ── Cloudflare Access JWKS endpoint ──────────────────────────────────────────
// Cloudflare publishes public keys at this URL for your Access team domain.
// Replace YOUR_TEAM_NAME with your Cloudflare Zero Trust team name.
// Find it at: dash.cloudflare.com → Zero Trust → Settings → Custom Pages

const JWKS_URL = "twilight-pine-27b6.cloudflareaccess.com";

// ── JWT structure ─────────────────────────────────────────────────────────────

interface JWTHeader {
  alg: string;
  kid: string; // Key ID — used to find the right public key in JWKS
}

interface JWTPayload {
  sub:    string;             // Subject — the user's identity
  aud:    string | string[];  // Audience — your Cloudflare Access app ID
  exp:    number;             // Expiry timestamp (Unix seconds)
  iat:    number;             // Issued-at timestamp
  email?: string;
}

// ── decodeJWT ─────────────────────────────────────────────────────────────────
// Splits and base64-decodes a JWT without verifying the signature.
// Signature is verified separately via JWKS.

function decodeJWT(token: string): {
  header:  JWTHeader;
  payload: JWTPayload;
  raw:     { header: string; payload: string; signature: string };
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError(HTTP.UNAUTHORIZED, "Invalid token format");
  }

  try {
    const header  = JSON.parse(atob(parts[0])) as JWTHeader;
    const payload = JSON.parse(atob(parts[1])) as JWTPayload;
    return {
      header,
      payload,
      raw: { header: parts[0], payload: parts[1], signature: parts[2] },
    };
  } catch {
    throw new AppError(HTTP.UNAUTHORIZED, "Token decode failed");
  }
}

// ── fetchPublicKey ────────────────────────────────────────────────────────────
// Fetches Cloudflare Access public keys and returns the one matching
// the token's key ID (kid). Used to verify the JWT was genuinely issued
// by Cloudflare Access and not forged by an attacker spoofing headers.

async function fetchPublicKey(kid: string): Promise<CryptoKey> {
  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new AppError(HTTP.SERVER_ERROR, "Failed to fetch Access public keys");
  }

  const jwks = await res.json() as { keys: (JsonWebKey & { kid?: string })[] };
  const jwk  = jwks.keys.find((k) => k.kid === kid);

  if (!jwk) {
    throw new AppError(HTTP.UNAUTHORIZED, "Signing key not found");
  }

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

// ── verifySignature ───────────────────────────────────────────────────────────
// Verifies the JWT signature against the fetched public key.
// This is the step that blocks all header-spoofing attacks.

async function verifySignature(
  raw: { header: string; payload: string; signature: string },
  publicKey: CryptoKey
): Promise<boolean> {
  const signedData = new TextEncoder().encode(`${raw.header}.${raw.payload}`);

  const signature = Uint8Array.from(
    atob(raw.signature.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
}

// ── requireAuth ───────────────────────────────────────────────────────────────
// The main auth gate. Call this at the top of every admin route handler.
// Throws AppError if auth fails — withErrorHandler catches it and returns 401.
//
// Validates:
//   1. CF-Access-JWT-Assertion header is present
//   2. JWT decodes cleanly
//   3. Token is not expired
//   4. Signature is valid against Cloudflare Access public keys
//
// Usage:
//   await requireAuth(request, env);
//   // If this line is reached, the request is authenticated

export async function requireAuth(
  request: Request,
  _env: Env
): Promise<JWTPayload> {
  // 1. Extract token from the Cloudflare Access header
  const token = request.headers.get("CF-Access-JWT-Assertion");
  if (!token) {
    throw new AppError(HTTP.UNAUTHORIZED, "Missing authentication token");
  }

  // 2. Decode JWT structure
  const { header, payload, raw } = decodeJWT(token);

  // 3. Check expiry before hitting the network for keys
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new AppError(HTTP.UNAUTHORIZED, "Token has expired");
  }

  // 4. Verify audience matches your Cloudflare Access application
const aud = "388fb20bf7720f6dbee79cff0ccc922c906d7be8356577a25b5243529e39dd41";
const audClaim = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
if (!audClaim.includes(aud)) {
  throw new AppError(HTTP.UNAUTHORIZED, "Token audience mismatch");
}

  // 5. Fetch the matching public key
  const publicKey = await fetchPublicKey(header.kid);

  // 6. Verify the signature — this is what blocks spoofed headers
  const valid = await verifySignature(raw, publicKey);
  if (!valid) {
    throw new AppError(HTTP.UNAUTHORIZED, "Token signature invalid");
  }

  return payload;
}

// ── isAdminRoute ──────────────────────────────────────────────────────────────
// Returns true if the path requires authentication.
// GET /glossary/* is public — all other write routes are protected.

export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/sync");
}