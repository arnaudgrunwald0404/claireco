# ClaireCo — User Flows

## Flow 1: Employee Interview (Primary Flow)

```
START
  |
  v
Welcome Screen
  - Display ClaireCo intro
  - Show department chips (14 options)
  - User selects department
  - "Start talking to Claire" button activates
  |
  v
Chat Screen Opens
  - Show header with department badge
  - Claire sends opening message (random from 5 options)
  - Input area appears
  |
  v
Conversation Loop
  - User types message
  - Message appended to transcript
  - Frontend sends full transcript + system prompt to Claude API (streaming)
  - Claire's response streams token by token
  - Simultaneously: run keyword match against use case library
  - Update match_confidence on conversation row in Supabase
  |
  v
After Message 3: Confidence Check
  |
  |-- confidence > 40% -----> Show subtle confidence indicator
  |                           ("Scanning library..." bar animates)
  |
  |-- confidence < 40% -----> Continue conversation loop
  |
  v
After Message 4-5: Path Decision
  |
  |-- confidence >= threshold (0.72 in production) ---> PATH A: Surface Match
  |
  |-- message_count >= 6, no match -------------------> PATH C: New Use Case
  |
  |-- continue ---> Ask follow-up, loop back
  |
PATH A: Surface Match
  - Inject match context into system prompt
  - Claire surfaces match naturally in her next message
  - Show match card UI (green) with use case name + description
  - Two buttons: "Yes, that's basically it" / "Not quite"
  |
  |-- User confirms ----> Mark path = 'A', match_confirmed = true
  |                       Increment use_cases.match_count
  |                       Claire wraps up warmly
  |                       Trigger PRD extraction
  |
  |-- User rejects -----> PATH B: Redirect
                          Reset confidence, clear matched_use_case_id
                          Claire asks what is different
                          Continue conversation loop (max 3 more messages)
                          If still no match --> PATH C

PATH B: Redirect
  - Claire asks "What did I get wrong about your situation?"
  - Continue conversation
  - Re-run matching with updated transcript
  - If new match found --> PATH A again
  - If no match after 3 more messages --> PATH C

PATH C: New Use Case
  - Show new use case card UI (blue)
  - Mark path = 'C'
  - Claire asks one final clarifying question about ideal outcome
  - Then wraps up
  - Trigger PRD extraction
  - Insert new use case draft into use_cases table (is_active = false, pending champion review)
  |
  v
PRD Extraction (Edge Function)
  - Send full transcript to Claude (non-streaming)
  - Extract structured fields (see PERSONA.md extraction prompt)
  - Write to briefs table
  - Generate brief_ref (AGT-XXXX)
  |
  v
PRD Card Displayed
  - Show structured brief in chat
  - "Copy brief" button
  - "Notify #claireco" button (posts to Slack webhook)
  - Claire sends warm closing message
  |
  v
END (conversation status = 'completed')
```

---

## Flow 2: Champion Dashboard

```
START
  |
  v
Authentication
  - Google OAuth via Supabase Auth
  - Check profiles.is_champion = true
  - If not champion: redirect to employee view
  |
  v
Dashboard Home
  - Stats row: Total briefs | Pending review | This week | Match rate
  - Briefs table (real-time via Supabase Realtime)
    Columns: Brief ID | Department | Pain summary | Type | Confidence | Date | Status
  - Filter bar: Department | Status | Match type | Date range
  |
  v
Brief Detail View
  - Full PRD (all extracted fields)
  - Full conversation transcript (expandable)
  - Scoring panel (15 criteria, 1-5 each, auto-sums to /75)
  - Priority tier selector (P1/P2/P3/Hold)
  - Champion notes field
  - Status dropdown
  - "Assign to me" button
  |
  v
Scoring & Triage
  - Champion fills in scores
  - Total auto-calculates
  - Priority tier suggested based on score (but champion can override)
  - Status updated
  - Submitter notified (optional Slack DM)
  |
  v
Use Case Library View
  - Table of all 66+ use cases
  - Columns: ID | Function | Name | Match count | Last matched
  - New use cases (path C, pending review) flagged separately
  - Champion can approve new use cases (sets is_active = true)
  - Champion can merge similar use cases
  |
  v
Analytics View
  - Submissions over time (line chart)
  - Department heat map (bar chart)
  - Top use cases by request count
  - Match rate trend
  - Path distribution (A/B/C breakdown)
```

---

## Edge Cases

### User abandons mid-conversation
- Save transcript to conversations table with status = 'abandoned'
- Do not generate a brief
- If user returns (same session): restore conversation from localStorage
- If new session: start fresh (do not restore abandoned sessions)

### Claude API timeout or error
- Show in-chat message: "I lost my train of thought for a second — could you say that again?"
- Retry the API call once automatically
- If second failure: "I'm having some trouble right now. Your conversation is saved — come back in a few minutes."
- Do not lose the transcript

### User submits very short answers (one word)
- Claire should probe: "Tell me a bit more about that — what does that look like day to day?"
- Do not trigger matching until at least 3 substantive messages (>10 words each)

### User describes something outside work (e.g. personal tasks)
- Claire should gently redirect: "Got it — I'm focused on work-related tasks here. Is there something at work that feels similar?"

### User asks if Claire is an AI
- Claire responds honestly but briefly: "Yes, I'm an AI — but don't let that stop you. What matters is that what you tell me actually gets to the right people."
- Then pivot back: "So — tell me more about [last topic]."

### Extremely long transcript (> 20 messages)
- Summarize older messages in the system prompt context to stay within token limits
- Keep the last 10 messages verbatim, summarize earlier ones

### Match confidence is borderline (between 35-50%)
- Do not surface the match card — continue asking questions
- Let confidence build naturally
- Better to surface at message 7 with high confidence than message 4 with low confidence

### Department not selected
- "Start" button remains disabled
- Tooltip on hover: "Select your department first so I can ask better questions"

### User wants to start over
- "Start a new conversation" link in header (visible after chat starts)
- Saves current conversation as 'abandoned' before clearing

---

## Notification Flow (Slack Integration)

When a brief is submitted:
1. Frontend calls a Supabase Edge Function
2. Edge function posts to #claireco Slack channel via webhook:
   ```
   New brief from [Name] in [Department]
   Brief ID: AGT-XXXX
   Pain: [pain_summary]
   Type: Known match / New use case
   View: [link to champion dashboard]
   ```
3. If P1 brief (scored by champion): DM the submitter to let them know it is being prioritized

---

## Data Retention

- Conversations: retained indefinitely (valuable training data)
- Briefs: retained indefinitely
- If user requests deletion: anonymize (set user_id = null, remove name from transcript)
- No PII should ever appear in the use_cases table
