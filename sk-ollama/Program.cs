using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using System.ComponentModel;

// --- Semantic Kernel + Ollama ---
#pragma warning disable SKEXP0070 // Ollama connector may be experimental
var skBuilder = Kernel.CreateBuilder();
skBuilder.AddOllamaChatCompletion(
    modelId: "gpt-oss:120b",                     // if you are not running the 120 b param as i do adjust accordingly
    endpoint: new Uri("http://localhost:11434"),
    serviceId: "local-ollama"
);
var kernel = skBuilder.Build();

var chat = kernel.GetRequiredService<IChatCompletionService>();

kernel.Plugins.AddFromType<SysTools>("sys");

var history = new ChatHistory();
history.AddSystemMessage("You are a helpful local agent. Use tools when needed.");
history.AddUserMessage("What time is it? If a tool helps, use it.");

// Run a chat with auto tool-calling (if supported by your model build)
var response = await chat.GetChatMessageContentAsync(
    history,
    new PromptExecutionSettings
    {
        FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(), // model may request tools
    },
    kernel);

Console.WriteLine(response.Content);

// Example tool (function)
public sealed class SysTools
{
    [KernelFunction, Description("Get the current local time in ISO-8601")]
    public string Now() => DateTime.Now.ToString("O");
}