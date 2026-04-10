import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Underline: Story = {
  render: () => (
    <Tabs defaultTab="overview">
      <Tabs.List label="View tabs">
        <Tabs.Tab id="overview">Overview</Tabs.Tab>
        <Tabs.Tab id="details">Details</Tabs.Tab>
        <Tabs.Tab id="logs">Logs</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="overview">
        <p>Overview content here.</p>
      </Tabs.Panel>
      <Tabs.Panel id="details">
        <p>Details content here.</p>
      </Tabs.Panel>
      <Tabs.Panel id="logs">
        <p>Log output here.</p>
      </Tabs.Panel>
    </Tabs>
  ),
};

export const Pill: Story = {
  name: "Pill / Segmented",
  render: () => (
    <Tabs defaultTab="runs">
      <Tabs.List variant="pill" label="Metric view">
        <Tabs.Tab id="runs">Runs</Tabs.Tab>
        <Tabs.Tab id="nodes">Nodes</Tabs.Tab>
        <Tabs.Tab id="tests">Tests</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="runs">
        <p>Run data.</p>
      </Tabs.Panel>
      <Tabs.Panel id="nodes">
        <p>Node data.</p>
      </Tabs.Panel>
      <Tabs.Panel id="tests">
        <p>Test data.</p>
      </Tabs.Panel>
    </Tabs>
  ),
};
