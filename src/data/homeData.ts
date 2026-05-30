export const FEATURE_CARDS = [
  { icon: "💬", label: "Ask Anything", sub: "Chat with any AI model" },
  { icon: "⚖️", label: "Compare AI", sub: "Side-by-side model outputs" },
  { icon: "🤖", label: "Create Agent", sub: "Build a custom AI agent" },
  { icon: "📄", label: "Summarise Files", sub: "Upload & extract insights" },
  { icon: "💻", label: "Code Helper", sub: "Write, review & debug code" },
  { icon: "🔍", label: "Research Mode", sub: "Deep web research agent" },
] as const;

export const WORKSPACES = [
  { icon: "📦", name: "Project Alpha", sub: "3 agents · last used 2h ago" },
  { icon: "🧪", name: "Research Lab", sub: "5 agents · last used 1d ago" },
  { icon: "💡", name: "Brainstorm", sub: "1 agent · last used 3d ago" },
  { icon: "🗂️", name: "Client Work", sub: "2 agents · last used 5d ago" },
] as const;

export const PINNED_AGENTS = [
  { icon: "🤖", name: "General Assistant", model: "GPT-4o", color: "#5b7cff" },
  { icon: "💻", name: "Code Reviewer", model: "Claude Sonnet", color: "#7b61ff" },
  { icon: "📊", name: "Data Analyst", model: "Gemini 2.5", color: "#06b6d4" },
  { icon: "✍️", name: "Content Writer", model: "GPT-4o", color: "#10b981" },
] as const;

export const QUICK_PROMPTS = [
  "Summarise my last chat",
  "Start a new research task",
  "Review recent code changes",
  "Draft a project brief",
] as const;

export const ACTIVE_MODELS = [
  { name: "GPT-4o", dot: "#10b981" },
  { name: "Claude Sonnet", dot: "#7b61ff" },
  { name: "Gemini 2.5", dot: "#06b6d4" },
] as const;
