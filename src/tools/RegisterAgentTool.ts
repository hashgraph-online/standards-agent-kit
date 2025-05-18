import {
  AIAgentCapability,
  Logger,
  FeeConfigBuilder,
} from '@hashgraphonline/standards-sdk';
import { ensureAgentHasEnoughHbar } from '../utils/ensure-agent-has-hbar';
import { HCS10Client, ExtendedAgentMetadata } from '../hcs10/HCS10Client';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { IStateManager } from '../state/state-types';
import { AgentPersistenceOptions } from '../state/state-types';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Interface for HCS10 registration result
 */
interface HCS10RegistrationResult {
  metadata?: {
    accountId?: string;
    inboundTopicId?: string;
    outboundTopicId?: string;
    profileTopicId?: string;
    privateKey?: string;
    capabilities?: number[];
    [key: string]: string | number | boolean | number[] | object | undefined;
  };
}

/**
 * Agent registration details returned when successful
 */
interface AgentRegistrationDetails {
  success: boolean;
  message: string;
  name: string;
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId: string;
  capabilities: number[];
  hasFees: boolean;
  hbarFee: number;
  tokenFee: { amount: number; tokenId: string } | null;
  profilePicture?: {
    source: string;
    topicId?: string;
  };
}

/**
 * Profile picture input types supported by the tool
 */
type ProfilePictureInput =
  | string
  | {
      url: string;
      filename: string;
    }
  | {
      path: string;
      filename?: string;
    };

/**
 * RegisterAgentTool wraps the createAndRegisterAgent() function of HCS10Client.
 * It creates and registers an agent on Hedera using the HCS-10 standard SDK flow.
 * On success, returns a JSON string containing the new agent's details (including private key).
 */
export class RegisterAgentTool extends StructuredTool {
  name = 'register_agent';
  description =
    "Creates and registers the AI agent on the Hedera network. Returns JSON string with agent details (accountId, privateKey, topics) on success. Optionally supports fee configuration for the agent's inbound topic using HBAR or specific tokens.";
  private client: HCS10Client;
  private stateManager?: IStateManager;

  schema = z.object({
    name: z.string().describe('The name of the agent to register'),
    description: z
      .string()
      .optional()
      .describe('Optional description of the agent'),
    type: z
      .enum(['autonomous', 'manual'])
      .optional()
      .describe('Optional agent type (default: autonomous)'),
    model: z
      .string()
      .optional()
      .describe('Optional model identifier for the agent'),
    capabilities: z
      .array(z.number())
      .optional()
      .describe(
        'Optional array of AIAgentCapability enum values (0-18). If not provided, defaults to just TEXT_GENERATION (0)'
      ),
    profilePicture: z
      .union([
        z.string().describe('Path to a local image file or URL to an image'),
        z.object({
          url: z.string().describe('URL to an image file'),
          filename: z.string().describe('Filename to use for the image'),
        }),
        z.object({
          path: z.string().describe('Path to a local image file'),
          filename: z.string().optional().describe('Optional custom filename'),
        }),
      ])
      .optional()
      .describe(
        'Optional profile picture for the agent (local file path or URL)'
      ),
    feeCollectorAccountId: z
      .string()
      .optional()
      .describe(
        "The account ID to collect fees. If not specified, the new agent's account ID will be used. Required if any fee is specified."
      ),
    hbarFee: z
      .number()
      .optional()
      .describe(
        'Optional: The fee amount in HBAR to charge per message on the inbound topic (e.g., 0.5). If specified, inboundTopicType will be set to FEE_BASED.'
      ),
    tokenFee: z
      .object({
        amount: z.number(),
        tokenId: z.string(),
      })
      .optional()
      .describe(
        'Optional: The fee amount and token ID to charge per message on the inbound topic (e.g., { amount: 10, tokenId: "0.0.12345" }). If specified, inboundTopicType will be set to FEE_BASED.'
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
        'Optional: Array of HBAR fees with different collectors. If specified, inboundTopicType will be set to FEE_BASED.'
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
        'Optional: Array of token fees with different collectors. If specified, inboundTopicType will be set to FEE_BASED.'
      ),
    exemptAccountIds: z
      .array(z.string())
      .optional()
      .describe(
        'Optional: Array of account IDs to exempt from ALL fees set for this agent.'
      ),
    setAsCurrent: z
      .boolean()
      .optional()
      .describe(
        'Optional: Whether to set the newly registered agent as the current active agent in the state manager. Default: true'
      ),
    persistence: z
      .object({
        prefix: z.string().optional(),
      })
      .optional()
      .describe(
        'Optional: Configuration for persisting agent data to environment variables. The prefix will determine the environment variable names (e.g., PREFIX_ACCOUNT_ID). Defaults to TODD if not specified.'
      ),
  });

