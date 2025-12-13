import { validateToken } from "./jwt.ts";

// 测试用户提供的 token 格式
const testToken = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZpc2l0b3ItYXBwbGljYXRpb24tc2VydmVyLTIwMjEwMjIifQ";

console.log("测试 JWT 解析...");
console.log("Token:", testToken);

const result = validateToken(testToken);
console.log("验证结果:", result);

// 创建一个完整的 JWT token 用于测试（包含 payload 和 signature）
const completeToken = testToken + ".eyJzdWIiOiJ1c2VyLTEyMzQ1IiwiaWF0IjoxNzM0MDc0MDAwLCJleHAiOjE3MzQxNjA0MDB9.signature";

console.log("\n测试完整 JWT...");
console.log("Complete Token:", completeToken);

const completeResult = validateToken(completeToken);
console.log("完整 Token 验证结果:", completeResult);