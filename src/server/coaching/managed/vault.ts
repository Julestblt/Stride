import "server-only";
import { managedClient, managedResources } from "./resources";

const userKey = "stride_user_id";

async function findAthleteVault(userId: string) {
  for await (const vault of managedClient().beta.vaults.list()) {
    if (vault.metadata?.[userKey] === userId && !vault.archived_at)
      return vault.id;
  }
  return null;
}

export async function syncAthleteVault(userId: string, accessToken: string) {
  const client = managedClient();
  const vaultId =
    (await findAthleteVault(userId)) ??
    (
      await client.beta.vaults.create({
        display_name: `Stride athlete ${userId.slice(0, 8)}`,
        metadata: { [userKey]: userId },
      })
    ).id;

  let credentialId: string | null = null;
  for await (const credential of client.beta.vaults.credentials.list(vaultId)) {
    if (
      !credential.archived_at &&
      credential.auth.type === "static_bearer" &&
      credential.auth.mcp_server_url === managedResources.garminMcpUrl
    )
      credentialId = credential.id;
  }

  if (credentialId)
    await client.beta.vaults.credentials.update(credentialId, {
      vault_id: vaultId,
      auth: { type: "static_bearer", token: accessToken },
    });
  else
    await client.beta.vaults.credentials.create(vaultId, {
      display_name: "garmin_mcp",
      auth: {
        type: "static_bearer",
        token: accessToken,
        mcp_server_url: managedResources.garminMcpUrl,
      },
    });

  return vaultId;
}
