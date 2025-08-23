import { z } from 'zod';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { BaseServiceBuilder } from 'hedera-agent-kit';
import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'SendMessageToConnectionTool' });

const SendMessageToConnectionZodSchema = z.object({
  targetIdentifier: z
    .string()
    .optional()
    .describe(
      "The request key (e.g., 'req-1:0.0.6155171@0.0.6154875'), account ID (e.g., 0.0.12345) of the target agent, OR the connection number (e.g., '1', '2') from the 'list_connections' tool. Request key is most deterministic."
    ),
  connectionId: z
    .string()
    .optional()
    .describe(
      "The connection number (e.g., '1', '2') from the 'list_connections' tool."
    ),
  agentId: z
    .string()
    .optional()
    .describe('The account ID (e.g., 0.0.12345) of the target agent.'),
  message: z.string().describe('The text message content to send.'),
  disableMonitoring: z.boolean().optional().default(false),
});

/**
 * A tool to send a message to an agent over an established HCS-10 connection.
 */
export class SendMessageToConnectionTool extends BaseHCS10TransactionTool<
  typeof SendMessageToConnectionZodSchema
> {
  name = 'send_message_to_connection';
  description =
    "Use this to send a message to an agent you already have an active connection with. Provide the target agent's account ID (e.g., 0.0.12345) and your message. If no active connection exists, this will fail - use initiate_connection instead to create a new connection first.";
  specificInputSchema = SendMessageToConnectionZodSchema;
  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.requiresMultipleTransactions = true;
    this.neverScheduleThisTool = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof SendMessageToConnectionZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;

    const targetIdentifier =
      specificArgs.targetIdentifier ||
      specificArgs.agentId ||
      specificArgs.connectionId;

    if (!targetIdentifier) {
      throw new Error(
        'Either targetIdentifier, connectionId, or agentId must be provided'
      );
    }

    const stateManager = hcs10Builder.getStateManager();
    if (stateManager) {
      const connectionsManager = stateManager.getConnectionsManager();
      if (connectionsManager) {
        try {
          const currentAgent = stateManager.getCurrentAgent();
          if (currentAgent && currentAgent.accountId) {
            await connectionsManager.fetchConnectionData(
              currentAgent.accountId
            );
          }
        } catch (error) {
          logger.debug('Could not refresh connections:', error);
        }
      }

      if (targetIdentifier.match(/^\d+$/)) {
        const connections = stateManager.listConnections();
        const connectionIndex = parseInt(targetIdentifier) - 1; // Connection numbers are 1-based

        const establishedConnections = connections.filter(
          (conn) =>
            conn.status === 'established' &&
            !conn.isPending &&
            !conn.needsConfirmation
        );

        if (
          connectionIndex >= 0 &&
          connectionIndex < establishedConnections.length
        ) {
          const selectedConnection = establishedConnections[connectionIndex];
          if (selectedConnection && selectedConnection.connectionTopicId) {
            await hcs10Builder.sendMessageToConnection({
              targetIdentifier: selectedConnection.connectionTopicId,
              message: specificArgs.message,
              disableMonitoring: specificArgs.disableMonitoring,
            });
            return;
          }
        }
      }

      if (targetIdentifier.match(/^\d+\.\d+\.\d+$/)) {
        const connections = stateManager.listConnections();
        const establishedConnection = connections.find(
          (conn) =>
            (conn.targetAccountId === targetIdentifier ||
              conn.targetAccountId === `0.0.${targetIdentifier}`) &&
            conn.status === 'established' &&
            !conn.isPending &&
            !conn.needsConfirmation
        );

        if (establishedConnection && establishedConnection.connectionTopicId) {
          await hcs10Builder.sendMessageToConnection({
            targetIdentifier: establishedConnection.connectionTopicId,
            message: specificArgs.message,
            disableMonitoring: specificArgs.disableMonitoring,
          });
          return;
        }
      }
    }

    await hcs10Builder.sendMessageToConnection({
      targetIdentifier: targetIdentifier,
      message: specificArgs.message,
      disableMonitoring: specificArgs.disableMonitoring,
    });
  }
}
