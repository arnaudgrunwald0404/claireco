# ClaireCo — Design System

## Design Direction

ClaireCo uses a dark, editorial aesthetic. The goal is to feel like a thoughtful tool — not a corporate intranet form, not a consumer chat app. It should feel calm, focused, and intelligent. Employees should feel like they are talking to someone who is actually listening.

**Aesthetic:** Dark minimal editorial. Think: quality journalism at night.
**Tone:** Serious but warm. Confident but not loud.
**Differentiator:** The confidence bar and match card moments are the UI's centrepieces — they should feel like a reveal, not a notification.

---

## Typography

```css
/* Display — for headlines and Claire's name */
font-family: 'Lora', serif;

/* Body — for all UI text, messages, labels */
font-family: 'IBM Plex Sans', sans-serif;

/* Mono — for IDs, codes, metadata, technical labels */
font-family: 'IBM Plex Mono', monospace;
```

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type Scale
| Use | Size | Weight | Family |
|---|---|---|---|
| Hero headline | 48-56px | 600 | Lora |
| Screen title | 32-38px | 600 | Lora |
| Section title | 20px | 400 | Lora |
| Body / bubble | 15px | 400 | IBM Plex Sans |
| Label | 13px | 500 | IBM Plex Sans |
| Micro / metadata | 11px | 400 | IBM Plex Mono |
| Caption | 10px | 500 | IBM Plex Mono (uppercase + letter-spacing: 2px) |

---

## Color System

```css
:root {
  /* Backgrounds */
  --bg: #0F0F0F;           /* Page background */
  --surface: #1A1A1A;      /* Cards, bubbles */
  --surface2: #242424;     /* Nested surfaces, input */
  --surface3: #2E2E2E;     /* Hover states, chips */

  /* Borders */
  --border: #333333;

  /* Text */
  --ink: #F0EDE8;          /* Primary text */
  --ink2: #A09890;         /* Secondary text */
  --ink3: #5C5550;         /* Muted / placeholder */

  /* Accent — warm amber/terracotta */
  --accent: #E8A87C;       /* Primary CTA, highlights */
  --accent2: #C84B31;      /* Secondary accent, destructive */

  /* Match state — green */
  --match: #4CAF82;        /* Match confirmed, success */
  --match-bg: #0D2B1E;     /* Match card background */

  /* New use case state — blue */
  --new: #7B9FE8;          /* New discovery */
  --new-bg: #0D1829;       /* New card background */
}
```

### Color usage rules
- **--accent** is for primary buttons, active states, and the ClaireCo logo. Use sparingly.
- **--match** and **--match-bg** only appear when a use case match is surfaced. The green should feel like a moment of recognition.
- **--new** and **--new-bg** only appear for new use case discoveries. The blue should feel exploratory and exciting.
- Never use both green and blue states simultaneously.
- Background is near-black (#0F0F0F) — never pure black, never white.

---

## Components

### Message Bubble — Claire
```css
.message.claire .bubble {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 16px;
  border-bottom-left-radius: 4px;  /* Chat convention: sender's corner is flat */
  padding: 16px 20px;
  max-width: 85%;
  font-size: 15px;
  line-height: 1.65;
}
```

### Message Bubble — User
```css
.message.user .bubble {
  background: var(--accent);
  color: #0F0F0F;
  border-radius: 16px;
  border-bottom-right-radius: 4px;
  padding: 16px 20px;
  max-width: 85%;
}
```

### Typing Indicator
Three dots, staggered animation, inside a Claire bubble shape:
```css
.typing-dot {
  animation: typingDot 1.2s ease infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
```

### Match Card
The centrepiece moment. Green border, dark green background. Should animate in with a subtle scale + fade.
```css
.match-card {
  background: var(--match-bg);
  border: 1px solid var(--match);
  border-radius: 16px;
  animation: matchReveal 0.5s ease both;
}
@keyframes matchReveal {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### Confidence Bar
Appears after message 3 when confidence starts building. Should feel like a loading bar but intelligent — not anxious.
```css
.confidence-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface2);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink3);
}
.confidence-fill {
  background: linear-gradient(90deg, var(--accent), var(--match));
  transition: width 0.8s ease;
}
```

### Primary Button
```css
.btn-primary {
  background: var(--accent);
  color: #0F0F0F;
  border: none;
  border-radius: 8px;
  padding: 14px 32px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover {
  background: #F0B88C;
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(232,168,124,0.3);
}
```

### Department Chips
```css
.dept-chip {
  padding: 8px 16px;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.dept-chip.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #0F0F0F;
  font-weight: 500;
}
```

---

## Animation Principles

1. **Entrance animation** — all new messages, cards, and screens fade up (translateY 12px, opacity 0 to 1, 0.35s ease).
2. **Match reveal** — slightly slower (0.5s), includes subtle scale (0.98 to 1.0) to feel like a surface emerging.
3. **Confidence bar** — smooth progress fill over 0.8s, giving the impression of real-time analysis.
4. **Typing indicator** — always shown while Claire is "thinking." Never skip it, even for short responses.
5. **No bouncy easing** — use `ease` or `ease-out`, never `bounce` or `spring` — this is a serious tool.

---

## Responsive Rules

| Breakpoint | Changes |
|---|---|
| > 768px | Full layout, max-width 720px centered |
| <= 768px | Full width, reduced padding (16px), smaller headline |
| <= 480px | Further reduced type scale, stacked PRD metadata |

### Mobile specifics
- Input font-size must be 16px minimum to prevent iOS zoom on focus
- Bubble max-width increases to 92% on mobile
- Department chips wrap naturally (flex-wrap: wrap)
- Send button remains 48x48px minimum (touch target)

---

## Dashboard Design (Champion View)

The champion dashboard uses the same dark aesthetic but with a data-dense layout:

- **Left sidebar:** Navigation (All Briefs / Use Case Library / Analytics / Settings)
- **Main area:** Table view with sortable columns
- **Right panel:** Brief detail slides in on row click (no page navigation)
- **Status colors:**
  - Pending: amber dot
  - In review: blue dot
  - Scored: green dot
  - Building: purple dot
  - Shipped: bright green dot
  - Rejected: red dot

---

## Do Not

- Do not use purple anywhere — it is not in the palette
- Do not use emoji in UI labels, headings, or buttons (only in department chips which are user-facing and friendly)
- Do not use shadows on dark backgrounds — use borders instead
- Do not animate continuously (no spinning loaders except typing indicator)
- Do not use Inter, Roboto, or Arial — the type choices are specific and intentional
