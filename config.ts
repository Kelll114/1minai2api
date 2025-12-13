/**
 * 项目配置
 */
export const config = {
  // 服务器端口
  port: parseInt(Deno.env.get("PORT") || "8000"),
  
  // 本项目的认证秘钥（用于管理 API）
  authSecret: Deno.env.get("AUTH_SECRET") || "your-secret-key-here",
  
  // Claude API 配置
  claudeApiUrl: "https://api.anthropic.com/v1/messages",
  claudeApiVersion: "2023-06-01",
  
  // 自动清理过期 token 的间隔（毫秒）
  autoCleanupInterval: 60 * 60 * 1000, // 1 小时
};

/**
 * 验证管理 API 的认证
 */
export function verifyAuthSecret(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === config.authSecret;
}