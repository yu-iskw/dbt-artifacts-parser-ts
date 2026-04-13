# Deep Problem Solving

**Deep problem solving** is an interactive variant of the [problem-solving](../problem-solving/) workflow. It forces **deep framing**, then **exactly ten** multiple-choice questions (one per turn), then a **scored comparison** and recommendation—so the agent does not jump to a final answer after the first prompt.

## vs `problem-solving`

Both skills perform an XY-aware analysis and produce scored approaches (default 5) with a structured report. **This skill adds a mandatory ten-question discovery phase** so priorities, constraints, and risk tolerance are elicited before the final evaluation—typically higher alignment cost (more turns) and a relatively narrower direction once questions steer the problem. **[`problem-solving`](../problem-solving/)** is better when you want a **single-pass** comparison quickly or when your prompt already encodes enough context.

A practical combo: run **`problem-solving`** to explore a wide option space, then feed a summary into **`deep-problem-solving`** to lock assumptions and re-score.

---

## For users

### When to use

- You want to explore trade-offs before choosing an architecture or strategy.
- You suspect an **XY problem** (you may be asking for the wrong thing relative to your goal).
- You need a **rigorous** report with multiple approaches and a **0–100** scoring matrix after your priorities are clarified.

### When to use `problem-solving` instead

Use [`problem-solving`](../problem-solving/SKILL.md) when you already know your constraints and want a single-pass analysis without the ten-question discovery phase.

### Triggers

- “Deep problem solving” / “interactive evaluation” / “don’t jump to a solution”
- “Ask me questions first, then compare options with scores”
- “XY problem” / “what am I really trying to solve?”

#### Examples

##### Claude Code

```bash
claude "/deep-problem-solving We are debating microservices vs modular monolith for our API."
```

##### Cursor

```text
@skills/deep-problem-solving Help me decide how to handle session storage for our mobile app; use the full interactive workflow.
```

### Output

After ten questions, an **Intent & Issue Analysis Report** (see [references/full-report-template.md](references/full-report-template.md)) with approaches, scoring matrix, and recommendation.

---

## For developers

### Directory layout

```text
deep-problem-solving/
├── SKILL.md
├── README.md
└── references/
    └── full-report-template.md
```
