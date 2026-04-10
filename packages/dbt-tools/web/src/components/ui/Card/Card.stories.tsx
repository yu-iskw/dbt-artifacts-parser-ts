import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    elevation: {
      control: "select",
      options: ["flat", "default", "elevated"],
    },
    compact: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <Card.Header>
        <h3>Card title</h3>
      </Card.Header>
      <Card.Body>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Card body content goes here. It uses tokens for spacing and colors.
        </p>
      </Card.Body>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <Card.Header>
        <h3>Panel</h3>
      </Card.Header>
      <Card.Body>
        <p style={{ margin: 0 }}>Some content.</p>
      </Card.Body>
      <Card.Footer>
        <span
          style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}
        >
          Updated 2 hours ago
        </span>
      </Card.Footer>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card elevation="elevated" style={{ width: 360 }}>
      <Card.Body>
        <p style={{ margin: 0 }}>An elevated card with stronger shadow.</p>
      </Card.Body>
    </Card>
  ),
};

export const Flat: Story = {
  render: () => (
    <Card elevation="flat" style={{ width: 360 }}>
      <Card.Body>
        <p style={{ margin: 0 }}>A flat card with no shadow.</p>
      </Card.Body>
    </Card>
  ),
};

export const Compact: Story = {
  render: () => (
    <Card compact style={{ width: 320 }}>
      <Card.Header>
        <h3>Compact</h3>
      </Card.Header>
      <Card.Body>
        <p style={{ margin: 0 }}>Denser padding for tight layouts.</p>
      </Card.Body>
    </Card>
  ),
};
