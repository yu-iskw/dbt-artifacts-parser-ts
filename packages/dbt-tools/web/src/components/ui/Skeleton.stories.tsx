import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    style: { width: 200, height: 20 },
  },
};

export const Circle: Story = {
  args: {
    style: { width: 48, height: 48, borderRadius: "var(--radius-full)" },
  },
};

export const CardPlaceholder: Story = {
  render: () => (
    <div
      style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}
    >
      <Skeleton
        style={{ width: 48, height: 48, borderRadius: "var(--radius-md)" }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <Skeleton style={{ width: 160, height: 16 }} />
        <Skeleton style={{ width: 240, height: 12 }} />
      </div>
    </div>
  ),
};
