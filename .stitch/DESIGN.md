# Wizzdom Adaptive Learning Demo Design System

This document is the source of truth for the Assessment V2 demo experience. It translates the Wizzdom reference screens into product UI guidance for the adaptive learning loop.

## Product Vibe

Wizzdom should feel calm, bright, precise, and encouraging. The interface is educational technology, but it should not feel like an enterprise dashboard for students. It should feel like a friendly intelligent tutor that can explain its reasoning.

Design keywords:
- clean white canvas
- electric blue primary action
- soft rounded cards
- generous spacing
- simple proof-like explanations
- visible progress through the loop
- serious enough for teachers, calm enough for students

Avoid:
- dark default app chrome on student-facing demo screens
- decorative gradient blobs
- dense graph views for students
- score-first language
- aggressive red failure states
- tiny academic tables as the primary presentation

## Palette

Primary:
- Wizzdom Blue: `#2f66f5`
- Bright Blue: `#2589ff`
- Blue Tint: `#eef5ff`
- Blue Border: `#cfe0ff`

Neutrals:
- Page Background: `#f6f8ff`
- White Surface: `#ffffff`
- Ink: `#202738`
- Secondary Text: `#697386`
- Soft Border: `#dfe7f7`
- Muted Surface: `#f8fbff`

Status:
- Strong/Mastered: `#18b66a`
- Review/Gap: `#f04438`
- Possibly Affected: `#f5a524`
- Unknown: `#98a2b3`
- Highlight/Recommendation: `#2f66f5`

Accent:
- Star Yellow: `#ffd166`
- Warm Tint: `#fff8df`
- Warm Border: `#ffe4a3`

## Typography

Use Inter for now. The reference branding uses a rounded, friendly sans; if the brand font is provided later, map it onto these roles.

Type roles:
- Hero heading: 40-48px desktop, 32-36px mobile, weight 800, line-height near 1.05.
- Section heading: 28-36px, weight 800.
- Card title: 18-22px, weight 800.
- Body: 16-18px, weight 500, line-height 1.5.
- Metadata/chips: 12-14px, weight 750-900.

Do not scale font size with viewport width. Use breakpoint-specific sizes only.

## Shape And Layout

Student demo screens:
- Main container max width around 1180px.
- Card radius: 22-28px.
- Input radius: 16-18px.
- Button radius: 16-18px.
- Use subtle blue-tinted shadows, not heavy dark shadows.
- Do not nest cards deeply; use one card surface plus internal panels.

Teacher/internal screens:
- Can be denser.
- Keep graph/audit visual language, but still use the same blue, white, and status palette.

## Buttons

Primary button:
- Blue fill, white text.
- Used for forward motion: start diagnostic, submit, start lesson, mastery check.

Secondary button:
- Pale blue-gray fill.
- Used for safe alternatives: reset, back to map, I don't know.

Ghost button:
- White fill with blue border/text.
- Used for demo controls like Pitch demo.

Include icons for product actions when available via `lucide-react`.

## Learning Loop UI Pattern

The pitch demo must make the loop visible:

1. Assess
   - Open-ended question
   - No immediate correctness feedback
   - Explain that the graph selects the next question

2. Map
   - Simplified knowledge map
   - Strong, review, affected, unknown states
   - Highlight one recommended next skill

3. Learn
   - Micro-lesson, not a long course page
   - Core idea
   - Worked example
   - One guided practice

4. Mastery
   - Narrow check on the learned skill
   - Deterministic math input
   - No multiple-choice

5. Outcome
   - Map visibly updates
   - Explain what unlocked next
   - Show product-value metrics

## Student Result Language

Use:
- "Strong area"
- "Skill to review"
- "Possibly affected"
- "Not enough evidence"
- "Ready to learn next"
- "Mastery confirmed"

Avoid:
- "Fail"
- "Weak student"
- "Wrong knowledge"
- "Score"
- "Deficiency"

## Knowledge Map

Student map:
- Show a small curated map, not the full dense graph.
- Each node should show KC code, short name, state label, and confidence.
- The recommended node gets a blue ring.
- After mastery, the learned node should visibly change to mastered.

Academic map:
- May show full graph with prerequisite edges.
- Must distinguish direct tested evidence from inferred evidence.

## Motion

Use subtle motion:
- Node/card fade-in and slight upward movement.
- Button hover lifts by 1px.
- Avoid bouncy or playful motion that makes assessment feel unserious.

## Current Demo Route

Primary route:
- `/assessment-v2/algebra`

Required demo path:
- Intro
- Pitch demo
- Knowledge map
- Targeted lesson
- Mastery check
- Updated map

Real-session path:
- Start real diagnostic
- Complete assessment
- Result map with backend-provided learning loop
- Persist mastery check to session payload
