import { TokenDatabase } from "./database.ts";
import { MinAIProxy } from "./proxy.ts";
import { config, verifyAuthSecret } from "./config.ts";
import type { ChatCompletionRequest } from "./types.ts";
import { serveDir } from "@std/http/file-server";
import { getOpenAIModels } from "./models.ts";

// 初始化数据库和代理
const db = await TokenDatabase.init();
const proxy = new MinAIProxy(db);

// 启动自动清理过期 token 的定时任务
setInterval(async () => {
  const count = await db.autoDisableExpiredTokens();
  if (count > 0) {
    console.log(`[Auto Cleanup] Disabled ${count} expired tokens`);
  }
}, config.autoCleanupInterval);

/**
 * 处理请求的主函数
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS 处理
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // OpenAI 兼容的聊天完成端点
  if (path === "/v1/chat/completions" && req.method === "POST") {
    try {
      const body = await req.json() as ChatCompletionRequest;
      const authHeader = req.headers.get("Authorization");

      if (body.stream) {
        // 流式响应
        const result = await proxy.handleStreamingChatCompletion(body, authHeader);
        
        if ("error" in result) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(result, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        // 非流式响应
        const result = await proxy.handleChatCompletion(body, authHeader);
        
        if ("error" in result) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(result), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Invalid request: ${error}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 管理 API - 需要认证秘钥
  const authHeader = req.headers.get("Authorization");
  
  // 管理 API：添加 token
  if (path === "/admin/tokens" && req.method === "POST") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await req.json() as { token: string; note: string };
      await db.addToken(body.token, body.note || "");
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Failed to add token: ${error}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 管理 API：列出所有 tokens
  if (path === "/admin/tokens" && req.method === "GET") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tokens = await db.listTokens();
    return new Response(JSON.stringify({ tokens }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 管理 API：禁用 token
  if (path.startsWith("/admin/tokens/") && path.endsWith("/disable") && req.method === "POST") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = decodeURIComponent(path.split("/")[3]);
    const success = await db.disableToken(token);
    
    return new Response(JSON.stringify({ success }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 管理 API：启用 token
  if (path.startsWith("/admin/tokens/") && path.endsWith("/enable") && req.method === "POST") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = decodeURIComponent(path.split("/")[3]);
    try {
      const success = await db.enableToken(token);
      return new Response(JSON.stringify({ success }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `${error}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 管理 API：删除 token
  if (path.startsWith("/admin/tokens/") && req.method === "DELETE") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = decodeURIComponent(path.split("/")[3]);
    const success = await db.deleteToken(token);
    
    return new Response(JSON.stringify({ success }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 管理 API：更新 token 备注
  if (path.startsWith("/admin/tokens/") && path.endsWith("/note") && req.method === "PUT") {
    if (!verifyAuthSecret(authHeader)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = decodeURIComponent(path.split("/")[3]);
    const body = await req.json() as { note: string };
    const success = await db.updateNote(token, body.note);
    
    return new Response(JSON.stringify({ success }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 健康检查端点
  if (path === "/health" && req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // OpenAI 兼容的模型列表端点
  if (path === "/v1/models" && req.method === "GET") {
    try {
      const models = await getOpenAIModels();
      return new Response(
        JSON.stringify({
          object: "list",
          data: models,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Failed to load models: ${error}` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // 静态文件服务（前端管理页面）
  if (req.method === "GET") {
    try {
      return await serveDir(req, {
        fsRoot: "public",
        urlRoot: "",
        showDirListing: false,
        enableCors: true,
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  // 404
  return new Response("Not Found", { status: 404 });
}

// 启动服务器
console.log(`🚀 1min.ai Proxy Server starting on port ${config.port}`);
console.log(`📝 OpenAI API endpoint: http://localhost:${config.port}/v1/chat/completions`);
console.log(`🔧 Admin API endpoint: http://localhost:${config.port}/admin/tokens`);
console.log(`🔑 Auth secret configured: ${config.authSecret !== "your-secret-key-here"}`);

Deno.serve({ port: config.port }, handleRequest);