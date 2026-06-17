# AI Conversation Capture Survey

> Last verified: 2026-06-17 | Scope: browser-side capture of current AI chat sessions into local knowledge tools

## Findings

- ChatGPT-only exporters are mature. `pionxzh/chatgpt-exporter` supports Text, HTML, Markdown, PNG, and JSON, and documents both DOM/user-script export and API/export-file based multi-conversation flows.
- Multi-platform exporters have converged on provider profiles. `paradox-solver/UniversalChatExporter` lists ChatGPT, Claude, DeepSeek, Gemini, Copilot, Grok, Perplexity, and Poe support, with local-only execution and minimal click-activated permissions.
- Broader AI chat exporters increasingly expose a template/platform pattern. `TheBluCoder/AI-chat-exporter` supports Gemini, Claude, and ChatGPT, and calls out an extensible template pattern, selected-message export, document extraction, and privacy-first settings.
- DOM selectors remain platform-specific and unstable. `give-me/bookmarklets` shows concrete selectors for ChatGPT (`data-message-author-role`), Claude (`data-testid="user-message"` plus Claude response classes), and Gemini (`user-query-content`, `message-content`).
- Knowledge-base integrations already use the same local API shape MindOS needs. `sho7650/obsidian-AI-exporter` extracts from supported chat pages in a content script, then sends data through a background worker to Obsidian Local REST API.
- China-focused coverage is thinner in open-source repos, but DeepSeek is now covered by several universal exporters. Qwen/Kimi/Zhipu/MiniMax are better handled in MindOS as first-party profiles plus generic role-selector fallback, instead of waiting for a mature upstream plugin.

## Implementation Implications

- Keep MindOS capture user-triggered. Chrome's `activeTab` plus `scripting.executeScript` model is enough for click-time extraction without broad host permissions.
- Use a profile registry rather than one hard-coded parser. Each profile owns domains, message selectors, role selectors, and content selectors.
- Save conversation captures as canonical MindOS notes: `type: log`, `source_type: session`, `source_url`, `source_platform`, and `captured_at`.
- Preserve the current Inbox default. Users can still choose a specific space, but the collection-box workflow should be one click into Inbox.
- Add platform IDs for Inbox source preview so captured sessions from ChatGPT, Claude, Gemini, DeepSeek, Kimi, Qwen, Zhipu GLM, and MiniMax remain recognizable after saving.

## Source Index

- https://github.com/pionxzh/chatgpt-exporter
- https://github.com/paradox-solver/UniversalChatExporter
- https://github.com/TheBluCoder/AI-chat-exporter
- https://github.com/Couchraver/claude-chatgpt-gemini-downloader
- https://github.com/nicepkg/ctxport
- https://github.com/give-me/bookmarklets
- https://github.com/sho7650/obsidian-AI-exporter
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developer.chrome.com/docs/extensions/reference/api/scripting
