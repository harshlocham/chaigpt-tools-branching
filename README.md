# ChaiGPT

A ChatGPT-style chat app built with Next.js, extended with **AI web search tool calling** and **named conversation branching**.

Based on the [chai-gpt-build](https://github.com/Aestheticsuraj234/chai-gpt-build) starter.

## Features

### Phase 1 — Web search tools

- The model can call a **Tavily** `webSearch` tool when it needs up-to-date information
- Tool execution streams in the UI (searching → results / errors)
- Tool calls and results are stored in message `parts` and persist across reloads

### Phase 2 — Conversation branching

- **Branch from any message** to continue the chat on a new path
- Shared history until the fork point; each branch owns its own messages after that
- Switch, rename, and delete branches from the header switcher
- Main branch cannot be deleted

## Stack

- **Next.js 16** (App Router) + React 19
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
- **OpenAI** for chat completions
- **Tavily** for web search
- **Clerk** for authentication
- **Prisma 7** + PostgreSQL
- **TanStack Query**, Tailwind CSS 4, shadcn/ui

## Setup

### 1. Install dependencies

```bash
bun install
# or: npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=                 # PostgreSQL connection string
OPENAI_API_KEY=               # OpenAI API key
TAVILY_API_KEY=               # Tavily API key (https://tavily.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Get a free Postgres URL from [Neon](https://neon.tech), [Supabase](https://supabase.com), or `bunx create-db`.

### 3. Database

```bash
bunx prisma migrate deploy
bunx prisma generate
```

### 4. Run

```bash
bun dev
# or: npm run dev
```

If Turbopack fails on your machine:

```bash
npx next dev --webpack
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Sign in with Clerk
2. Start chatting — ask about current events to trigger web search
3. Hover a message → click the **branch** icon to fork
4. Use the branch dropdown in the header to switch, rename, or delete branches

## Project structure

```
app/
  api/chat/          # Streaming chat + tool calling
  (root)/c/[id]/    # Conversation page
features/
  ai/tools/          # webSearch tool (Tavily)
  ai/components/     # Tool call UI
  conversation/      # Chat UI, branches, sidebar
  auth/              # Clerk user sync
prisma/              # Schema + migrations
```

## License

Private / course assignment — adapt as needed.
