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
    if (!authHeader) {
      return null;
    }

    const providedSecret = authHeader.replace(/^Bearer\s+/i, "");
    
    // 验证是否为正确的 AUTH_SECRET
    if (providedSecret !== config.authSecret) {
      return null;
    }
    
    // 从数据库获取所有可用的 token
    const tokens = await this.db.listTokens();
    const activeTokens = tokens.filter(t => !t.disabled && !this.isTokenExpired(t));
    
    if (activeTokens.length === 0) {
      return null;
    }
    
    // 随机选择一个可用的 token
    const randomIndex = Math.floor(Math.random() * activeTokens.length);
    return activeTokens[randomIndex].token;
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
    // 先尝试从缓存获取
    const cached = await this.db.getCachedUserInfo(token);
    if (cached) {
      return cached;
    }

    // 缓存未命中，从 API 获取
    try {
      const response = await fetch(`${this.baseUrl}/users`, {
        headers: {
          "x-auth-token": `Bearer ${token}`,
          "accept": "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      // 解析用户信息
      const teamId = data.teams?.[0]?.uuid || data.teamId;
      if (!teamId) {
        return null;
      }

      const userInfo: UserInfo = {
        teamId,
        userId: data.uuid || data.userId,
        userName: data.name || data.userName,
        cachedAt: Date.now(),
      };

      // 缓存到数据库
      await this.db.cacheUserInfo(token, userInfo);

      return userInfo;
    } catch (_error) {
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
    // 简单实现：提取最后一条用户消息
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return "Hello";
    }
    return userMessages[userMessages.length - 1].content;
  }

  /**
   * 映射模型名称
   */
  private mapModel(model: string): string {
    const modelMap: Record<string, string> = {
      "gpt-4": "claude-opus-4-1-20250805",
      "gpt-4o": "claude-opus-4-1-20250805",
      "gpt-3.5-turbo": "claude-sonnet-3-5-20240229",
      "claude-3-opus": "claude-opus-4-1-20250805",
      "claude-3-sonnet": "claude-sonnet-3-5-20240229",
    };

    return modelMap[model] || "claude-opus-4-1-20250805";
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
    const chatId = `chatcmpl-${Date.now()}`;

    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: content")) {
              continue;
            }
            if (line.startsWith("data: ")) {
              const data = line.substring(6);
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