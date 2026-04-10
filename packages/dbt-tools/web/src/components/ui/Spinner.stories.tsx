import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./Spinner";

const meta: Meta<typeof Spinner> = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: { control: { type: "range", min: 16, max: 64, step: 4 } },
    label: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: { size: 24 },
};

export const Large: Story = {
  args: { size: 48, label: "Loading workspace" },
};

export const Small: Story = {
  args: { size: 16 },
};

export const WithLabel: Story = {
  args: { size: 32, label: "Analyzing artifacts" },
};
