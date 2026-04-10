import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cx } from "../foundations/cx";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cx("ds-button", className)}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  );
}
