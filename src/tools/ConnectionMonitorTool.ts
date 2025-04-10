import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import {
  IStateManager,
  ActiveConnection,
  AgentProfileInfo,
} from '../state/open-convai-state';
import {
  Logger,
  FeeConfigBuilder,
  HCSMessage,
  FeeConfigBuilderInterface,
} from '@hashgraphonline/standards-sdk';
import { ListConnectionsTool } from './ListConnectionsTool';

export interface FeeDefinition {
  amount: number;
  collectorAccount?: string;
}

export interface TokenFeeDefinition extends FeeDefinition {
  tokenId: string;
}

export interface ConnectionMonitorToolParams extends ToolParams {
  hcsClient: HCS10Client;
  stateManager: IStateManager;
}

/**
 * A tool for monitoring incoming connection requests and accepting them with optional fee settings.
 */
export class ConnectionMonitorTool extends StructuredTool {
  name = 'monitor_connections';
  description =
    'Monitors for incoming connection requests and accepts them with optional fee settings. Use this to watch for connection requests and accept them, optionally setting HBAR or token fees on the connection.';
  schema = z.object({
    acceptAll: z
      .boolean()
      .optional()
      .describe(
        'Whether to automatically accept all incoming connection requests. Default is false.'
      ),
    targetAccountId: z
      .string()
      .optional()
      .describe(
        'If provided, only accept connection requests from this specific account ID.'
      ),
    hbarFees: z
      .array(
        z.object({
          amount: z.number(),
          collectorAccount: z.string().optional(),
        })
      )
      .optional()
      .describe(
        'Array of HBAR fee amounts to charge per message (with optional collector accounts).'
      ),
    tokenFees: z
      .array(
        z.object({
          amount: z.number(),
          tokenId: z.string(),
          collectorAccount: z.string().optional(),
        })
      )
      .optional()
      .describe(
        'Array of token fee amounts and IDs to charge per message (with optional collector accounts).'
      ),
    exemptAccountIds: z
      .array(z.string())
      .optional()
      .describe(
        'Array of account IDs to exempt from ALL fees set in this request.'
      ),
    monitorDurationSeconds: z
      .number()
      .optional()
      .describe(
        'How long to monitor for incoming requests in seconds. Default is 60.'
      ),
    defaultCollectorAccount: z
      .string()
      .optional()
      .describe(
        'Default account to collect fees if not specified at the fee level. Defaults to the agent account.'
      ),
  });

  private hcsClient: HCS10Client;
  private stateManager: IStateManager;
  private logger: Logger;
  private isMonitoring: boolean = false;
  private listConnectionsTool: ListConnectionsTool;
  private static processedRequests = new Set<string>();

  constructor({
    hcsClient,
    stateManager,
    ...rest
  }: ConnectionMonitorToolParams) {
    super(rest);
    this.hcsClient = hcsClient;
    this.stateManager = stateManager;
    this.logger = Logger.getInstance({
      module: 'ConnectionMonitorTool',
      level: 'error',
    });
    this.listConnectionsTool = new ListConnectionsTool({
      stateManager,
      hcsClient,
      ...rest,
    });
  }

  updateClient(newClient: HCS10Client): void {
    this.hcsClient = newClient;
    this.logger.info('Updated HCS10Client instance for ConnectionMonitorTool');
    this.listConnectionsTool = new ListConnectionsTool({
      stateManager: this.stateManager,
      hcsClient: newClient,
    });
  }

  async call(args: z.infer<this['schema']>): Promise<string> {
    return this._call(args);
  }

