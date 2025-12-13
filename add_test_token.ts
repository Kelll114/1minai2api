import { TokenDatabase } from "./database.ts";

// 示例 JWT token（这是一个示例，实际使用时需要真实的 1min.ai token）
const testToken = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZpc2l0b3ItYXBwbGljYXRpb24tc2VydmVyLTIwMjEwMjIifQ.eyJzdWIiOiJ1c2VyLTEyMzQ1IiwiaWF0IjoxNzM0MDc0MDAwLCJleHAiOjE3MzQxNjA0MDAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.signature";

async function addTestToken() {
  console.log("正在初始化数据库...");
  const db = await TokenDatabase.init();
  
  try {
    console.log("正在添加测试 token...");
    await db.addToken(testToken, "测试 Token - 请替换为真实 token");
    console.log("测试 token 添加成功！");
    
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

addTestToken();