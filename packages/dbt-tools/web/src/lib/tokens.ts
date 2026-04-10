/**
 * AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
 */

export const tokens = {
  "semantic.color.bg.canvas": "var(--dt-semantic-color-bg-canvas)",
  "semantic.color.bg.surface": "var(--dt-semantic-color-bg-surface)",
  "semantic.color.bg.surfaceMuted": "var(--dt-semantic-color-bg-surfaceMuted)",
  "semantic.color.bg.accentSoft": "var(--dt-semantic-color-bg-accentSoft)",
  "semantic.color.text.primary": "var(--dt-semantic-color-text-primary)",
  "semantic.color.text.secondary": "var(--dt-semantic-color-text-secondary)",
  "semantic.color.text.muted": "var(--dt-semantic-color-text-muted)",
  "semantic.color.text.inverse": "var(--dt-semantic-color-text-inverse)",
  "semantic.color.border.subtle": "var(--dt-semantic-color-border-subtle)",
  "semantic.color.border.default": "var(--dt-semantic-color-border-default)",
  "semantic.color.border.focus": "var(--dt-semantic-color-border-focus)",
  "semantic.color.action.primary": "var(--dt-semantic-color-action-primary)",
  "semantic.color.action.primaryHover": "var(--dt-semantic-color-action-primaryHover)",
  "semantic.color.status.success": "var(--dt-semantic-color-status-success)",
  "semantic.color.status.warning": "var(--dt-semantic-color-status-warning)",
  "semantic.color.status.danger": "var(--dt-semantic-color-status-danger)",
  "semantic.color.status.info": "var(--dt-semantic-color-status-info)",
  "component.button.primary.bg": "var(--dt-component-button-primary-bg)",
  "component.button.primary.bgHover": "var(--dt-component-button-primary-bgHover)",
  "component.button.primary.text": "var(--dt-component-button-primary-text)",
  "component.button.primary.radius": "var(--dt-component-button-primary-radius)",
  "component.button.primary.paddingInline": "var(--dt-component-button-primary-paddingInline)",
  "component.button.primary.paddingBlock": "var(--dt-component-button-primary-paddingBlock)",
  "component.button.secondary.bg": "var(--dt-component-button-secondary-bg)",
  "component.button.secondary.text": "var(--dt-component-button-secondary-text)",
  "component.button.secondary.border": "var(--dt-component-button-secondary-border)",
  "component.input.bg": "var(--dt-component-input-bg)",
  "component.input.text": "var(--dt-component-input-text)",
  "component.input.placeholder": "var(--dt-component-input-placeholder)",
  "component.input.border": "var(--dt-component-input-border)",
  "component.input.focusRing": "var(--dt-component-input-focusRing)",
  "component.input.radius": "var(--dt-component-input-radius)",
  "component.input.paddingInline": "var(--dt-component-input-paddingInline)",
  "component.input.paddingBlock": "var(--dt-component-input-paddingBlock)",
} as const;

export type TokenName =
  | "semantic.color.bg.canvas"
  | "semantic.color.bg.surface"
  | "semantic.color.bg.surfaceMuted"
  | "semantic.color.bg.accentSoft"
  | "semantic.color.text.primary"
  | "semantic.color.text.secondary"
  | "semantic.color.text.muted"
  | "semantic.color.text.inverse"
  | "semantic.color.border.subtle"
  | "semantic.color.border.default"
  | "semantic.color.border.focus"
  | "semantic.color.action.primary"
  | "semantic.color.action.primaryHover"
  | "semantic.color.status.success"
  | "semantic.color.status.warning"
  | "semantic.color.status.danger"
  | "semantic.color.status.info"
  | "component.button.primary.bg"
  | "component.button.primary.bgHover"
  | "component.button.primary.text"
  | "component.button.primary.radius"
  | "component.button.primary.paddingInline"
  | "component.button.primary.paddingBlock"
  | "component.button.secondary.bg"
  | "component.button.secondary.text"
  | "component.button.secondary.border"
  | "component.input.bg"
  | "component.input.text"
  | "component.input.placeholder"
  | "component.input.border"
  | "component.input.focusRing"
  | "component.input.radius"
  | "component.input.paddingInline"
  | "component.input.paddingBlock"
;

export function tokenVar(name: TokenName): string {
  return tokens[name];
}