  protected async _call({
    acceptAll = false,
    targetAccountId,
    hbarFees = [],
    tokenFees = [],
    exemptAccountIds,
    monitorDurationSeconds = 60,
    defaultCollectorAccount,
  }: z.infer<this['schema']>): Promise<string> {
    const currentAgent = this.stateManager.getCurrentAgent();
    if (!currentAgent) {
      return 'Error: Cannot monitor for connections. No agent is currently active. Please register or select an agent first.';
    }

    if (this.isMonitoring) {
      return 'Already monitoring for connection requests. Please wait for the current monitoring session to complete.';
    }

    try {
      this.isMonitoring = true;
      const inboundTopicId = await this.hcsClient.getInboundTopicId();

      if (!inboundTopicId) {
        this.isMonitoring = false;
        return 'Error: Could not find inbound topic ID for the current agent.';
      }

      this.logger.info(
        `Starting to monitor inbound topic ${inboundTopicId} for connection requests...`
      );

      const feeConfig = this.createFeeConfig(
        hbarFees,
        tokenFees,
        exemptAccountIds,
        targetAccountId,
        defaultCollectorAccount
      );

      const endTime = Date.now() + monitorDurationSeconds * 1000;
      const pollIntervalMs = 3000;
      let lastSequenceNumber = 0;
      let connectionRequestsFound = 0;
      let acceptedConnections = 0;
      let skippedRequests = 0;
      const agentId = this.hcsClient.getAccountAndSigner().accountId;
      const requestIdKey = (reqId: number) => `${agentId}:${reqId}`;

      while (Date.now() < endTime) {
        try {
          await this.listConnectionsTool.call({
            includeDetails: false,
            showPending: false,
          });
          const currentConnections = this.stateManager.listConnections();
          const connectedAccountIds = new Set(
            currentConnections
              .filter(
                (conn) => conn.status === 'established' && !conn.isPending
              )
              .map((conn) => conn.targetAccountId)
          );

          const messagesResult = await this.hcsClient.getMessages(
            inboundTopicId
          );
          const newMessages = messagesResult.messages.filter((msg) => {
            if (
              !msg.sequence_number ||
              msg.sequence_number <= lastSequenceNumber
            ) {
              return false;
            }
            lastSequenceNumber = Math.max(
              lastSequenceNumber,
              msg.sequence_number
            );
            return msg.op === 'connection_request';
          });

          for (const request of newMessages) {
            const requestId = request.sequence_number;
            if (!requestId) {
              continue;
            }

            connectionRequestsFound++;

            const reqKey = requestIdKey(requestId);
            if (ConnectionMonitorTool.processedRequests.has(reqKey)) {
              this.logger.info(
                `Request #${requestId} already processed, skipping`
              );
              skippedRequests++;
              continue;
            }

            const requestorAccountId = this.extractAccountId(request);
            if (!requestorAccountId) {
              ConnectionMonitorTool.processedRequests.add(reqKey);
              continue;
            }

            if (targetAccountId && requestorAccountId !== targetAccountId) {
              this.logger.info(
                `Request #${requestId} doesn't match target ${targetAccountId}`
              );
              continue;
            }

            if (connectedAccountIds.has(requestorAccountId)) {
              this.logger.info(
                `Already connected to ${requestorAccountId}, skipping request #${requestId}`
              );
              ConnectionMonitorTool.processedRequests.add(reqKey);
              skippedRequests++;
              continue;
            }

            if (acceptAll) {
              const result = await this.acceptConnectionRequest(
                requestId,
                requestorAccountId,
                feeConfig
              );
              ConnectionMonitorTool.processedRequests.add(reqKey);

              if (result.success) {
                acceptedConnections++;
                this.logger.info(
                  `Successfully accepted connection with ${requestorAccountId}`
                );
              }
            } else {
              this.logger.info(
                `Found request #${requestId} from ${requestorAccountId} (not auto-accepting)`
              );
            }
          }

          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        } catch (error) {
          this.logger.error(`Error polling for messages: ${error}`);
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      }

      this.isMonitoring = false;

      if (connectionRequestsFound === 0) {
        return `No connection requests received during the ${monitorDurationSeconds} second monitoring period.`;
      } else if (acceptAll) {
        return `Monitored for ${monitorDurationSeconds} seconds. Found ${connectionRequestsFound} connection requests, accepted ${acceptedConnections} connections, skipped ${skippedRequests} existing connections${this.formatFeeString(
          hbarFees,
          tokenFees
        )}.`;
      } else {
        return `Monitored for ${monitorDurationSeconds} seconds. Found ${connectionRequestsFound} connection requests. To accept them, call this tool again with acceptAll=true.`;
      }
    } catch (error) {
      this.isMonitoring = false;
      this.logger.error(`Connection monitoring failed: ${error}`);
      return `Error monitoring for connections: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private createFeeConfig(
    hbarFees: FeeDefinition[] = [],
    tokenFees: TokenFeeDefinition[] = [],
    exemptAccountIds?: string[],
    targetAccountId?: string,
    defaultCollectorAccount?: string
  ): FeeConfigBuilderInterface | undefined {
    if (hbarFees.length === 0 && tokenFees.length === 0) {
      return undefined;
    }

    try {
      const agentAccountId = this.hcsClient.getAccountAndSigner().accountId;
      const defaultCollector = defaultCollectorAccount || agentAccountId;

      const builder = new FeeConfigBuilder({
        network: this.hcsClient.getNetwork(),
        logger: this.logger,
        defaultCollectorAccountId: defaultCollector,
      });

      const exemptIds = [...(exemptAccountIds || [])];
      if (targetAccountId && !exemptIds.includes(targetAccountId)) {
        exemptIds.push(targetAccountId);
      }

      for (const hbarFee of hbarFees) {
        if (hbarFee.amount > 0) {
          const collector = hbarFee.collectorAccount || defaultCollector;
          builder.addHbarFee(hbarFee.amount, collector, exemptIds);
          this.logger.info(
            `Added HBAR fee: ${hbarFee.amount} HBAR to be collected by ${collector}`
          );
        }
      }

      for (const tokenFee of tokenFees) {
        if (tokenFee.amount > 0 && tokenFee.tokenId) {
          const collector = tokenFee.collectorAccount || defaultCollector;
          builder.addTokenFee(
            tokenFee.amount,
            tokenFee.tokenId,
            collector,
            undefined,
            exemptIds
          );
          this.logger.info(
            `Added token fee: ${tokenFee.amount} of token ${tokenFee.tokenId} to be collected by ${collector}`
          );
        }
      }

      return builder;
    } catch (error) {
      this.logger.error(`Error creating fee configuration: ${error}`);
      return undefined;
    }
  }

  private extractAccountId(request: HCSMessage): string | undefined {
    if (request.operator_id) {
      return this.hcsClient.standardClient.extractAccountFromOperatorId(
        request.operator_id
      );
    }
    return undefined;
  }

  private async acceptConnectionRequest(
    connectionRequestId: number,
    requestingAccountId: string,
    feeConfig?: FeeConfigBuilderInterface
  ): Promise<{ success: boolean; connectionTopicId?: string; error?: string }> {
    try {
      const inboundTopicId = await this.hcsClient.getInboundTopicId();
      this.logger.info(
        `Accepting connection request #${connectionRequestId} from ${requestingAccountId}`
      );

      const result = await this.hcsClient.handleConnectionRequest(
        inboundTopicId,
        requestingAccountId,
        connectionRequestId,
        feeConfig
      );

      if (!result?.connectionTopicId) {
        return {
          success: false,
          error: 'Connection acceptance returned no connection topic ID',
        };
      }

      const connectionTopicId = result.connectionTopicId;
      this.logger.info(
        `Connection established! Topic ID: ${connectionTopicId}`
      );

      let profileInfo: AgentProfileInfo | undefined;
      try {
        const profile = await this.hcsClient.getAgentProfile(
          requestingAccountId
        );
        if (profile.success && profile.profile) {
          profileInfo = {
            name: profile.profile.display_name || profile.profile.alias,
            bio: profile.profile.bio,
            avatar: profile.profile.profileImage,
            type: profile.profile.type,
          };
        }
      } catch (profileError) {
        this.logger.warn(
          `Could not fetch profile for ${requestingAccountId}: ${profileError}`
        );
      }

      const targetInboundTopicId =
        (await this.hcsClient.getAgentProfile(requestingAccountId))?.topicInfo
          ?.inboundTopic || '';

      const newConnection: ActiveConnection = {
        targetAccountId: requestingAccountId,
        targetAgentName: profileInfo?.name || `Agent ${requestingAccountId}`,
        targetInboundTopicId,
        connectionTopicId,
        profileInfo,
        created: new Date(),
        status: 'established',
      };

      this.stateManager.addActiveConnection(newConnection);

      return {
        success: true,
        connectionTopicId,
      };
    } catch (error) {
      this.logger.error(`Error accepting connection request: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private formatFeeString(
    hbarFees: FeeDefinition[] = [],
    tokenFees: TokenFeeDefinition[] = []
  ): string {
    if (hbarFees.length === 0 && tokenFees.length === 0) {
      return '';
    }

    let feeString = ' with fees: ';

    if (hbarFees.length > 0) {
      const hbarFeeDetails = hbarFees
        .filter((fee) => fee.amount > 0)
        .map((fee) => {
          const collector = fee.collectorAccount
            ? ` to ${fee.collectorAccount}`
            : '';
          return `${fee.amount} HBAR${collector}`;
        })
        .join(', ');

      if (hbarFeeDetails) {
        feeString += hbarFeeDetails;
      }
    }

    if (tokenFees.length > 0) {
      if (hbarFees.length > 0) {
        feeString += ' and ';
      }

      const tokenFeeDetails = tokenFees
        .filter((fee) => fee.amount > 0 && fee.tokenId)
        .map((fee) => {
          const collector = fee.collectorAccount
            ? ` to ${fee.collectorAccount}`
            : '';
          return `${fee.amount} of token ${fee.tokenId}${collector}`;
        })
        .join(', ');

      if (tokenFeeDetails) {
        feeString += tokenFeeDetails;
      }
    }

    return feeString === ' with fees: ' ? '' : feeString;
  }
}
