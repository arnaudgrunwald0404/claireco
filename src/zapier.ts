import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk();

export interface Connection {
  id: string;
  app_key: string;
  title?: string | null;
  is_expired?: string | boolean;
}

export interface Action {
  type: string;
  key: string;
  title: string;
}

export async function getProfile(): Promise<string> {
  const { data } = await zapier.getProfile();
  return data.email;
}

export async function listConnections(): Promise<Connection[]> {
  const { data } = await zapier.listConnections({ owner: "me" });
  return data as unknown as Connection[];
}

export async function listActions(app: string): Promise<Action[]> {
  const { data } = await zapier.listActions({ app });
  return data as Action[];
}

export async function runAction(
  app: string,
  actionType: string,
  action: string,
  connection: string,
  inputs: Record<string, unknown>
): Promise<unknown> {
  const { data } = await zapier.runAction({
    app,
    actionType: actionType as "read" | "write" | "search" | "filter" | "read_bulk" | "run" | "search_and_write" | "search_or_write",
    action,
    connection,
    inputs,
  });
  return data;
}
