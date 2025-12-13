import type { TokenData, UserInfo } from "./types.ts";
import { validateToken } from "./jwt.ts";

/**
 * Token 数据库管理类
 */
export class TokenDatabase {
  private kv: Deno.Kv;

  private constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  /**
   * 初始化数据库
   */
  static async init(): Promise<TokenDatabase> {
    const kv = await Deno.openKv();
    return new TokenDatabase(kv);
  }

  /**
   * 添加或更新 token
   * @param token JWT token 字符串
   * @param note 备注信息
   */
  async addToken(token: string, note: string): Promise<boolean> {
    const validation = validateToken(token);
    
    if (!validation.valid) {
      throw new Error("Invalid token format");
    }

    const tokenData: TokenData = {
      token,
      note,
      createdAt: Date.now(),
      disabled: validation.expired,
      expiresAt: validation.payload?.exp ? validation.payload.exp * 1000 : undefined,
    };

    await this.kv.set(["tokens", token], tokenData);
    return true;
  }

  /**
   * 获取 token 信息
   * @param token JWT token 字符串
   */
  async getToken(token: string): Promise<TokenData | null> {
    const result = await this.kv.get<TokenData>(["tokens", token]);
    return result.value;
  }

  /**
   * 禁用 token
   * @param token JWT token 字符串
   */
  async disableToken(token: string): Promise<boolean> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    tokenData.disabled = true;
    await this.kv.set(["tokens", token], tokenData);
    return true;
  }

  /**
   * 启用 token
   * @param token JWT token 字符串
   */
  async enableToken(token: string): Promise<boolean> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    // 检查是否已过期
    const validation = validateToken(token);
    if (validation.expired) {
      throw new Error("Cannot enable expired token");
    }

    tokenData.disabled = false;
    await this.kv.set(["tokens", token], tokenData);
    return true;
  }

  /**
   * 删除 token
   * @param token JWT token 字符串
   */
  async deleteToken(token: string): Promise<boolean> {
    await this.kv.delete(["tokens", token]);
    return true;
  }

  /**
   * 列出所有 tokens
   */
  async listTokens(): Promise<TokenData[]> {
    const tokens: TokenData[] = [];
    const iter = this.kv.list<TokenData>({ prefix: ["tokens"] });
    
    for await (const entry of iter) {
      tokens.push(entry.value);
    }
    
    return tokens;
  }

  /**
   * 检查并自动禁用过期的 tokens
   */
  async autoDisableExpiredTokens(): Promise<number> {
    let count = 0;
    const tokens = await this.listTokens();
    
    for (const tokenData of tokens) {
      if (!tokenData.disabled) {
        const validation = validateToken(tokenData.token);
        if (validation.expired) {
          await this.disableToken(tokenData.token);
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * 验证 token 是否可用（未禁用且未过期）
   * @param token JWT token 字符串
   */
  async isTokenValid(token: string): Promise<boolean> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    if (tokenData.disabled) {
      return false;
    }

    const validation = validateToken(token);
    if (validation.expired) {
      // 自动禁用过期 token
      await this.disableToken(token);
      return false;
    }

    return true;
  }

  /**
   * 更新 token 备注
   * @param token JWT token 字符串
   * @param note 新的备注
   */
  async updateNote(token: string, note: string): Promise<boolean> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    tokenData.note = note;
    await this.kv.set(["tokens", token], tokenData);
    return true;
  }

  /**
   * 缓存用户信息到 token
   * @param token JWT token 字符串
   * @param userInfo 用户信息
   */
  async cacheUserInfo(token: string, userInfo: UserInfo): Promise<boolean> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    tokenData.userInfo = {
      ...userInfo,
      cachedAt: Date.now(),
    };
    await this.kv.set(["tokens", token], tokenData);
    return true;
  }

  /**
   * 获取缓存的用户信息
   * @param token JWT token 字符串
   * @param maxAge 最大缓存时间（毫秒），默认 1 小时
   */
  async getCachedUserInfo(token: string, maxAge = 3600000): Promise<UserInfo | null> {
    const tokenData = await this.getToken(token);
    
    if (!tokenData || !tokenData.userInfo) {
      return null;
    }

    const age = Date.now() - tokenData.userInfo.cachedAt;
    if (age > maxAge) {
      return null; // 缓存过期
    }

    return tokenData.userInfo;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.kv.close();
  }
}