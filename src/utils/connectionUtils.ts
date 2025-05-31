import { HCS10Client } from '../hcs10/HCS10Client';
import {
  HCSMessage,
  Logger,
  HCS11Profile,
} from '@hashgraphonline/standards-sdk';

export interface ConnectionMap {
  inboundRequests: Map<number, HCSMessage>;
  outboundConfirmations: Map<number, HCSMessage>;
  outboundRequests: Map<number, HCSMessage>;
  inboundConfirmations: Map<number, HCSMessage>;
  profileMap: Map<string, HCS11Profile>;
  confirmedRequestIds: Set<number>;
}

const shouldSilence = process.env.DISABLE_LOGGING === 'true';
const logger = Logger.getInstance({
  module: 'connectionUtils',
  silent: shouldSilence,
});

/**
 * Fetches and processes inbound/outbound messages and profiles
 * to provide a map of connection states.
 */
export async function fetchConnectionMap(
  hcsClient: HCS10Client
): Promise<ConnectionMap> {
  let inboundTopicId: string | undefined;
  let outboundTopicId: string | undefined;
  const profileMap = new Map<string, HCS11Profile>();
  const targetAccountIds = new Set<string>();

  try {
    inboundTopicId = await hcsClient.getInboundTopicId();
    outboundTopicId = await hcsClient.getOutboundTopicId();
  } catch (error) {
    logger.error(`Failed to get topic IDs: ${error}`);
    throw new Error(
      `Could not determine inbound/outbound topic IDs for the current agent. Ensure the agent is registered and client is configured correctly. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!inboundTopicId || !outboundTopicId) {
    throw new Error(
      'Could not find inbound or outbound topic ID for the current agent'
    );
  }

  let outboundMessages: HCSMessage[] = [];
  let inboundMessagesResult: { messages: HCSMessage[] } = { messages: [] };

  try {
    [outboundMessages, inboundMessagesResult] = await Promise.all([
      hcsClient.getMessages(outboundTopicId).then((res) => res.messages || []),
      hcsClient.getMessages(inboundTopicId).catch((err) => {
        logger.warn(
          `Failed to fetch inbound messages from ${inboundTopicId}: ${err}`
        );
        return { messages: [] };
      }),
    ]);
  } catch (e) {
    logger.error(`Error fetching messages: ${e}`);
  }

  const inboundMessages = inboundMessagesResult.messages;

  const outboundRequestMap = new Map<number, HCSMessage>();
  const outboundConfirmationMap = new Map<number, HCSMessage>();
  const inboundRequestMap = new Map<number, HCSMessage>();
  const inboundConfirmationMap = new Map<number, HCSMessage>();
  const confirmedRequestIds = new Set<number>();

  for (const msg of outboundMessages) {
    const operatorAcc = hcsClient.standardClient.extractAccountFromOperatorId(
      msg.operator_id || ''
    );
    if (operatorAcc) {
      targetAccountIds.add(operatorAcc);
    }

    if (msg.op === 'connection_request' && msg.sequence_number) {
      outboundRequestMap.set(msg.sequence_number, msg);
    }
    if (msg.op === 'connection_created' && msg.connection_request_id) {
      outboundConfirmationMap.set(msg.connection_request_id, msg);
      confirmedRequestIds.add(msg.connection_request_id);
    }
  }

  for (const msg of inboundMessages) {
    const operatorAcc = hcsClient.standardClient.extractAccountFromOperatorId(
      msg.operator_id || ''
    );
    if (operatorAcc) {
      targetAccountIds.add(operatorAcc);
    }
    if (msg.connected_account_id) {
      targetAccountIds.add(msg.connected_account_id);
    }

    if (msg.op === 'connection_request' && msg.sequence_number) {
      inboundRequestMap.set(msg.sequence_number, msg);
    }
    if (msg.op === 'connection_created' && msg.connection_id) {
      inboundConfirmationMap.set(msg.connection_id, msg);
    }
  }

  const profileFetchPromises = Array.from(targetAccountIds).map(
    async (accountId) => {
      if (!profileMap.has(accountId)) {
        try {
          const profileResult = await hcsClient.getAgentProfile(accountId);
          if (profileResult.success && profileResult.profile) {
            profileMap.set(accountId, profileResult.profile as HCS11Profile);
          }
        } catch (e) {
          logger.warn(`Could not fetch profile for ${accountId}: ${e}`);
        }
      }
    }
  );
  await Promise.allSettled(profileFetchPromises);

  return {
    inboundRequests: inboundRequestMap,
    outboundConfirmations: outboundConfirmationMap,
    outboundRequests: outboundRequestMap,
    inboundConfirmations: inboundConfirmationMap,
    profileMap,
    confirmedRequestIds,
  };
}
