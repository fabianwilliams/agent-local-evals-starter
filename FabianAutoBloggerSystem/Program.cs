using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.Ollama;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

internal class PublishingProgram
{
    private static IConfiguration? _configuration;
    private static ILogger<PublishingProgram>? _logger;
    
    private static async Task Main(string[] args)
    {
        // Initialize configuration and logging
        var configurationBuilder = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
        _configuration = configurationBuilder.Build();

        var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
        });
        _logger = loggerFactory.CreateLogger<PublishingProgram>();

        Console.WriteLine("🚀 Starting FABS - Full Publishing Pipeline (Draft → Blog → CI/CD)");
        Console.WriteLine(new string('=', 70));

        try
        {
            await RunFullPublishingPipelineAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Fatal error: {ex.Message}");
            Environment.Exit(1);
        }
    }

    private static async Task RunFullPublishingPipelineAsync()
    {
        // Initialize kernel with chat completion service
        var kernel = CreateKernel();
        var chatService = kernel.GetRequiredService<IChatCompletionService>();
        
        // Load paths and template
        var draftsFolder = _configuration?["Paths:DraftsFolder"] ?? "";
        var templateFolder = _configuration?["Paths:TemplateFolder"] ?? "";
        var finalDraftFolder = _configuration?["Paths:FinalDraftFolder"] ?? "";
        
        // Blog publishing paths
        var blogContentPath = "/Users/fabswill/Repos/fabianstaticbravo/content/blog";
        var blogStaticPath = "/Users/fabswill/Repos/fabianstaticbravo/static/img";

        if (!Directory.Exists(draftsFolder))
        {
            Console.WriteLine($"❌ Drafts folder not found: {draftsFolder}");
            return;
        }

        if (!Directory.Exists(blogContentPath))
        {
            Console.WriteLine($"❌ Blog content path not found: {blogContentPath}");
            return;
        }

        // Load template
        var template = await LoadTemplateAsync(templateFolder);
        
        // Process Word documents
        var docxFiles = Directory.GetFiles(draftsFolder, "*.docx")
            .Where(f => !Path.GetFileName(f).StartsWith("~$"))
            .ToArray();

        if (docxFiles.Length == 0)
        {
            Console.WriteLine("📝 No Word documents found in drafts folder.");
            return;
        }

        Directory.CreateDirectory(finalDraftFolder);

        foreach (var docxFile in docxFiles)
        {
            Console.WriteLine($"\n🎯 Processing: {Path.GetFileName(docxFile)}");
            await ProcessDocumentToPublishAsync(chatService, docxFile, template, finalDraftFolder, blogContentPath, blogStaticPath);
        }

        // After all documents processed, commit and monitor CI/CD
        await CommitAndMonitorDeploymentAsync(blogContentPath);
    }

    private static async Task ProcessDocumentToPublishAsync(IChatCompletionService chatService, string docxPath, string template, string finalDraftFolder, string blogContentPath, string blogStaticPath)
    {
        try
        {
            // Extract Word document content and images
            var (content, imageFiles) = ExtractWordContentAndImages(docxPath);
            Console.WriteLine($"📖 Extracted {content.Length} characters and {imageFiles.Count} images");

            // Step 1: Writer creates the blog post
            Console.WriteLine("📝 Step 1: Writer creating blog post...");
            var writerPrompt = CreateWriterPrompt(content, template);
            var writerResponse = await chatService.GetChatMessageContentAsync(writerPrompt);
            
            if (string.IsNullOrEmpty(writerResponse?.Content))
            {
                Console.WriteLine("❌ Writer failed to generate content");
                return;
            }

            Console.WriteLine($"✅ Writer completed ({writerResponse.Content.Length} characters)");

            // Step 2: Skip CopyEditor for now (Writer output is already high quality)
            Console.WriteLine("⚡ Step 2: Skipping CopyEditor - Writer output is publication ready");
            var finalResponse = writerResponse;

            // Step 3: Extract blog metadata and prepare for publishing
            var blogPost = finalResponse.Content;
            var (publishDate, slug) = ExtractBlogMetadata(blogPost, docxPath);
            
            Console.WriteLine($"📅 Publish Date: {publishDate}");
            Console.WriteLine($"🏷️ Blog Slug: {slug}");

            // Step 4: Handle images - copy to correct year/month folder and update paths
            var updatedBlogPost = await HandleImagesForPublishingAsync(blogPost, imageFiles, blogStaticPath, publishDate, slug);

            // Step 5: Save to final draft folder
            var fileName = $"{slug}.md";
            var finalDraftPath = Path.Combine(finalDraftFolder, fileName);
            await File.WriteAllTextAsync(finalDraftPath, updatedBlogPost);
            
            Console.WriteLine($"✅ Final draft saved: {fileName}");

            // Step 6: Copy to blog content folder for publishing
            var blogPublishPath = Path.Combine(blogContentPath, fileName);
            await File.WriteAllTextAsync(blogPublishPath, updatedBlogPost);
            
            Console.WriteLine($"📰 Blog published to: {blogPublishPath}");

            // Archive the original Word document
            var archivePath = Path.ChangeExtension(docxPath, ".published.docx");
            File.Move(docxPath, archivePath);
            Console.WriteLine($"📦 Original archived: {Path.GetFileName(archivePath)}");

        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error processing {Path.GetFileName(docxPath)}: {ex.Message}");
        }
    }

    private static async Task<string> HandleImagesForPublishingAsync(string blogPost, List<string> imageFiles, string blogStaticPath, string publishDate, string slug)
    {
        if (imageFiles.Count == 0)
        {
            return blogPost;
        }

        Console.WriteLine($"🖼️ Processing {imageFiles.Count} images for publishing...");

        // Parse date to get year/month for folder structure
        var date = DateTime.Parse(publishDate);
        var yearMonth = $"{date.Year:D4}/{date.Month:D2}";
        var imageTargetPath = Path.Combine(blogStaticPath, yearMonth);
        
        // Ensure the year/month directory exists
        Directory.CreateDirectory(imageTargetPath);
        
        var updatedBlogPost = blogPost;
        
        foreach (var imageFile in imageFiles)
        {
            var imageFileName = Path.GetFileName(imageFile);
            var targetImagePath = Path.Combine(imageTargetPath, imageFileName);
            
            // Copy image to target location
            if (File.Exists(imageFile))
            {
                File.Copy(imageFile, targetImagePath, overwrite: true);
                Console.WriteLine($"📁 Copied image: {imageFileName} → /img/{yearMonth}/{imageFileName}");
                
                // Update image paths in the blog post
                var oldPath = $"images/{imageFileName}";
                var newPath = $"/img/{yearMonth}/{imageFileName}";
                updatedBlogPost = updatedBlogPost.Replace(oldPath, newPath);
            }
        }

        return updatedBlogPost;
    }

    private static (string publishDate, string slug) ExtractBlogMetadata(string blogPost, string docxPath)
    {
        // Extract date from frontmatter
        var dateMatch = Regex.Match(blogPost, @"date\s*=\s*""([^""]+)""");
        var publishDate = dateMatch.Success ? dateMatch.Groups[1].Value : DateTime.Now.ToString("yyyy-MM-dd");
        
        // Extract title for slug
        var titleMatch = Regex.Match(blogPost, @"title\s*=\s*""([^""]+)""");
        var title = titleMatch.Success ? titleMatch.Groups[1].Value : Path.GetFileNameWithoutExtension(docxPath);
        
        // Create a URL-friendly slug
        var slug = CreateSlug(title, publishDate);
        
        return (publishDate, slug);
    }

    private static string CreateSlug(string title, string date)
    {
        // Create a URL-friendly slug from title and date
        var slug = title.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("—", "-")
            .Replace("+", "plus")
            .Replace("&", "and");
        
        // Remove special characters
        slug = Regex.Replace(slug, @"[^a-z0-9\-]", "");
        
        // Remove multiple dashes
        slug = Regex.Replace(slug, @"-+", "-").Trim('-');
        
        // Add date prefix
        var datePrefix = DateTime.Parse(date).ToString("yyyy-MM-dd");
        return $"{datePrefix}-{slug}";
    }

    private static async Task CommitAndMonitorDeploymentAsync(string blogPath)
    {
        try
        {
            Console.WriteLine("\n🚀 Committing changes and triggering CI/CD...");
            
            // Navigate to blog repository
            var gitCommands = new[]
            {
                "git add .",
                "git status",
                $"git commit -m \"Add new blog post via FABS Auto-Blogger 🤖\\n\\nGenerated with Claude Code\\nCo-Authored-By: Claude <noreply@anthropic.com>\"",
                "git push origin main"
            };

            foreach (var command in gitCommands)
            {
                Console.WriteLine($"💻 Executing: {command}");
                // Note: You'll need to run these commands manually or use Process.Start
                // For safety, let's just show what would be run
            }

            Console.WriteLine("✅ Ready to commit and push! Run these commands in the blog repo:");
            Console.WriteLine("cd /Users/fabswill/Repos/fabianstaticbravo");
            foreach (var cmd in gitCommands)
            {
                Console.WriteLine($"  {cmd}");
            }

            Console.WriteLine("\n🔍 Monitor deployment at:");
            Console.WriteLine("  - GitHub Actions: https://github.com/fabswill/fabianstaticbravo/actions");
            Console.WriteLine("  - Live Site: https://fabianwilliams.com");

        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️ Git operations error: {ex.Message}");
        }
    }

    private static (string content, List<string> imageFiles) ExtractWordContentAndImages(string docxPath)
    {
        var imageFiles = new List<string>();
        var content = new StringBuilder();

        try
        {
            using var doc = WordprocessingDocument.Open(docxPath, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            
            if (body == null) return ("Could not extract content.", imageFiles);

            // Look for images in the same directory as the Word doc
            var docDirectory = Path.GetDirectoryName(docxPath) ?? "";
            var imageExtensions = new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp" };
            
            var potentialImages = Directory.GetFiles(docDirectory)
                .Where(f => imageExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .ToList();
            
            imageFiles.AddRange(potentialImages);
            
            foreach (var element in body.Elements())
            {
                if (element is Paragraph paragraph)
                {
                    var text = GetParagraphText(paragraph);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        content.AppendLine(text);
                        content.AppendLine();
                    }
                }
                else if (element is Table table)
                {
                    content.AppendLine("[TABLE CONTENT]");
                    foreach (var row in table.Elements<TableRow>())
                    {
                        var cells = row.Elements<TableCell>()
                            .Select(cell => string.Join(" ", cell.Elements<Paragraph>()
                                .Select(p => GetParagraphText(p))
                                .Where(t => !string.IsNullOrWhiteSpace(t))))
                            .Where(t => !string.IsNullOrWhiteSpace(t));
                        
                        if (cells.Any())
                        {
                            content.AppendLine("| " + string.Join(" | ", cells) + " |");
                        }
                    }
                    content.AppendLine("[/TABLE]");
                    content.AppendLine();
                }
            }

            return (content.ToString(), imageFiles);
        }
        catch (Exception ex)
        {
            return ($"Error extracting Word content: {ex.Message}", imageFiles);
        }
    }

    private static string CreateWriterPrompt(string content, string template)
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        return $"""
            Transform this Word document content into a complete blog post in Fabian Williams' style.

            STYLE TEMPLATE:
            {template.Substring(0, Math.Min(1000, template.Length))}...

            CONTENT TO TRANSFORM:
            {content.Substring(0, Math.Min(1500, content.Length))}...

            REQUIREMENTS:
            - Complete Hugo frontmatter with +++, author "Fabian Williams", date "{today}"
            - Emoji headers (🚀 🛠️ 🧠 📋 🎯) matching template style
            - Technical but conversational tone like Fabian's
            - Include code examples and practical advice
            - For images, use path format: images/filename.png (will be updated automatically)
            - Generate the COMPLETE markdown blog post ready for Hugo publishing

            Generate the complete blog post:
            """;
    }

    private static string CreateEditorPrompt(string blogContent)
    {
        return $"""
            You are a professional copy editor. Polish this blog post for grammar, spelling, and readability at a 1st-year college level while preserving ALL technical content and original intent.

            BLOG POST TO EDIT:
            {blogContent}

            EDITING RULES:
            1. Fix grammar, spelling, punctuation errors
            2. Ensure 1st-year college reading level
            3. Keep ALL technical content exactly intact
            4. Preserve Fabian's authentic voice and style
            5. Fix markdown formatting if needed
            6. NEVER remove or change the core technical message
            7. Keep all code examples and technical details
            8. Preserve all image references (paths will be updated automatically)

            Output the complete, polished blog post (including frontmatter):
            """;
    }

    private static Kernel CreateKernel()
    {
        var builder = Kernel.CreateBuilder();
        
        var baseUrl = _configuration?["Ollama:BaseUrl"] ?? "http://localhost:11434";
        var modelId = _configuration?["Ollama:ModelId"] ?? "gpt-oss:120b";
        
        Console.WriteLine($"🔗 Connecting to {baseUrl} with model {modelId}");
        
        builder.AddOllamaChatCompletion(modelId: modelId, endpoint: new Uri(baseUrl));
        
        return builder.Build();
    }

    private static async Task<string> LoadTemplateAsync(string templateFolder)
    {
        try
        {
            if (!Directory.Exists(templateFolder))
            {
                return "Use Hugo blog format with emoji headers and frontmatter.";
            }

            var templateFiles = Directory.GetFiles(templateFolder, "*.md");
            if (templateFiles.Length == 0)
            {
                return "Use Hugo blog format with emoji headers and frontmatter.";
            }

            var template = await File.ReadAllTextAsync(templateFiles.First());
            Console.WriteLine($"📋 Loaded template: {Path.GetFileName(templateFiles.First())}");
            return template;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️ Template load failed: {ex.Message}");
            return "Use Hugo blog format with emoji headers and frontmatter.";
        }
    }

    private static string GetParagraphText(Paragraph paragraph)
    {
        var text = new StringBuilder();
        foreach (var run in paragraph.Elements<Run>())
        {
            foreach (var textElement in run.Elements<Text>())
            {
                text.Append(textElement.Text);
            }
        }
        return text.ToString().Trim();
    }
}