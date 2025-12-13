async function testAPI() {
  try {
    console.log("测试 API 连接...");
    
    // 测试健康检查
    const healthResponse = await fetch("http://localhost:8000/health");
    console.log("健康检查:", await healthResponse.json());
    
    // 测试模型列表
    const modelsResponse = await fetch("http://localhost:8000/v1/models");
    console.log("模型列表:", await modelsResponse.json());
    
    // 测试聊天完成
    const chatResponse = await fetch("http://localhost:8000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 1min-ai-secret-key-2024"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
      })
    });
    
    console.log("聊天响应状态:", chatResponse.status);
    const chatResult = await chatResponse.json();
    console.log("聊天响应:", chatResult);
    
  } catch (error) {
    console.error("测试失败:", error);
  }
}

testAPI();