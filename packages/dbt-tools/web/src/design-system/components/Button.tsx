import type { ButtonHTMLAttributes } from "react";

export type DsButtonVariant = "primary" | "secondary" | "ghost";

export type DsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: DsButtonVariant;
};

const VARIANT_CLASS: Record<DsButtonVariant, string> = {
  primary: "ds-button ds-button--primary",
  secondary: "ds-button ds-button--secondary",
  ghost: "ds-button ds-button--ghost",
};

/**
 * Design-system button — uses component tokens only (no raw palette in styles).
 */
export function DsButton({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: DsButtonProps) {
  const base = VARIANT_CLASS[variant];
  return (
    <button
      type={type}
      className={[base, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
