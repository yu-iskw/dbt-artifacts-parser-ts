# Problem Solving

The **Problem Solving** skill is a powerful diagnostic and problem-solving framework. It is designed to help Agents go beyond the surface-level request (the "X") to find the user's true underlying intent (the "Y"), thereby avoiding the common **XY Problem**.

---

## 👩‍💻 For Users

### Introduction

Sometimes, we ask for a solution to a problem we _think_ we have, rather than the goal we are actually trying to achieve. This skill forces the Agent to pause and evaluate whether your request is the best way to reach your goal. It then brainstorms multiple approaches, scores them rigorously, and presents a clear recommendation.

### Usage

You can trigger this skill when you have a complex decision to make or when you want a deep dive into an architectural or technical problem.

**Triggers:**

- "Analyze the approaches for [problem]"
- "Help me decide how to implement [feature]"
- "How should we solve [issue]? Give me multiple options."
- "What is the best way to [goal]?"

#### Examples for AI Agents

##### Claude Code

```bash
claude "/problem-solving Analyze the approaches for migrating our database to PostgreSQL"
```

##### Cursor (Chat or Composer)

You can reference the skill folder to provide context:

```text
/problem-solving Analyze the best way to implement a distributed locking mechanism.
```

**Example Interaction:**

> **User**: "How do I use regex to parse this JSON-like log file?"
>
> **Agent**: _Recognizes potential XY problem (regex is poor for structured data). Triggers `problem-solving`._
> "I've analyzed your request. While you asked for regex, your underlying goal is to reliably extract data from these logs. Here is a report comparing regex, native JSON parsing, and specialized log processors..."

### Output

The skill produces a structured **Intent & Issue Analysis Report** including:

- **XY Problem Check**: An evaluation of whether your stated request aligns with your root goal.
- **Multiple Approaches**: Usually 5 different ways to solve the problem.
- **Scoring Matrix**: A comparison of approaches based on Feasibility, Performance, etc.
- **Final Recommendation**: A data-driven verdict on the best path forward.

---

## 🛠️ For Developers

### Workflow

This skill follows a structured five-step process:

1.  **Analyze Intent**: Identifies the difference between the **Stated Problem (X)** and the **Underlying Intent (Y)**.
2.  **Brainstorm**: Generates $n$ approaches (default: 5) that satisfy the root goal (Y).
3.  **Define Criteria**: Tailors scoring criteria (e.g., Security, Scalability) to the specific problem.
4.  **Score**: Assigns 0-100 scores to each approach.
5.  **Report**: Renders the final output using the `analysis-report.md` template.

### Parameters

- **$n$ (Number of Approaches)**: Defaults to 5. The user can override this by specifying a different number in their query (e.g., "Give me 3 options for...").

### Directory Structure

```text
problem-solving/
├── SKILL.md                 # The "brain": instructions for the Agent
├── README.md                # This file
└── assets/
    └── templates/
        └── analysis-report.md # Template for the final report
```