  /**
   * Creates a new RegisterAgentTool instance
   * @param client - Instance of HCS10Client (already configured with operator/network)
   * @param stateManager - Optional state manager to store agent details
   */
  constructor(client: HCS10Client, stateManager?: IStateManager) {
    super();
    this.client = client;
    this.stateManager = stateManager;
  }

  /**
   * Loads a profile picture from a local file or URL and returns a buffer
   * @param profilePicture - Local file path or URL
   * @returns Object containing buffer and filename
   */
  private async loadProfilePicture(
    profilePicture: ProfilePictureInput
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const logger = Logger.getInstance({
      level: 'debug',
    });

    try {
      if (!profilePicture) {
        return null;
      }

      if (typeof profilePicture === 'string') {
        const isUrl =
          profilePicture.startsWith('http://') ||
          profilePicture.startsWith('https://');

        if (isUrl) {
          logger.info(`Loading profile picture from URL: ${profilePicture}`);
          const response = await axios.get(profilePicture, {
            responseType: 'arraybuffer',
          });
          const buffer = Buffer.from(response.data);

          const urlPathname = new URL(profilePicture).pathname;
          const filename = path.basename(urlPathname) || 'profile.png';

          return { buffer, filename };
        } else {
          if (!fs.existsSync(profilePicture)) {
            logger.warn(`Profile picture file not found: ${profilePicture}`);
            return null;
          }

          logger.info(`Loading profile picture from file: ${profilePicture}`);
          const buffer = fs.readFileSync(profilePicture);
          const filename = path.basename(profilePicture);

          return { buffer, filename };
        }
      }

      if ('url' in profilePicture) {
        logger.info(`Loading profile picture from URL: ${profilePicture.url}`);
        const response = await axios.get(profilePicture.url, {
          responseType: 'arraybuffer',
        });
        const buffer = Buffer.from(response.data);
        const filename = profilePicture.filename || 'profile.png';

        return { buffer, filename };
      }

      if ('path' in profilePicture) {
        if (!fs.existsSync(profilePicture.path)) {
          logger.warn(`Profile picture file not found: ${profilePicture.path}`);
          return null;
        }

        logger.info(
          `Loading profile picture from file: ${profilePicture.path}`
        );
        const buffer = fs.readFileSync(profilePicture.path);
        const filename =
          profilePicture.filename || path.basename(profilePicture.path);

        return { buffer, filename };
      }

      return null;
    } catch (error) {
      logger.error('Failed to load profile picture:', error);
      return null;
    }
  }

  /**
   * Calls createAndRegisterAgent() with the provided metadata.
   * Returns a JSON string with agent details on success, or an error string.
   */
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const logger = Logger.getInstance({
      level: 'debug',
    });

    const metadata: ExtendedAgentMetadata = {
      name: input.name,
      description: input.description,
      type: input.type,
      model: input.model,
      capabilities: input.capabilities || [AIAgentCapability.TEXT_GENERATION],
      properties: {},
    };

    let profilePictureSource = '';
    if (input.profilePicture) {
      const profilePictureData = await this.loadProfilePicture(
        input.profilePicture
      );
      if (profilePictureData) {
        const { buffer, filename } = profilePictureData;
        metadata.pfpBuffer = buffer;
        metadata.pfpFileName = filename;

        if (typeof input.profilePicture === 'string') {
          profilePictureSource = input.profilePicture;
        } else if ('url' in input.profilePicture) {
          profilePictureSource = input.profilePicture.url;
        } else if ('path' in input.profilePicture) {
          profilePictureSource = input.profilePicture.path;
        }
      }
    }

