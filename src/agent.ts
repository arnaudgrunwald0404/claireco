import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages.js";
import * as zapier from "./zapier.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are ClireC0, an AI assistant that can execute real automations across the user's connected apps via Zapier.

When the user asks you to do something (e.g. "send a Slack message", "create a calendar event", "add a row to my spreadsheet"), you should:
1. Use list_connections to find the right connected account
2. Use list_actions to find the exact action key and type
3. Use run_action to execute it

Always confirm what you did after running an action. If inputs are missing (e.g. no channel specified), ask the user before proceeding.
Be concise and action-oriented.`;

const TOOLS: Tool[] = [
  {
    name: "list_connections",
    description: "List all of the user's connected apps in Zapier. Returns connection IDs, app keys, titles, and expiry status.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_actions",
    description: "List available actions for a specific app. Use the app's key (e.g. 'slack', 'gmail', 'google-calendar').",
    input_schema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description: "The app key to list actions for (e.g. 'slack', 'gmail')",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "run_action",
    description: "Execute a Zapier action for a connected app.",
    input_schema: {
      type: "object" as const,
      properties: {
        app: { type: "string", description: "The app key (e.g. 'slack')" },
        action_type: { type: "string", description: "The action type: 'read', 'write', or 'search'" },
        action: { type: "string", description: "The action key (from list_actions)" },
        connection_id: { type: "string", description: "The connection ID from list_connections" },
        inputs: {
          type: "object",
          description: "Key-value pairs of inputs for the action",
          additionalProperties: true,
        },
      },
      required: ["app", "action_type", "action", "connection_id", "inputs"],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === "list_connections") {
      const connections = await zapier.listConnections();
      if (connections.length === 0) return "No connections found.";
      return JSON.stringify(connections, null, 2);
    }

    if (name === "list_actions") {
      const actions = await zapier.listActions(input.app as string);
      if (actions.length === 0) return `No actions found for app: ${input.app}`;
      return JSON.stringify(actions, null, 2);
    }

    if (name === "run_action") {
      const result = await zapier.runAction(
        input.app as string,
        input.action_type as string,
        input.action as string,
        input.connection_id as string,
        (input.inputs as Record<string, unknown>) ?? {}
      );
      return JSON.stringify(result, null, 2);
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export class ClireAgent {
  private history: MessageParam[] = [];

  async chat(userMessage: string): Promise<string> {
    this.history.push({ role: "user", content: userMessage });

    while (true) {
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: this.history,
      });

      // Collect text and tool_use blocks from response
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");

      this.history.push({ role: "assistant", content: response.content });

      // If no tool calls, we're done — return the final text
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        const text = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
        return text.trim() || "(no response)";
      }

      // Execute all tool calls and feed results back
      const toolResults: ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") throw new Error("unexpected block type");
          const output = await executeTool(block.name, block.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: output,
          };
        })
      );

      this.history.push({ role: "user", content: toolResults });
    }
  }

  reset(): void {
    this.history = [];
  }
}
