---
name: claireco
description: Use this skill whenever working on the ClaireCo project — ClearCompany's internal AI agent discovery tool. Triggers include any mention of ClaireCo, Claire, the interview flow, the use case library, the champion dashboard, the PRD extraction, or any ClaireCo-related feature or bug. This skill contains all context needed to build, extend, and maintain ClaireCo correctly without requiring repeated explanation.
---

# ClaireCo — Master Skill for Claude Code

## What is ClaireCo?

ClaireCo is ClearCompany's internal AI agent discovery tool. Non-technical employees have a natural conversation with an AI named Claire about their work pain. Claire matches their pain to a library of known use cases in real time. At the end, she generates a structured PRD (agent brief) that the company's AI champions use to build internal agents.

**Read these files before writing any code:**
- `PRODUCT.md` — What ClaireCo is, does, and does not do
- `ARCHITECTURE.md` — Tech stack, Claude API integration, Supabase setup
- `PERSONA.md` — Claire's voice, system prompt, and PRD extraction prompt
- `SCHEMA.md` — Full Supabase database schema with RLS policies
- `FLOWS.md` — Complete user journeys, edge cases, and notification flow
- `DESIGN.md` — Visual design system, components, colors, typography

---

## Project Structure

```
claireco/
  index.html              # Employee interview interface
  dashboard.html          # AI champion triage dashboard
  use-cases.json          # Use case library (66 entries)
  PRODUCT.md
  ARCHITECTURE.md
  PERSONA.md
  SCHEMA.md
  FLOWS.md
  DESIGN.md
  SKILL.md                # This file
  .env                    # Environment variables (never commit)
  .env.example            # Template for env vars
  netlify/
    functions/
      chat.js             # Proxy for Claude API calls (keeps key server-side)
      extract-brief.js    # PRD extraction after conversation ends
      match-use-case.js   # Semantic matching (Phase 2)
      notify-slack.js     # Slack webhook notification
```

---

## Critical Rules — Read Before Writing Any Code

### 1. Never expose the API key
All calls to `api.anthropic.com` must go through `netlify/functions/chat.js`. The frontend NEVER calls Anthropic directly. The `ANTHROPIC_API_KEY` is a server-side env var only.

### 2. Claire speaks in 1-3 sentences maximum
Any code that calls Claude for the conversation must pass `max_tokens: 300`. Claire should never write paragraphs. If responses are too long, reduce max_tokens to 200.

### 3. Use streaming for the conversation
The main chat uses SSE streaming so Claire's response appears token by token. The PRD extraction call is NOT streaming — it is a single blocking call.

### 4. One question per message from Claire
The system prompt enforces this, but if testing reveals Claire is asking multiple questions, add this to the system prompt: "CRITICAL: You may only ask ONE question per response. If you want to ask two things, pick the more important one."

### 5. Never show users the use case library
The matching is entirely invisible to the employee. They never see a list of use cases, IDs, or category names. The only moment they see anything related to the library is the match card — which describes their specific situation, not a generic category label.

### 6. The confidence threshold is a tunable parameter
Store it as an environment variable: `MATCH_CONFIDENCE_THRESHOLD=0.72`. Never hardcode it. It will need adjustment as real data comes in.

### 7. Always save to Supabase, even if incomplete
Every conversation should be written to the database as it progresses, not just at the end. The `transcript` field on the conversations table is updated after each message exchange. This ensures no data is lost if the user closes the tab.

---

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Server-side only

# Optional
OPENAI_API_KEY=sk-...               # Phase 2: semantic embeddings
SLACK_WEBHOOK_URL=https://hooks...  # Slack notifications
MATCH_CONFIDENCE_THRESHOLD=0.72     # Tune this based on real data
```

---

## Common Tasks

### Adding a new use case to the library
1. Add entry to `use-cases.json` with the next sequential ID
2. Run the seed script: `node scripts/seed-use-cases.js`
3. If Phase 2 (embeddings) is active, regenerate embeddings: `node scripts/generate-embeddings.js`

### Changing Claire's behavior
Edit `PERSONA.md` first to document the change, then update the system prompt in `netlify/functions/chat.js`. Never change the system prompt without updating PERSONA.md.

### Adjusting the match threshold
Update `MATCH_CONFIDENCE_THRESHOLD` in Netlify environment variables. No code change needed.

### Adding a new department
1. Add the chip to the welcome screen in `index.html`
2. Add relevant use cases to `use-cases.json` with the department's function name matching exactly
3. Update `PRODUCT.md` with the new function

### Debugging a conversation where Claire gave bad responses
1. Pull the conversation from Supabase: `select transcript from conversations where id = 'xxx'`
2. Replay the transcript in the Anthropic Workbench with the same system prompt
3. Identify where the response quality degraded
4. Adjust system prompt or max_tokens accordingly

---

## Testing Checklist

Before deploying any change:

- [ ] Claire responds in 1-3 sentences
- [ ] Claire asks only one question per message
- [ ] Typing indicator appears before each Claire response
- [ ] Confidence bar appears after message 3 (when confidence > 20%)
- [ ] Match card appears with green styling and correct use case details
- [ ] "Yes, that's it" button confirms the match and triggers PRD generation
- [ ] "Not quite" button resets and continues the conversation
- [ ] New use case card appears in blue when no match is found after 6 messages
- [ ] PRD card displays all extracted fields
- [ ] Conversation is saved to Supabase after each message
- [ ] Brief is written to Supabase after conversation ends
- [ ] Slack notification fires when brief is submitted
- [ ] Works on mobile (test on iOS Safari and Android Chrome)
- [ ] API key is not visible in browser dev tools network tab
- [ ] Supabase RLS prevents users from seeing other users' briefs

---

## Known Limitations (Do Not Try to Fix Without Discussion)

- **Keyword matching (Phase 1) is imprecise.** It will have false positives and false negatives. This is acceptable in the prototype. Phase 2 (embeddings) solves this.
- **No conversation memory across sessions.** If a user comes back the next day, they start fresh. This is intentional for now.
- **No multi-language support.** English only. International expansion is a future consideration.
- **No voice input.** The original concept included voice — this is deferred to a future version.
