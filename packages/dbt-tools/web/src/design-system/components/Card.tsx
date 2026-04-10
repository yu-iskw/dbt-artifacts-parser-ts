import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "../foundations/cx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({
  children,
  className,
  ...props
}: PropsWithChildren<CardProps>) {
  return (
    <section className={cx("ds-card", className)} {...props}>
      {children}
    </section>
  );
}
