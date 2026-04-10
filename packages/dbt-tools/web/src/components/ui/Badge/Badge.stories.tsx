import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "accent", "success", "warning", "danger", "info"],
    },
    dot: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {
  args: { children: "Default", tone: "neutral" },
};

export const Accent: Story = {
  args: { children: "New", tone: "accent" },
};

export const Success: Story = {
  args: { children: "Passed", tone: "success", dot: true },
};

export const Warning: Story = {
  args: { children: "Warn", tone: "warning", dot: true },
};

export const Danger: Story = {
  args: { children: "Error", tone: "danger", dot: true },
};

export const Info: Story = {
  args: { children: "Info", tone: "info" },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="accent">Accent</Badge>
      <Badge tone="success" dot>
        Success
      </Badge>
      <Badge tone="warning" dot>
        Warning
      </Badge>
      <Badge tone="danger" dot>
        Danger
      </Badge>
      <Badge tone="info">Info</Badge>
    </div>
  ),
};
