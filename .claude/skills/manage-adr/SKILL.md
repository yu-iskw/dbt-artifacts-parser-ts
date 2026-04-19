---
name: manage-adr
description: Manage Architecture Decision Records (ADRs). Use this to initialize, create, list, and link ADRs to document architectural evolution. Requires 'adr-tools' to be installed.
---

# Manage Architecture Decision Records (ADRs)

Architecture Decision Records (ADRs) are a lightweight way to document the "why" behind significant technical choices.

## Decision Significance Criteria

Use ADRs for decisions that meet one or more of the following criteria:

- **Architectural Impact**: Changes the fundamental structure or flow of the system.
- **Cross-Package/Domain**: Decisions that affect multiple packages in the monorepo.
- **Strategic Direction**: Significant choices that set a precedent for future development.
- **Non-Obvious Trade-offs**: Choosing between multiple valid approaches where the choice isn't purely technical or has long-term implications.

Do **NOT** use ADRs for:

- **Implementation Specifications**: Detailed API schemas, specific function signatures, or local implementation details (use design docs, README, or code instead).
- **Bug Fixes**: Unless the fix requires a significant architectural change.
- **Routine Changes**: Minor refactorings or style updates.

## ADR (Why) vs. Design Docs / Code (How)

A clear distinction must be maintained:

- **ADR**: Focuses on the **Why**. It documents the decision, the context, the alternatives considered, and the high-level architecture. It is the source of truth for architectural evolution.
- **Design docs, README, and code**: Focus on the **How**. Detailed proposal, technical specifications, design, and implementation tasks live in design docs, package READMEs, or code comments.

When an ADR requires implementation, link to design docs or relevant code in the `References` section.

## Content boundaries (required)

### Include in the ADR

- Context, **alternatives considered**, Decision, Consequences, **trade-offs**
- **Stable invariants** (rules that should survive refactors)
- Links to related ADRs

### Keep out of the ADR

Put these in code, package README, or config instead:

- Long file path lists and “directory listing” decisions
- Duplicated **threshold tables** from ESLint, Vitest, or coverage scripts
- Exhaustive component or filename inventories
- Copy-pasted **hex palettes** or token values that already live in `tokens.css` (or equivalent)

### Pointers

- At most **one coarse pointer per concern** (package or subsystem), e.g. “timeline
  focus-edge behavior in `@dbt-tools/web` Gantt stack”—not five relative paths.

## Anti-patterns (do not)

- A Decision section that reads like a **folder tree** or file manifest
- An Amendment whose only purpose is to **update paths** after a move (intent unchanged)
- Mermaid diagrams that mirror **repository layout** instead of concepts, boundaries, or data flow—unless the ADR is literally about repository layout

## When to Use

- When making a significant architectural change.
- When choosing between multiple technical approaches.
- When standardizing a pattern across the codebase.
- When you want to understand previous design decisions (use `list`).

## Relationship to `mend-adr`

`manage-adr` is for **authoring** and lifecycle (create, supersede, link, organize).
`mend-adr` is the **drift** workflow.

Run `mend-adr` when behavior may no longer match an Accepted ADR. It audits **intent and
stable facts first**; volatile implementation detail belongs in **living sources**
(config, code, READMEs). Amendments should be **short and decision-level**, not copies
of eslint tables or file inventories. Optional `docs/design/` notes are fine for deep
maps if the team maintains them; otherwise use coarse pointers only.

## Instructions

### 1. Initialization

If ADRs are not yet initialized in the project, run:

```bash
adr init docs/adr
```

This ensures records are created in `docs/adr`.

### 2. Creating a New ADR

To create a new ADR, use the provided script to ensure non-interactive creation:

```bash
.claude/skills/manage-adr/scripts/create-adr.sh "Title of the ADR"
```

After creation, the script will output the filename. You **MUST** then edit the file to fill in the Context, Decision, and Consequences.

### 3. Superseding an ADR

If a new decision replaces an old one, use the `-s` flag:

```bash
.claude/skills/manage-adr/scripts/create-adr.sh -s <old-adr-number> "New Decision Title"
```

### 4. Linking ADRs

To link two existing ADRs (e.g., ADR 12 amends ADR 10):

```bash
adr link 12 Amends 10 "Amended by"
```

### 5. Listing and Viewing

- List all ADRs: `adr list`
- Read a specific ADR: `read_file docs/adr/NNNN-title.md`

### 6. Generating Reports

- Generate a Table of Contents: `adr generate toc`
- Generate a dependency graph (requires Graphviz): `adr generate graph | dot -Tpng -o adr-graph.png`

### 7. Adding Visualizations with Mermaid

Use Mermaid diagrams to visualize architectural decisions, system designs, and relationships. Diagrams render automatically in GitHub and most Markdown viewers.

#### When to Add Diagrams

- Prefer **conceptual** diagrams (data flow, trust boundaries, user-visible behavior)
  over **file-tree** diagrams unless the decision is specifically about repository layout
- **System Architecture**: Show component relationships, data flow, and system boundaries
- **Software Architecture**: Illustrate module organization, package dependencies, and code structure
- **Sequence Diagrams**: Document interaction flows, API call sequences, or decision processes
- **Concept Diagrams**: Visualize abstract concepts, relationships, or decision trees
- **State Diagrams**: Show state transitions, workflows, or lifecycle processes
- **Class/Type Diagrams**: Document type relationships, hierarchies, or interfaces

#### How to Add Diagrams

1. **Place diagrams** in the "Decision" or "Architecture" section of your ADR
2. **Use code blocks** with `mermaid` language identifier:

```markdown
### Architecture

\`\`\`mermaid
graph TB
A[Component A] --> B[Component B]
B --> C[Component C]
\`\`\`
```

1. **Provide context**: Add a brief description before the diagram explaining what it visualizes
2. **Keep focused**: One diagram per concept - create multiple diagrams if needed

#### Diagram Examples

See `references/mermaid-diagrams.md` for comprehensive examples including:

- System architecture diagrams
- Software architecture diagrams
- Sequence diagrams
- Concept diagrams
- Component diagrams
- State diagrams
- Class/type diagrams
- Common patterns (before/after, decision flows, dependency graphs)

#### Quick Reference

Common diagram types for ADRs:

- **`graph TB`** or **`graph LR`**: System/software architecture, component relationships
- **`sequenceDiagram`**: Interaction flows, API sequences, decision processes
- **`flowchart TD`**: Decision trees, workflows, process flows
- **`stateDiagram-v2`**: State transitions, lifecycle processes
- **`classDiagram`**: Type relationships, class hierarchies

## Best Practices

- Keep ADRs focused on a single high-level decision.
- Write for future maintainers who lack current context.
- **Always include "Alternatives Considered" and "Trade-offs"** in the Context or Decision section.
- Focus on the **Why** (Rationale) rather than the **How** (Implementation details).
- Update the status and links when decisions change.
- **Use Mermaid diagrams** to visualize complex decisions, architectures, and relationships. See section 7 above for guidance.
- Refer to `references/adr-granularity.md` for guidance on ADR granularity.
- Refer to `references/mermaid-diagrams.md` for diagram examples and patterns.
- Refer to `references/adr-concepts.md` for ADR philosophy and external links.
- Use [`assets/template.md`](./assets/template.md) as a structural guide for new records.
