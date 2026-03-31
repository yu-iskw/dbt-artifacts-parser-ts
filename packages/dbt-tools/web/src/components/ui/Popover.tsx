import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Anchored dropdown panel: click-outside and Escape close; basic Tab focus trap while open.
 */
export function Popover({
  open,
  onOpenChange,
  triggerLabel,
  triggerClassName,
  triggerAriaDescribedBy,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  triggerLabel: string;
  triggerClassName?: string;
  triggerAriaDescribedBy?: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const first =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel || !panel.contains(document.activeElement)) return;
      const nodes = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="ui-popover" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "ui-popover__trigger"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={triggerAriaDescribedBy}
        aria-haspopup="dialog"
        onClick={() => {
          if (open) {
            onOpenChange(false);
            triggerRef.current?.focus();
          } else {
            onOpenChange(true);
          }
        }}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="ui-popover__panel"
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
