import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, UserInfo } from "./types.ts";
import { TokenDatabase } from "./database.ts";
import { config } from "./config.ts";

/**
 * 1min.ai API 代理类
 */
export class MinAIProxy {
  private db: TokenDatabase;
  private baseUrl = "https://api.1min.ai";

  constructor(db: TokenDatabase) {
    this.db = db;
  }

  /**
   * 验证 AUTH_SECRET 并从数据库随机获取可用 token
   */
  private async getValidToken(authHeader: string | null): Promise<string | null> {
    console.log("[DEBUG] getValidToken called with authHeader:", authHeader ? "present" : "missing");
    
    if (!authHeader) {
      console.log("[DEBUG] No auth header provided");
      return null;
    }

    const providedSecret = authHeader.replace(/^Bearer\s+/i, "");
    console.log("[DEBUG] Provided secret:", providedSecret);
    console.log("[DEBUG] Expected secret:", config.authSecret);
    
    // 验证是否为正确的 AUTH_SECRET
    if (providedSecret !== config.authSecret) {
      console.log("[DEBUG] AUTH_SECRET validation failed");
      return null;
    }
    
    // 从数据库获取所有可用的 token
    const tokens = await this.db.listTokens();
    console.log("[DEBUG] Total tokens in database:", tokens.length);
    
    const activeTokens = tokens.filter(t => !t.disabled && !this.isTokenExpired(t));
    console.log("[DEBUG] Active tokens count:", activeTokens.length);
    
    if (activeTokens.length === 0) {
      console.log("[DEBUG] No active tokens available");
      return null;
    }
    
    // 随机选择一个可用的 token
    const randomIndex = Math.floor(Math.random() * activeTokens.length);
    const selectedToken = activeTokens[randomIndex].token;
    console.log("[DEBUG] Selected token (first 20 chars):", selectedToken.substring(0, 20) + "...");
    return selectedToken;
  }

  /**
   * 检查 token 是否过期
   */
  private isTokenExpired(tokenData: any): boolean {
    if (!tokenData.expiresAt) {
      return false;
    }
    return tokenData.expiresAt < Date.now();
  }

  /**
   * 获取用户信息以获取 teamId（带缓存）
   */
  private async getUserInfo(token: string): Promise<UserInfo | null> {
    console.log("[DEBUG] getUserInfo called for token:", token.substring(0, 20) + "...");
    
    // 先尝试从缓存获取
    const cached = await this.db.getCachedUserInfo(token);
    if (cached) {
      console.log("[DEBUG] Using cached user info for teamId:", cached.teamId);
      return cached;
    }

    console.log("[DEBUG] Cache miss, fetching from API...");
    // 缓存未命中，从 API 获取
    try {
      const response = await fetch(`${this.baseUrl}/users`, {
        headers: {
          "x-auth-token": `Bearer ${token}`,
          "accept": "application/json",
        },
      });

      console.log("[DEBUG] API response status:", response.status);
      if (!response.ok) {
        console.log("[DEBUG] API request failed with status:", response.status);
        const errorText = await response.text();
        console.log("[DEBUG] Error response:", errorText);
        return null;
      }

      const data = await response.json();
      console.log("[DEBUG] API response data:", JSON.stringify(data, null, 2));
      
      // 解析用户信息 - 根据实际 API 响应结构
      const teamId = data.user?.teams?.[0]?.teamId ||
                    data.teams?.[0]?.teamId ||
                    data.teams?.[0]?.uuid ||
                    data.teamId;
      
      if (!teamId) {
        console.log("[DEBUG] No teamId found in response");
        return null;
      }

      console.log("[DEBUG] Found teamId:", teamId);
      const userInfo: UserInfo = {
        teamId,
        userId: data.user?.uuid || data.uuid || data.userId,
        userName: data.user?.teams?.[0]?.userName || data.name || data.userName,
        cachedAt: Date.now(),
      };

      // 缓存到数据库
      await this.db.cacheUserInfo(token, userInfo);
      console.log("[DEBUG] User info cached successfully");

      return userInfo;
    } catch (error) {
      console.log("[DEBUG] Error in getUserInfo:", error);
      return null;
    }
  }