    const hasHbarFee = input.hbarFee !== undefined && input.hbarFee > 0;
    const hasTokenFee = this.hasValidTokenFee(input.tokenFee);
    const hasHbarFees = input.hbarFees && input.hbarFees.length > 0;
    const hasTokenFees = input.tokenFees && input.tokenFees.length > 0;

    if (hasHbarFee || hasTokenFee || hasHbarFees || hasTokenFees) {
      const { accountId: operatorAccountId } =
        this.client.getAccountAndSigner();
      const collectorId = input.feeCollectorAccountId || operatorAccountId;

      if (!collectorId) {
        return 'Error: Fee collector account ID is required when specifying fees and could not be determined.';
      }

      const feeConfigBuilder = new FeeConfigBuilder({
        network: this.client.getNetwork(),
        logger,
      });

      try {
        const exemptAccountIds =
          input.exemptAccountIds?.filter(
            (id) => id !== collectorId && id.startsWith('0.0')
          ) || [];

        let updatedFeeConfig = feeConfigBuilder;

        if (hasHbarFee) {
          logger.info(
            `Adding HBAR fee: ${input.hbarFee} HBAR to be collected by ${collectorId}`
          );
          updatedFeeConfig = updatedFeeConfig.addHbarFee(
            input.hbarFee!,
            collectorId,
            exemptAccountIds
          );
        }

        if (hasHbarFees) {
          for (const fee of input.hbarFees!) {
            const feeCollector = fee.collectorAccount || collectorId;
            logger.info(
              `Adding HBAR fee: ${fee.amount} HBAR to be collected by ${feeCollector}`
            );
            updatedFeeConfig = updatedFeeConfig.addHbarFee(
              fee.amount,
              feeCollector,
              exemptAccountIds
            );
          }
        }

        if (hasTokenFee) {
          logger.info(
            `Adding token fee: ${input.tokenFee!.amount} of token ${
              input.tokenFee!.tokenId
            } to be collected by ${collectorId}`
          );
          updatedFeeConfig = await updatedFeeConfig.addTokenFee(
            input.tokenFee!.amount,
            input.tokenFee!.tokenId,
            collectorId,
            undefined,
            exemptAccountIds
          );
        }

        if (hasTokenFees) {
          for (const fee of input.tokenFees!) {
            const feeCollector = fee.collectorAccount || collectorId;
            logger.info(
              `Adding token fee: ${fee.amount} of token ${fee.tokenId} to be collected by ${feeCollector}`
            );
            updatedFeeConfig = await updatedFeeConfig.addTokenFee(
              fee.amount,
              fee.tokenId,
              feeCollector,
              undefined,
              exemptAccountIds
            );
          }
        }

        metadata.feeConfig = updatedFeeConfig;
        logger.info('FeeConfigBuilder created successfully');
      } catch (error) {
        return `Error: Failed to configure fees. Reason: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }

    try {
      logger.info('Registering agent with metadata');

      const result = (await this.client.createAndRegisterAgent(
        metadata
      )) as unknown as HCS10RegistrationResult;

      return this.processRegistrationResult(
        result,
        input,
        profilePictureSource
      );
    } catch (error) {
      return `Error: Failed to create/register agent "${input.name}". Reason: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Checks if the token fee configuration is valid
   */
  private hasValidTokenFee(tokenFee?: {
    amount: number;
    tokenId: string;
  }): boolean {
    return !!(
      tokenFee &&
      tokenFee.amount > 0 &&
      tokenFee.tokenId &&
      tokenFee.tokenId.trim() !== ''
    );
  }

  /**
   * Processes the registration result and returns formatted output
   */
  private async processRegistrationResult(
    result: HCS10RegistrationResult,
    input: z.infer<typeof this.schema>,
    profilePictureSource: string = ''
  ): Promise<string> {
    const newAgentAccountId = result?.metadata?.accountId || '';
    const inboundTopicId = result?.metadata?.inboundTopicId || '';
    const outboundTopicId = result?.metadata?.outboundTopicId || '';
    const profileTopicId = result?.metadata?.profileTopicId || '';
    const privateKey = result?.metadata?.privateKey || '';
    const pfpTopicId = result?.metadata?.pfpTopicId;

    this.validateRegistrationResult(
      newAgentAccountId,
      inboundTopicId,
      outboundTopicId,
      privateKey
    );

    if (
      this.stateManager &&
      privateKey &&
      newAgentAccountId &&
      inboundTopicId &&
      outboundTopicId &&
      (input.setAsCurrent === undefined || input.setAsCurrent)
    ) {
      const agent = {
        name: input.name,
        accountId: newAgentAccountId,
        inboundTopicId,
        outboundTopicId,
        profileTopicId,
        privateKey,
        pfpTopicId: pfpTopicId as string,
      };

      this.stateManager.setCurrentAgent(agent);

      if (this.stateManager.persistAgentData && input.persistence) {
        try {
          const persistenceOptions: AgentPersistenceOptions = {
            type: 'env-file',
            prefix: input.persistence.prefix,
          };

          await this.stateManager.persistAgentData(agent, persistenceOptions);
        } catch (error) {
          Logger.getInstance().warn('Failed to persist agent data', error);
        }
      }
    }

    await this.ensureAgentHasFunds(newAgentAccountId, input.name);

    const feeDescription = this.createFeeDescription(input);
    const feeMessage = feeDescription
      ? ` with ${feeDescription} fee on inbound topic`
      : '';

    const registrationDetails: AgentRegistrationDetails = {
      success: true,
      message: `Successfully registered agent '${input.name}'${feeMessage}.`,
      name: input.name,
      accountId: newAgentAccountId,
      privateKey: privateKey,
      inboundTopicId: inboundTopicId,
      outboundTopicId: outboundTopicId,
      profileTopicId: profileTopicId || 'N/A',
      capabilities: input.capabilities || [AIAgentCapability.TEXT_GENERATION],
      hasFees: !!(input.hbarFee || this.hasValidTokenFee(input.tokenFee)),
      hbarFee: input.hbarFee || 0,
      tokenFee: input.tokenFee || null,
    };

    if (pfpTopicId || profilePictureSource) {
      registrationDetails.profilePicture = {
        source: profilePictureSource,
        topicId: pfpTopicId as string,
      };
    }

    return JSON.stringify(registrationDetails);
  }

  /**
   * Ensures the agent has enough HBAR for operations
   */
  private async ensureAgentHasFunds(
    accountId: string,
    agentName: string
  ): Promise<void> {
    try {
      await ensureAgentHasEnoughHbar(
        Logger.getInstance({
          module: 'RegisterAgentTool',
        }),
        this.client.standardClient,
        accountId,
        agentName
      );
    } catch (error) {
      Logger.getInstance().error('Failed to auto fund agent', error);
    }
  }

  /**
   * Validates that all required fields are present in the registration result
   */
  private validateRegistrationResult(
    accountId?: string,
    inboundTopicId?: string,
    outboundTopicId?: string,
    privateKey?: string
  ): void {
    if (!accountId || !inboundTopicId || !outboundTopicId || !privateKey) {
      const missingFields = [
        !accountId && 'accountId',
        !inboundTopicId && 'inboundTopicId',
        !outboundTopicId && 'outboundTopicId',
        !privateKey && 'privateKey',
      ]
        .filter(Boolean)
        .join(', ');
      throw new Error(
        `Registration failed. The HCS client returned incomplete details (Missing: ${missingFields}).`
      );
    }
  }

  /**
   * Creates a description of the fees configured for the agent
   */
  private createFeeDescription(input: z.infer<typeof this.schema>): string {
    const hasHbarFee = input.hbarFee && input.hbarFee > 0;
    const hasTokenFee = this.hasValidTokenFee(input.tokenFee);
    if (!hasHbarFee && !hasTokenFee) {
      return '';
    }

    let description = '';
    if (hasHbarFee) {
      description += `${input.hbarFee} HBAR`;
    }
    if (hasTokenFee && input.tokenFee) {
      const tokenFeeText = `${input.tokenFee.amount} of token ${input.tokenFee.tokenId}`;
      description += description ? ` and ${tokenFeeText}` : tokenFeeText;
    }
    return description;
  }
}
