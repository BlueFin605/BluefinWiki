---
description: Plan for onboarding — first-time tour, markdown help, contextual tooltips
tags: [bluefinwiki, plan, onboarding, help, tour]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Onboarding & Help

Implements: [Design](../design.md) — Frontend UX

## Scope

**Covers:**
- First-time user guided tour (5-7 steps)
- Markdown help modal accessible from editor
- Contextual tooltips on key UI elements

**Does not cover:**
- Documentation site (optional, post-MVP)
- Video tutorials (optional)

## Enables

Once onboarding exists:
- **New members orient quickly** — guided tour shows key features on first login
- **Members learn Markdown** — help accessible from where they write
- **UI is self-documenting** — tooltips explain controls without a manual

## Prerequisites

- All core UI components built — editor, search, page tree, navigation
- User preferences storage — DynamoDB user_preferences for tracking tour completion

## North Star

A family member who has never used a wiki should feel comfortable creating their first page within 5 minutes of logging in.

## Done Criteria

### First-Time Tour
- On first login (no tour completion flag in user preferences), a guided tour shall start automatically
- The tour shall have 5-7 steps highlighting: page tree navigation, creating a new page, the editor and toolbar, search (Cmd/Ctrl+K), and the save button
- Each step shall highlight the relevant UI element with a tooltip explanation
- The tour shall have "Next", "Back", and "Skip" controls
- On completion or skip, the tour completion flag shall be set in user preferences
- The tour shall be re-launchable from a help menu

### Markdown Help Modal
- The editor toolbar shall include a "?" help icon
- Clicking the icon shall open a modal with Markdown syntax cheat sheet
- The cheat sheet shall cover: headers, bold/italic, lists, links, images, code blocks, tables, wiki links
- Each example shall show the Markdown syntax and a rendered preview side by side
- The modal shall be keyboard-accessible (Escape to close)

### Contextual Tooltips
- Icon-only buttons shall have hover tooltips explaining their function
- Complex form fields shall have brief inline help text
- Tooltips shall appear on hover (desktop) and on long-press (mobile)
- Tooltips shall not block interaction with the target element

## Constraints

- **Tour library** — Use React Joyride or similar lightweight tour library. No heavy dependencies.
- **User preferences storage** — Tour completion tracked in DynamoDB user_preferences. If preferences unavailable, tour shows every login (annoying but functional).
- **Tooltips are HTML title or aria-label** — no custom tooltip library for MVP. Upgrade to styled tooltips post-MVP if needed.

## References

- [Design](../design.md) — Frontend architecture
- [North Star](../north-star.md) — Onboarding declarations
- [React Joyride](https://react-joyride.com/) — guided tour library

## Error Policy

Tour fails to load: skip silently, don't block login. Preferences write fails: tour may repeat next login (acceptable). Help modal content is static — no API dependency.
