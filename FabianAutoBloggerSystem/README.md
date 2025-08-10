# 🤖 Fabian Auto Blogger System (FABS)

An intelligent multi-agent system that automatically transforms draft content into publication-ready blog posts in Fabian's distinctive style.

## 🎯 System Overview

FABS uses 5 specialized AI agents working together to create high-quality technical blog posts:

1. **🎯 Chief of Staff Agent**: Orchestrates the entire workflow and maintains quality standards
2. **🔍 Researcher Agent**: Fact-checks technical details and gathers supporting information  
3. **✍️ Writer Agent**: Creates engaging content in Fabian's authentic voice and style
4. **📝 Copy Editor Agent**: Polishes grammar, formatting, and technical accuracy
5. **⚖️ Legal Agent**: Reviews for logical fallacies and unsupported claims using formal logic principles

## 🚀 Getting Started

### Prerequisites
- Ollama running locally with gpt-oss:120b model
- .NET 9 SDK
- Word documents (.docx) in the configured Drafts folder
- Template markdown file in the Template folder (moved from your example blog)

### Configuration
Update `appsettings.json` with your folder paths:

```json
{
  "Paths": {
    "DraftsFolder": "/Users/fabswill/FabianMedia/BlogPosts/Drafts",
    "TemplateFolder": "/Users/fabswill/FabianMedia/BlogPosts/Template",
    "UnderManagementFolder": "/Users/fabswill/FabianMedia/BlogPosts/UnderAgentManagement", 
    "FinalDraftFolder": "/Users/fabswill/FabianMedia/BlogPosts/FinalDraftForPublishing"
  }
}
```

### Running FABS

```bash
# Build the system
dotnet build

# Process all drafts in the configured folder
dotnet run
```

## 📋 Workflow Process

1. **📥 Input**: Place Word documents (.docx) with content and images in the Drafts folder
2. **📖 Extraction**: Convert Word document content, including embedded images and tables
3. **🔍 Research**: Technical accuracy and current best practices verification  
4. **✍️ Writing**: Transform content into blog posts following the Template folder format
5. **📝 Editing**: Grammar, formatting, and markdown consistency improvements
6. **⚖️ Legal Review**: Logic and reasoning validation using formal principles
7. **✅ Finalization**: Publication-ready markdown saved to FinalDraft folder

## 📊 Blog Format

FABS generates blogs with Fabian's signature structure:

```markdown
+++
title = "Compelling Title"
description = "SEO-friendly description"
author = "Fabian Williams"
date = "YYYY-MM-DD"
categories = ["AI Development", "Best Practices"]
tags = ["AI", "Development", "Tutorial"]
+++

## 🚀 Introduction
[Engaging technical content...]

## 🛠️ Technical Deep Dive  
[Code examples and practical guidance...]

## 💬 Final Thoughts
[Key takeaways and engagement]
```

## 🎨 Writing Style Features

- **Emoji Headers**: Consistent use of 🚀 🛠️ 🧠 📋 etc.
- **Technical Authority**: Real-world examples and battle-tested advice
- **Practical Focus**: Actionable code examples and step-by-step guidance
- **Conversational Tone**: Approachable yet technically rigorous
- **Visual Elements**: Tables, code blocks, and structured formatting

## 🔧 Advanced Features

- **Word Document Processing**: Extracts text, images, and tables from .docx files
- **Template-Based Generation**: Uses your existing blog format as the style guide
- **Logical Fallacy Detection**: Prevents common reasoning errors using formal logic principles
- **Technical Accuracy**: Verifies versions, compatibility, and best practices
- **Style Consistency**: Maintains Fabian's authentic voice across all content
- **Image Detection**: Identifies embedded images and creates proper markdown references
- **Table Conversion**: Converts Word tables to markdown table format
- **Workflow Management**: Tracks progress and saves work-in-progress versions
- **Auto-archival**: Safely archives processed drafts to prevent reprocessing

## 📝 Setup Instructions

### 1. Move Your Template
Move your existing blog markdown file to the Template folder:
```bash
# Example
mv FabianMusingSaturdayAug82025.md /Users/fabswill/FabianMedia/BlogPosts/Template/
```

### 2. Create Word Document Drafts  
- Write your content in Word (.docx format)
- Include images directly in the document
- Use tables, lists, and formatting as needed
- Save to the Drafts folder

### 3. Run FABS
The system will:
- Extract all content from your Word documents
- Transform it into blog posts matching your template
- Apply your proven writing style and format
- Generate publication-ready markdown files

## 🚀 Future Enhancements

- **Cron Job Integration**: Automated processing on a schedule
- **Image Generation**: AI-generated diagrams and visual content
- **SEO Optimization**: Advanced keyword and meta-tag generation
- **Multi-platform Publishing**: Direct integration with static site generators
- **Analytics Integration**: Performance tracking and optimization suggestions

---

**Built with love by the FABS AI Agent Team** 🤖✨