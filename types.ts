// Token 相关类型定义
export interface TokenData {
  token: string;
  note: string;
  createdAt: number;
  disabled: boolean;
  expiresAt?: number;
  userInfo?: UserInfo; // 缓存的用户信息
}

// 用户信息类型
export interface UserInfo {
  teamId: string;
  userId?: string;
  userName?: string;
  cachedAt: number; // 缓存时间
}

// JWT Payload 类型
export interface JWTPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

// OpenAI Chat 请求类型
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text: string }>;
}

// OpenAI Chat 响应类型
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}