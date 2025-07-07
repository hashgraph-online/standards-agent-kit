import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import { z } from 'zod';
import { BaseServiceBuilder } from 'hedera-agent-kit';
import { HCS10Builder, RegisterAgentParams } from '../../builders/hcs10/hcs10-builder';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10TransactionToolParams } from './hcs10-tool-params';

const RegisterAgentZodSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .describe('A unique name for the agent (1-50 characters)'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('Optional bio description for the agent (max 500 characters)'),
  alias: z
    .string()
    .optional()
    .describe('Optional custom username/alias for the agent'),
  type: z
    .enum(['autonomous', 'manual'])
    .optional()
    .describe('Agent type (default: autonomous)'),
  model: z
    .string()
    .optional()
    .describe('AI model identifier (default: agent-model-2024)'),
  capabilities: z
    .array(z.nativeEnum(AIAgentCapability))
    .optional()
    .describe('Array of agent capabilities (default: [TEXT_GENERATION])'),
  creator: z.string().optional().describe('Creator attribution for the agent'),
  socials: z
    .record(
      z.enum([
        'twitter',
        'github',
        'discord',
        'telegram',
        'linkedin',
        'youtube',
        'website',
        'x',
      ] as const),
      z.string()
    )
    .optional()
    .describe(
      'Social media links (e.g., {"twitter": "@handle", "discord": "username"})'
    ),
  properties: z
    .record(z.unknown())
    .optional()
    .describe('Custom metadata properties for the agent'),
  profilePicture: z
    .union([
      z.string().describe('URL or local file path to profile picture'),
      z.object({
        url: z.string().optional(),
        path: z.string().optional(),
        filename: z.string().optional(),
      }),
    ])
    .optional()
    .describe(
      'Optional profile picture as URL, file path, or object with url/path/filename'
    ),
  existingProfilePictureTopicId: z
    .string()
    .optional()
    .describe(
      'Topic ID of an existing profile picture to reuse (e.g., 0.0.12345)'
    ),
  initialBalance: z
    .number()
    .positive()
    .optional()
    .describe(
      'Optional initial HBAR balance for the new agent account (will create new account if provided)'
    ),
  userAccountId: z
    .string()
    .optional()
    .describe(
      'Optional account ID (e.g., 0.0.12345) to use as the agent account instead of creating a new one'
    ),
  hbarFee: z
    .number()
    .positive()
    .optional()
    .describe(
      'Optional HBAR fee amount to charge per message on the inbound topic'
    ),
  tokenFees: z
    .array(
      z.object({
        amount: z.number().positive(),
        tokenId: z.string(),
      })
    )
    .optional()
    .describe('Optional token fees to charge per message'),
  exemptAccountIds: z
    .array(z.string())
    .optional()
    .describe('Optional account IDs to exempt from fees'),
  setAsCurrent: z
    .boolean()
    .optional()
    .describe('Whether to set as current agent (default: true)'),
  persistence: z
    .object({
      prefix: z.string().optional(),
    })
    .optional()
    .describe('Optional persistence configuration'),
});

export class RegisterAgentTool extends BaseHCS10TransactionTool<
  typeof RegisterAgentZodSchema
> {
  name = 'register_agent';
  description =
    'Creates and registers the AI agent on the Hedera network. Returns JSON string with agent details (accountId, privateKey, topics) on success. Note: This tool requires multiple transactions and cannot be used in returnBytes mode.';
  specificInputSchema = RegisterAgentZodSchema;

  constructor(params: HCS10TransactionToolParams) {
    super(params);
    this.neverScheduleThisTool = true;
    this.requiresMultipleTransactions = true;
  }

  protected async callBuilderMethod(
    builder: BaseServiceBuilder,
    specificArgs: z.infer<typeof RegisterAgentZodSchema>
  ): Promise<void> {
    const hcs10Builder = builder as HCS10Builder;

    const params: RegisterAgentParams = {
      name: specificArgs.name,
    };

    if (specificArgs.description !== undefined) {
      params.bio = specificArgs.description;
    }
    if (specificArgs.alias !== undefined) {
      params.alias = specificArgs.alias;
    }
    if (specificArgs.type !== undefined) {
      params.type = specificArgs.type;
    }
    if (specificArgs.model !== undefined) {
      params.model = specificArgs.model;
    }
    if (specificArgs.capabilities !== undefined) {
      params.capabilities = specificArgs.capabilities;
    }
    if (specificArgs.creator !== undefined) {
      params.creator = specificArgs.creator;
    }
    if (specificArgs.socials !== undefined) {
      params.socials = specificArgs.socials;
    }
    if (specificArgs.properties !== undefined) {
      params.properties = specificArgs.properties;
    }
    if (specificArgs.profilePicture !== undefined) {
      if (typeof specificArgs.profilePicture === 'string') {
        params.profilePicture = specificArgs.profilePicture;
      } else {
        const profilePicObj: {
          url?: string;
          path?: string;
          filename?: string;
        } = {};
        if (specificArgs.profilePicture.url !== undefined) {
          profilePicObj.url = specificArgs.profilePicture.url;
        }
        if (specificArgs.profilePicture.path !== undefined) {
          profilePicObj.path = specificArgs.profilePicture.path;
        }
        if (specificArgs.profilePicture.filename !== undefined) {
          profilePicObj.filename = specificArgs.profilePicture.filename;
        }
        params.profilePicture = profilePicObj;
      }
    }
    if (specificArgs.existingProfilePictureTopicId !== undefined) {
      params.existingProfilePictureTopicId =
        specificArgs.existingProfilePictureTopicId;
    }
    if (specificArgs.userAccountId !== undefined) {
      params.userAccountId = specificArgs.userAccountId;
    }
    if (specificArgs.hbarFee !== undefined) {
      params.hbarFee = specificArgs.hbarFee;
    }
    if (specificArgs.tokenFees !== undefined) {
      params.tokenFees = specificArgs.tokenFees;
    }
    if (specificArgs.exemptAccountIds !== undefined) {
      params.exemptAccountIds = specificArgs.exemptAccountIds;
    }
    if (specificArgs.initialBalance !== undefined) {
      params.initialBalance = specificArgs.initialBalance;
    }

    await hcs10Builder.registerAgent(params);
  }
}