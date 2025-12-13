/**
 * 模型管理模块
 */

interface MinAIModel {
  uuid: string;
  modelId: string;
  name: string;
  group: string;
  provider: string;
  status: string;
  cutoffDate: string;
  features: string[];
  creditMetadata: {
    INPUT: number;
    OUTPUT: number;
    CONTEXT: number;
    MAX_OUTPUT_TOKEN: number;
  };
  information: string;
  numberOfStars: number;
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * 加载 models.json 文件
 */
export async function loadModels(): Promise<MinAIModel[]> {
  try {
    const text = await Deno.readTextFile("models.json");
    const data = JSON.parse(text);
    return data.models || [];
  } catch (error) {
    console.error("Failed to load models.json:", error);
    return [];
  }
}

/**
 * 将 1min.ai 模型转换为 OpenAI 格式
 */
export function convertToOpenAIFormat(model: MinAIModel): OpenAIModel {
  // 使用模型创建时间或当前时间戳
  const created = model.createdAt 
    ? Math.floor(new Date(model.createdAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  return {
    id: model.modelId,
    object: "model",
    created,
    owned_by: model.provider,
  };
}

/**
 * 获取所有激活的模型（OpenAI 格式）
 */
export async function getOpenAIModels(): Promise<OpenAIModel[]> {
  const models = await loadModels();
  
  // 只返回状态为 ACTIVE 的模型
  const activeModels = models.filter(m => m.status === "ACTIVE");
  
  return activeModels.map(convertToOpenAIFormat);
}

/**
 * 根据 modelId 查找模型
 */
export async function findModelById(modelId: string): Promise<MinAIModel | null> {
  const models = await loadModels();
  return models.find(m => m.modelId === modelId) || null;
}