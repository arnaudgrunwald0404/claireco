import readline from "readline";
import { ClireAgent } from "./agent.js";
import { getProfile } from "./zapier.js";

async function main() {
  console.log("ClireC0 — AI-powered Zapier automation CLI");
  console.log("============================================");

  try {
    const email = await getProfile();
    console.log(`Logged in as: ${email}\n`);
  } catch {
    console.warn("Could not fetch profile. Check your Zapier credentials.\n");
  }

  const agent = new ClireAgent();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You> ",
  });

  console.log('Type a command (e.g. "list my connections", "send a Slack message") or "exit" to quit.\n');

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (input.toLowerCase() === "reset") {
      agent.reset();
      console.log("Conversation reset.\n");
      rl.prompt();
      return;
    }

    try {
      const response = await agent.chat(input);
      console.log(`\nClireC0> ${response}\n`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }

    rl.prompt();
  });
}

main().catch(console.error);
