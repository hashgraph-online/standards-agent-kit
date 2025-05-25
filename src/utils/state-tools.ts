import {
  HCS10Client,
  AgentBuilder,
  Logger,
} from '@hashgraphonline/standards-sdk';
import fs from 'fs';
import path from 'path';
import { ensureAgentHasEnoughHbar } from './ensure-agent-has-hbar';

export const ENV_FILE_PATH = path.join(process.cwd(), '.env');

export interface AgentData {
  accountId: string;
  operatorId: string;
  inboundTopicId: string;
  outboundTopicId: string;
  client: HCS10Client;
}

export interface RegistrationProgressData {
  registered: boolean;
  accountId?: string;
  privateKey?: string;
  publicKey?: string;
  inboundTopicId?: string;
  outboundTopicId?: string;
}

export async function getAgentFromEnv(
  logger: Logger,
  baseClient: HCS10Client,
  agentName: string,
  envPrefix: string
): Promise<AgentData | null> {
  const accountIdEnvVar = `${envPrefix}_ACCOUNT_ID`;
  const privateKeyEnvVar = `${envPrefix}_PRIVATE_KEY`;
  const inboundTopicIdEnvVar = `${envPrefix}_INBOUND_TOPIC_ID`;
  const outboundTopicIdEnvVar = `${envPrefix}_OUTBOUND_TOPIC_ID`;

  const accountId = process.env[accountIdEnvVar];
  const privateKey = process.env[privateKeyEnvVar];
  const inboundTopicId = process.env[inboundTopicIdEnvVar];
  const outboundTopicId = process.env[outboundTopicIdEnvVar];

  if (!accountId || !privateKey || !inboundTopicId || !outboundTopicId) {
    logger.info(`${agentName} agent not found in environment variables`);
    return null;
  }

  logger.info(`${agentName} agent found in environment variables`);
  logger.info(`${agentName} account ID: ${accountId}`);
  logger.info(`${agentName} inbound topic ID: ${inboundTopicId}`);
  logger.info(`${agentName} outbound topic ID: ${outboundTopicId}`);

  const client = new HCS10Client({
    network: 'testnet',
    operatorId: accountId,
    operatorPrivateKey: privateKey,
    guardedRegistryBaseUrl: process.env.REGISTRY_URL,
    prettyPrint: true,
    logLevel: 'debug',
  });

  await ensureAgentHasEnoughHbar(logger, baseClient, accountId, agentName);

  return {
    accountId,
    operatorId: `${inboundTopicId}@${accountId}`,
    inboundTopicId,
    outboundTopicId,
    client,
  };
}

export async function createAgent(
  logger: Logger,
  baseClient: HCS10Client,
  agentName: string,
  agentBuilder: AgentBuilder,
  envPrefix: string
): Promise<AgentData | null> {
  try {
    logger.info(`Creating ${agentName} agent...`);

    const result = await baseClient.createAndRegisterAgent(agentBuilder);

    if (!result.metadata) {
      logger.error(`${agentName} agent creation failed`);
      return null;
    }

    logger.info(`${agentName} agent created successfully`);
    logger.info(`${agentName} account ID: ${result.metadata.accountId}`);
    logger.info(`${agentName} private key: ${result.metadata.privateKey}`);
    logger.info(
      `${agentName} inbound topic ID: ${result.metadata.inboundTopicId}`
    );
    logger.info(
      `${agentName} outbound topic ID: ${result.metadata.outboundTopicId}`
    );

    const envVars = {
      [`${envPrefix}_ACCOUNT_ID`]: result.metadata.accountId,
      [`${envPrefix}_PRIVATE_KEY`]: result.metadata.privateKey,
      [`${envPrefix}_INBOUND_TOPIC_ID`]: result.metadata.inboundTopicId,
      [`${envPrefix}_OUTBOUND_TOPIC_ID`]: result.metadata.outboundTopicId,
    };

    await updateEnvFile(ENV_FILE_PATH, envVars);

    const client = new HCS10Client({
      network: 'testnet',
      operatorId: result.metadata.accountId,
      operatorPrivateKey: result.metadata.privateKey,
      guardedRegistryBaseUrl: process.env.REGISTRY_URL,
      prettyPrint: true,
      logLevel: 'debug',
    });

    return {
      accountId: result.metadata.accountId,
      operatorId: `${result.metadata.inboundTopicId}@${result.metadata.accountId}`,
      inboundTopicId: result.metadata.inboundTopicId,
      outboundTopicId: result.metadata.outboundTopicId,
      client,
    };
  } catch (error) {
    console.log('error', error, baseClient);
    logger.error(`Error creating ${agentName} agent:`, error);
    return null;
  }
}

export async function updateEnvFile(
  envFilePath: string,
  variables: Record<string, string>
): Promise<void> {
  let envContent = '';

  if (fs.existsSync(envFilePath)) {
    envContent = fs.readFileSync(envFilePath, 'utf8');
  }

  const envLines = envContent.split('\n');
  const updatedLines = [...envLines];

  for (const [key, value] of Object.entries(variables)) {
    const lineIndex = updatedLines.findIndex((line) =>
      line.startsWith(`${key}=`)
    );

    if (lineIndex !== -1) {
      updatedLines[lineIndex] = `${key}=${value}`;
    } else {
      updatedLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envFilePath, updatedLines.join('\n'));
}
