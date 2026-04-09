import { createZapierSdk } from "@zapier/zapier-sdk";

async function main() {
  // Create the SDK client.
  // By default it reads credentials from a prior `npx zapier-sdk login`,
  // or you can pass credentials explicitly:
  //   createZapierSdk({ credentials: process.env.ZAPIER_CREDENTIALS })
  //   createZapierSdk({ credentials: { clientId: "...", clientSecret: "..." } })
  const zapier = createZapierSdk();

  // 1. Show who's logged in
  const { data: profile } = await zapier.getProfile();
  console.log(`Logged in as: ${profile.email}\n`);

  // 2. List connected apps
  console.log("Your connections:");
  const { data: connections } = await zapier.listConnections({ owner: "me" });
  for (const conn of connections) {
    console.log(`  - ${conn.title ?? conn.app_key} (ID: ${conn.id}, expired: ${conn.is_expired})`);
  }

  // 3. List available actions for an app (example: Slack)
  console.log("\nSlack actions:");
  const { data: actions } = await zapier.listActions({ app: "slack" });
  for (const action of actions) {
    console.log(`  [${action.type}] ${action.key} — ${action.title}`);
  }

  // 4. Run an action — read Slack channels
  //    Replace the connection ID with your own Slack connection ID.
  // const { data: channels } = await zapier.runAction({
  //   app: "slack",
  //   actionType: "read",
  //   action: "channels",
  //   connection: "<YOUR_SLACK_CONNECTION_ID>",
  //   inputs: {},
  // });
  // console.log("\nSlack channels:", channels);
}

main().catch(console.error);