  /**
   * 创建对话
   */
  private async createConversation(
    token: string,
    teamId: string,
    title: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/teams/${teamId}/features/conversations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-auth-token": `Bearer ${token}`,
            "accept": "application/json",
          },
          body: JSON.stringify({
            type: "CHAT_WITH_AI",
            title: title || "New Chat",
            fileList: [],
            youtubeUrl: "",
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.conversation?.uuid || null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 转换 OpenAI messages 到 1min.ai prompt
   */
  private convertMessages(messages: ChatMessage[]): string {
    // 将所有消息转换为 {role}:\n{content} 格式
    const formattedMessages = messages.map((message) => {
      let content: string;
      
      // 处理 content 为数组的情况
      if (Array.isArray(message.content)) {
        // 提取所有 text 内容并连接
        content = message.content
          .filter(item => item.type === 'text' && item.text)
          .map(item => item.text)
          .join('\n');
      } else {
        // content 为字符串的情况
        content = message.content;
      }
      
      return `${message.role}:\n${content}`;
    });
    
    // 用换行符连接所有消息
    return formattedMessages.join('\n\n');
  }

  /**
   * 映射模型名称 - 直接使用客户端传入的模型名称
   * 如果模型名称在 models.json 中不存在，则使用默认模型
   */
  private mapModel(model: string): string {
    // 常见的 OpenAI 模型映射到 1min.ai 的对应模型
    const modelMap: Record<string, string> = {
      "gpt-4": "gpt-5",
      "gpt-4o": "gpt-5",
      "gpt-4-turbo": "gpt-5.1",
      "gpt-3.5-turbo": "gpt-5-mini",
      "claude-3-opus": "claude-opus-4-1-20250805",
      "claude-3-sonnet": "claude-sonnet-4-20250514",
      "claude-3-haiku": "claude-3-haiku-20240307",
    };

    // 如果有映射则使用映射，否则直接使用原始模型名称
    return modelMap[model] || model;
  }

  /**
   * 处理聊天完成请求（非流式）
   */
  async handleChatCompletion(
    request: ChatCompletionRequest,
    authHeader: string | null
  ): Promise<ChatCompletionResponse | { error: string; status: number }> {
    const token = await this.getValidToken(authHeader);
    if (!token) {
      return { error: "Invalid or expired token", status: 401 };
    }

    const userInfo = await this.getUserInfo(token);
    if (!userInfo) {
      return { error: "Failed to get user info", status: 500 };
    }

    const prompt = this.convertMessages(request.messages);
    const conversationId = await this.createConversation(
      token,
      userInfo.teamId,
      prompt.substring(0, 50)
    );

    if (!conversationId) {
      return { error: "Failed to create conversation", status: 500 };
    }

    const model = this.mapModel(request.model);

    try {
      const response = await fetch(
        `${this.baseUrl}/teams/${userInfo.teamId}/features/sse?isStreaming=false`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-auth-token": `Bearer ${token}`,
            "accept": "application/json",
          },
          body: JSON.stringify({
            type: "CHAT_WITH_AI",
            conversationId,
            model,
            promptObject: {
              prompt,
              imageList: [],
              isMixed: false,
              webSearch: false,
              youtubeUrl: "",
              numOfSite: 2,
              maxWord: 1000,
              memory: false,
              historyMessageLimit: 8,
            },
            metadata: {
              messageGroup: `${Date.now()}_${Math.floor(Math.random() * 100)}`,
            },
          }),
        }
      );

      if (!response.ok) {
        return { error: "Failed to get response from 1min.ai", status: response.status };
      }

      const data = await response.json();
      const content = data.aiRecordDetail?.resultObject?.[0] || "";

      // 转换为 OpenAI 格式
      return {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: data.aiRecord?.metadata?.inputToken || 0,
          completion_tokens: data.aiRecord?.metadata?.outputToken || 0,
          total_tokens:
            (data.aiRecord?.metadata?.inputToken || 0) +
            (data.aiRecord?.metadata?.outputToken || 0),
        },
      };
    } catch (error) {
      return { error: `Request failed: ${error}`, status: 500 };
    }
  }

  /**
   * 处理流式聊天完成请求
   */
  async handleStreamingChatCompletion(
    request: ChatCompletionRequest,
    authHeader: string | null
  ): Promise<ReadableStream | { error: string; status: number }> {
    const token = await this.getValidToken(authHeader);
    if (!token) {
      return { error: "Invalid or expired token", status: 401 };
    }

    const userInfo = await this.getUserInfo(token);
    if (!userInfo) {
      return { error: "Failed to get user info", status: 500 };
    }

    const prompt = this.convertMessages(request.messages);
    const conversationId = await this.createConversation(
      token,
      userInfo.teamId,
      prompt.substring(0, 50)
    );

    if (!conversationId) {
      return { error: "Failed to create conversation", status: 500 };
    }

    const model = this.mapModel(request.model);

    try {
      const response = await fetch(
        `${this.baseUrl}/teams/${userInfo.teamId}/features/sse?isStreaming=true`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-auth-token": `Bearer ${token}`,
            "accept": "text/event-stream",
          },
          body: JSON.stringify({
            type: "CHAT_WITH_AI",
            conversationId,
            model,
            promptObject: {
              prompt,
              imageList: [],
              isMixed: false,
              webSearch: false,
              youtubeUrl: "",
              numOfSite: 2,
              maxWord: 1000,
              memory: false,
              historyMessageLimit: 8,
            },
            metadata: {
              messageGroup: `${Date.now()}_${Math.floor(Math.random() * 100)}`,
            },
          }),
        }
      );

      if (!response.ok || !response.body) {
        return { error: "Failed to get streaming response", status: response.status };
      }

      // 转换 SSE 流为 OpenAI 格式
      return this.transformSSEToOpenAI(response.body, request.model);
    } catch (error) {
      return { error: `Streaming request failed: ${error}`, status: 500 };
    }
  }

  /**
   * 转换 1min.ai SSE 流为 OpenAI 格式
   */
  private transformSSEToOpenAI(
    stream: ReadableStream<Uint8Array>,
    model: string
  ): ReadableStream {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let eventType = "";
    const chatId = `chatcmpl-${Date.now()}`;

    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

              // console.log(value);
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
              console.log(line);
            // 检测 event 类型
            if (line.startsWith("event: ")) {
              eventType = line.substring(7).trim();
              
              // 当收到 event: done 时，检查下一行的 data
              if (eventType === "done" || eventType === 'result') {
                continue;
              }
            }
            
            if (line.startsWith("data: ")) {
              const data = line.substring(6);
              // 如果是 done 事件的数据
              if (eventType === "done" || eventType ==='result') {
                try {
                  // const parsed = JSON.parse(data);
                  if (true) {
                    // 发送 [DONE] 并断开连接
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    reader.cancel();
                    return;
                  }
                } catch (_e) {
                  // 忽略解析错误
                }
                eventType = ""; // 重置事件类型
                continue;
              }
              
              // 跳过 content 事件标记行
              if (eventType === "content") {
                eventType = ""; // 重置事件类型
              }
              
              // 解析普通内容数据
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  // 转换为 OpenAI 格式
                  const openaiChunk = {
                    id: chatId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          content: parsed.content,
                        },
                        finish_reason: null,
                      },
                    ],
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                  );
                } else {
                                  try {
                  // const parsed = JSON.parse(data);
                  if (true) {
                    // 发送 [DONE] 并断开连接
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    reader.cancel();
                    return;
                  }
                } catch (_e) {
                  // 忽略解析错误
                }
                eventType = ""; // 重置事件类型
                continue;
                }
              } catch (_e) {
                // 忽略解析错误
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  }
}