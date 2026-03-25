---
name: drawio-cli
description: Create, edit, or export diagrams as native .drawio (mxGraphModel) files using the draw.io desktop CLI. Use when the user asks for flowcharts, architecture, sequence, ER, or network diagrams, wireframes, mockups, UI sketches, or mentions draw.io, drawio, .drawio, or exporting diagrams to PNG, SVG, or PDF with embedded editable XML.
compatibility: Requires draw.io Desktop for CLI export (-x). macOS default /Applications/draw.io.app/Contents/MacOS/draw.io; Linux often drawio on PATH; Windows "C:\Program Files\draw.io\draw.io.exe". WSL2 can invoke the Windows exe under /mnt/c/Program Files/draw.io/draw.io.exe. Project .claude/settings.json may allow Bash(drawio *) and Bash(open *) for fewer prompts.
---

# draw.io CLI diagrams

## Workflow

1. **Choose deliverable**
   - If the user asks for **png**, **svg**, or **pdf**, plan CLI export with **embedded diagram XML** (`-e`).
   - If no format is given, write a **`.drawio`** file; the user can export later.
   - **Do not delete** the `.drawio` source if the user may want to keep editing it (for example they asked for “also export PNG”). Delete the intermediate `.drawio` **only** when the explicit goal is an embedded export **and** they do not need the standalone source.

2. **Generate XML**
   - Use **mxGraphModel** format directly (not Mermaid-as-.drawio).
   - Root shape:
     - `<mxGraphModel adaptiveColors="auto">` → `<root>` with `<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>`.
     - Diagram cells use `parent="1"` unless nested in a container (then `parent="<containerId>"` with **relative** child coordinates).
   - For styles, edges, waypoints, swimlanes, and groups, read [references/xml-reference.md](references/xml-reference.md).

3. **Write the file**
   - Use a **descriptive kebab-case** basename (e.g. `auth-flow.drawio`, `service-topology.drawio`).

4. **Export (optional)**
   - Resolve the CLI (see **CLI resolution** below). Set `DRAWIO_CMD` to the resolved binary when it is not on `PATH`.
   - Run:
     ```bash
     "$DRAWIO_CMD" -x -f <format> -e -b 10 -o <output> <input.drawio>
     ```
   - **Flags:** `-x` export; `-f` format (`png`, `svg`, `pdf`, `jpg`); `-e` embed diagram XML in png/svg/pdf; `-b` border (px); `-t` transparent background (PNG); `-s` scale; `--width` / `--height` fit (aspect preserved).
   - **Naming:** use double extensions for embedded outputs: `name.drawio.png`, `name.drawio.svg`, `name.drawio.pdf`.
   - **jpg:** no `--embed-diagram` support per draw.io CLI behavior; prefer png/svg/pdf when editability matters.

5. **If the CLI is missing**
   - Keep the `.drawio` file; tell the user to install [draw.io Desktop](https://github.com/jgraph/drawio-desktop) or open the file in the diagrams.net app.

6. **Open the result (when helpful)**
   - Use the **Opening files** table below; if the command fails, print the absolute path.

## CLI resolution

| Environment | Command or path                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS       | `/Applications/draw.io.app/Contents/MacOS/draw.io`                                                                                                                                |
| Linux       | `drawio` on PATH (`which drawio`), else install via distro package manager / snap / flatpak                                                                                       |
| Windows     | `"C:\Program Files\draw.io\draw.io.exe"`                                                                                                                                          |
| WSL2        | Windows install, e.g. /mnt/c/Program Files/draw.io/draw.io.exe — quote the path in bash; per-user installs often live under /mnt/c/Users/USERNAME/AppData/Local/Programs/draw.io/ |

Prefer `which drawio` (or `where drawio` on Windows) when the CLI might already be on `PATH`.

## Non-negotiable XML rules

- **Edges:** Every `edge="1"` cell must include a child `<mxGeometry relative="1" as="geometry" />` (expanded form). Self-closing edge `mxCell` elements are invalid.
- **IDs:** Unique `id` on every `mxCell`.
- **Escaping:** In attributes use `&amp;`, `&lt;`, `&gt;`, `&quot;` where needed.
- **Comments:** Do not put `--` inside `<!-- ... -->` (XML rule).
- **Layout:** Prefer `edgeStyle=orthogonalEdgeStyle`, generous spacing, coordinates on a 10px grid; add waypoints when edges overlap. Details: [references/xml-reference.md](references/xml-reference.md).

## Dark mode colors

With `adaptiveColors="auto"`, default stroke/fill/font colors adapt in dark mode. Use explicit hex when you need fixed colors; use `light-dark(lightHex,darkHex)` in styles only when automatic inversion is wrong. See upstream draw.io docs for `light-dark()`.

## Opening files

| Environment | Command                                      |
| ----------- | -------------------------------------------- |
| macOS       | `open <file>`                                |
| Linux       | `xdg-open <file>`                            |
| Windows     | `start <file>`                               |
| WSL2        | `cmd.exe /c start "" "$(wslpath -w <file>)"` |

## External references

- Style reference: https://www.drawio.com/doc/faq/drawio-style-reference.html
- XSD: https://www.drawio.com/assets/mxfile.xsd

## Upstream alignment

Workflow and XML rules align with the jgraph draw.io MCP CLI skill: https://raw.githubusercontent.com/jgraph/drawio-mcp/refs/heads/main/skill-cli/drawio/SKILL.md — reconcile with that source when export flags or behavior change.
