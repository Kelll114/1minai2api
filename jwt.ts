import { decodeBase64Url } from "@std/encoding/base64url";
import type { JWTPayload } from "./types.ts";

/**
 * 解析 JWT Token
 * @param token JWT token 字符串
 * @returns 解析后的 payload
 */
export function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = new TextDecoder().decode(decodeBase64Url(payload));
    return JSON.parse(decoded) as JWTPayload;
  } catch (_error) {
    return null;
  }
}

/**
 * 检查 token 是否过期
 * @param payload JWT payload
 * @returns 是否过期
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  if (!payload.exp) {
    return false; // 没有过期时间则认为不过期
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * 验证 token 格式和有效性
 * @param token JWT token 字符串
 * @returns 验证结果
 */
export function validateToken(token: string): {
  valid: boolean;
  expired: boolean;
  payload: JWTPayload | null;
} {
  const payload = parseJWT(token);
  
  if (!payload) {
    return {
      valid: false,
      expired: false,
      payload: null,
    };
  }

  const expired = isTokenExpired(payload);

  return {
    valid: true,
    expired,
    payload,
  };
}