import type { InputHTMLAttributes } from "react";

export type DsInputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Text input — maps to input.* component tokens.
 */
export function DsInput({ className = "", ...rest }: DsInputProps) {
  return (
    <input className={["ds-input", className].filter(Boolean).join(" ")} {...rest} />
  );
}
