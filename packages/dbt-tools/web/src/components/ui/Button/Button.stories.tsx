import type { Meta, StoryObj } from "@storybook/react";
import { Button, IconButton } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger", "ghost"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: "Primary button", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Danger: Story = {
  args: { children: "Delete", variant: "danger" },
};

export const Ghost: Story = {
  args: { children: "Cancel", variant: "ghost" },
};

export const Small: Story = {
  args: { children: "Small", variant: "primary", size: "sm" },
};

export const Large: Story = {
  args: { children: "Large action", variant: "primary", size: "lg" },
};

export const Disabled: Story = {
  args: { children: "Disabled", variant: "primary", disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
  </svg>
);

export const IconButtonStory: StoryObj<typeof IconButton> = {
  name: "IconButton",
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-3)" }}>
      <IconButton label="Close">
        <CloseIcon />
      </IconButton>
      <IconButton label="Close (disabled)" disabled>
        <CloseIcon />
      </IconButton>
    </div>
  ),
};
