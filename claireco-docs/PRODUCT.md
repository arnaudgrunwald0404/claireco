# ClaireCo — Product Definition

## What is ClaireCo?

ClaireCo is an internal AI-powered tool built by and for ClearCompany employees. It is a conversational agent discovery platform — a way for non-technical employees to describe their work pain in plain language, and have that pain translated into a structured, actionable brief that the company's AI champions can build from.

The name ClaireCo is a play on words: Claire (AI assistant) + ClearCompany (the company). It is friendly, approachable, and positioned as a colleague — not a tool.

---

## The Core Problem ClaireCo Solves

ClearCompany wants to deploy internal AI agents across every function. The bottleneck is not engineering capacity — it is discovery. Non-technical employees do not know how to articulate what they need in terms that engineers can build from. They know their pain, but not how to describe it as a use case.

ClaireCo bridges that gap. It converts unstructured employee frustration into structured, prioritized, buildable agent briefs.

---

## Who Uses ClaireCo?

**Primary users — Employees across all functions:**
Any ClearCompany employee who has a repetitive, time-consuming, or error-prone workflow they believe could be automated. They are non-technical. They should never see a form, a list of options, or technical language.

**Secondary users — AI Champions (internal team):**
The small team of product and engineering champions who review incoming briefs, prioritize them, and build agents. They access ClaireCo through a separate dashboard view.

---

## What ClaireCo Does (and Does Not Do)

### Does:
- Conducts an open, conversational interview with an employee about their work pain
- Matches their described pain against a library of 66+ known use cases in real time
- Surfaces a match when confidence is high
- Documents new use cases when no match is found, adding them to the library
- Generates a structured PRD (agent brief) at the end of every conversation
- Stores all conversations and briefs in a database
- Provides AI champions with a dashboard to review, prioritize, and triage briefs

### Does NOT do:
- Show users a list of use cases to pick from
- Ask users to fill out forms or structured fields
- Use technical language (APIs, agents, automation) in the user-facing interface
- Build the agents itself — it only generates the brief
- Make promises about timelines or whether something will be built

---

## The Three Conversation Paths

### Path A — Known Use Case Confirmed
Claire interviews the user. Semantic matching identifies a known use case with sufficient confidence after 4+ messages. She surfaces the match naturally: "This sounds like something we have heard before..." User confirms. PRD is generated using the known use case template enriched with the user's specifics.

### Path B — Known Use Case Rejected
User says the match is not quite right. Claire asks what is different, continues the conversation, and either finds a closer match or falls through to Path C.

### Path C — New Use Case
No match found after 5-6 exchanges. Claire acknowledges this is new, continues documenting specifics, and generates a PRD flagged as "new use case pending categorization." The use case is added to the library for future matching.

---

## The Use Case Library

The library currently contains 66 use cases across 14 functions: Talent Acquisition, HR/People Ops, Learning and Development, Customer Success, Sales/Revenue, Sales Enablement, Product Management, UX/Design, Engineering, Product Marketing, Implementation/PS, Finance/RevOps, Legal/Compliance, and IT/Security.

The library grows over time. Every confirmed Path A conversation strengthens match confidence. Every Path C conversation adds a new entry.

---

## Success Metrics

- Submissions per week (primary adoption signal)
- Match rate: percentage of conversations resolving to a known use case
- Discovery rate: percentage of conversations surfacing new use cases
- Champion pickup rate: percentage of briefs reviewed within 5 business days
- Build rate: percentage of P1 briefs resulting in a shipped agent within a quarter
- Employee NPS: did they feel heard and understood?

---

## Positioning

ClaireCo is not positioned as an "AI tool" to employees. It is a 5-minute conversation with a knowledgeable colleague. The word "agent" should never appear in the user-facing UI. Focus on human outcomes: less of the thing you hate, more time for the thing you are good at.
