import type { HTMLAttributes, ReactNode } from "react";
import "./Card.css";

type CardElevation = "flat" | "default" | "elevated";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  compact?: boolean;
  children: ReactNode;
}

export function Card({
  elevation = "default",
  compact = false,
  className,
  children,
  ...rest
}: CardProps) {
  const cls = [
    "ui-card",
    elevation !== "default" && `ui-card--${elevation}`,
    compact && "ui-card--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["ui-card__header", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["ui-card__body", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["ui-card__footer", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
