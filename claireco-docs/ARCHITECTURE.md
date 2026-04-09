# ClaireCo — Architecture

## Stack Overview

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file) | No build step, fast iteration, easy to deploy anywhere |
| AI Layer | Anthropic Claude API (claude-sonnet-4-5) | Conversational intelligence, streaming responses |
| Database | Supabase (Postgres + Realtime) | Auth, storage, realtime dashboard updates |
| Hosting | Netlify | Simple deployment, env var management |
| Background jobs | Supabase Edge Functions | PRD extraction, use case matching, library updates |

---

## System Architecture

```
User (Browser)
    |
    | HTTPS
    v
Frontend (HTML/JS)
    |
    |-- Claude API (streaming SSE) --> Conversation management
    |-- Supabase JS Client ----------> Auth + data reads
    |
    v
Supabase
    |-- conversations table
    |-- briefs table
    |-- use_cases table
    |-- champions_reviews table
    |
    |-- Edge Function: extract_brief
    |       Runs after conversation ends
    |       Calls Claude to extract structured data from transcript
    |       Writes to briefs table
    |
    |-- Edge Function: match_use_case
            Runs after each message
            Embeds transcript and compares to use_case embeddings
            Updates match_confidence on conversation row
```

---

## Frontend Structure

The frontend is a single HTML file with embedded CSS and JS. No framework, no build step.

```
claireco/
  index.html          # Main app (welcome + chat interface)
  dashboard.html      # AI champions triage dashboard
  use-cases.json      # Use case library (66 entries)
  .env                # ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
```

### Key frontend responsibilities:
- Render the welcome screen and department selector
- Manage the chat message thread
- Stream Claude API responses token by token
- Display confidence indicator, match cards, new use case cards, PRD card
- Write completed conversations to Supabase

---

## Claude API Integration

### Model
Always use `claude-sonnet-4-6` unless otherwise specified. Do not use claude-haiku for the main conversation — quality matters more than cost here.

### Streaming
Use streaming SSE so Claire's responses appear token by token, like a real conversation.

```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': ANTHROPIC_API_KEY,
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    stream: true,
    system: CLAIRE_SYSTEM_PROMPT, // See PERSONA.md
    messages: conversationHistory,
  })
});
```

### Two-stage extraction
The conversation uses one Claude call per message turn (streaming, low max_tokens, conversational).
At the end, a second non-streaming call extracts structured PRD data from the full transcript (see SCHEMA.md for output format).

### API key security
The Anthropic API key must NEVER be exposed in frontend JS. All Claude API calls must be proxied through a Supabase Edge Function or a lightweight serverless function. The frontend calls `/api/chat` which calls Anthropic.

---

## Supabase Setup

### Authentication
Use Supabase Auth with SSO (Google OAuth) so employees authenticate with their ClearCompany Google account. No separate password.

### Row Level Security
- Employees can only read and write their own conversations and briefs
- AI champions have a special role granting read access to all briefs
- Use cases table is read-only for all users, write-only via Edge Functions

### Realtime
The champion dashboard subscribes to the briefs table via Supabase Realtime. New briefs appear without page refresh.

---

## Matching Architecture

### Phase 1 (prototype): Keyword matching
Simple keyword scoring against the use case library. Fast, no embeddings needed. Good enough for demo.

### Phase 2 (production): Semantic embeddings
1. On startup, embed all 66 use cases using `text-embedding-3-small` (OpenAI) or Voyage AI
2. Store embeddings in Supabase with pgvector extension
3. After each user message, embed the current transcript and run cosine similarity
4. Return the top match and its confidence score
5. Trigger match card when score exceeds threshold (0.72 recommended starting point)

### Confidence threshold tuning
- Too low (< 0.60): false positives, users reject matches, erodes trust
- Too high (> 0.85): misses real matches, too many Path C outcomes
- Start at 0.72, adjust based on match confirmation rate in production

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Edge functions only, never frontend
OPENAI_API_KEY=sk-...              # Optional: for embeddings
```

---

## Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=.

# Set env vars
netlify env:set ANTHROPIC_API_KEY sk-ant-...
netlify env:set SUPABASE_URL https://xxxx.supabase.co
netlify env:set SUPABASE_ANON_KEY eyJ...
```

---

## Error Handling Principles

- If the Claude API call fails, show a friendly in-chat error: "I'm having trouble connecting — give me a moment and try again."
- Never show raw API errors to users
- All database writes should be fire-and-forget from the user perspective — failures should be logged silently and retried
- If matching fails, default to Path C (document as new) rather than blocking the conversation
