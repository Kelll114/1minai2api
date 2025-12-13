import { TokenDatabase } from "./database.ts";

// 创建一个有效的 JWT token（header.payload.signature）
const header = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZpc2l0b3ItYXBwbGljYXRpb24tc2VydmVyLTIwMjEwMjIifQ";
const payload = btoa(JSON.stringify({
  sub: "user-12345",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400, // 24小时后过期
  email: "test@example.com"
}));
const signature = "test-signature";

const validToken = `${header}.${payload}.${signature}`;

async function addValidToken() {
  console.log("正在初始化数据库...");
  const db = await TokenDatabase.init();
  
  try {
    console.log("正在添加有效 token...");
    console.log("Token:", validToken);
    
    await db.addToken(validToken, "有效测试 Token");
    console.log("有效 token 添加成功！");
    
    // 列出所有 tokens
    const tokens = await db.listTokens();
    console.log(`数据库中共有 ${tokens.length} 个 tokens:`);
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token.note} - ${token.disabled ? "已禁用" : "启用"} - ${token.expiresAt ? new Date(token.expiresAt).toLocaleString() : "无过期时间"}`);
    });
    
  } catch (error) {
    console.error("添加 token 失败:", error);
  } finally {
    db.close();
  }
}

addValidToken();