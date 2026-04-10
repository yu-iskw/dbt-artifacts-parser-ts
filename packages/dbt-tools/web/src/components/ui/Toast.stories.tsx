import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider, useToast } from "./Toast";
import { Button } from "./Button/Button";

function ToastDemo({ tone, message }: { tone: string; message: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        toast(message, tone as "positive" | "warning" | "danger" | "neutral")
      }
    >
      Show {tone} toast
    </Button>
  );
}

const meta: Meta = {
  title: "UI/Toast",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj;

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <ToastDemo tone="positive" message="Changes saved successfully." />
      <ToastDemo tone="warning" message="Artifacts may be stale." />
      <ToastDemo tone="danger" message="Failed to load run results." />
      <ToastDemo tone="neutral" message="Copied to clipboard." />
    </div>
  ),
};
