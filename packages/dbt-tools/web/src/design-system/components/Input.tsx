import type { InputHTMLAttributes } from "react";
import { cx } from "../foundations/cx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return <input className={cx("ds-input", className)} {...props} />;
}
