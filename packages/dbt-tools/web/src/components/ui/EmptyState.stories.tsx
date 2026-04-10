import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button/Button";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: "\u{1F50D}",
    headline: "No matching rows",
    subtext: "Try adjusting the status filter or search query.",
  },
};

export const WithAction: Story = {
  args: {
    icon: "\u{1F4E6}",
    headline: "No artifacts loaded",
    subtext: "Upload dbt artifacts to get started.",
    action: (
      <Button variant="primary" size="sm">
        Upload artifacts
      </Button>
    ),
  },
};

export const Minimal: Story = {
  args: {
    headline: "Nothing here yet",
  },
};
