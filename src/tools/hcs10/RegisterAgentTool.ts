import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import { z } from 'zod';
import { BaseServiceBuilder } from 'hedera-agent-kit';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import {
  HCS10Builder,
  RegisterAgentParams,
} from '../../builders/hcs10/hcs10-builder';
import { BaseHCS10TransactionTool } from './base-hcs10-tools';
import { HCS10TransactionToolParams } from './hcs10-tool-params';
import { RegisteredAgent } from '../../state/state-types';
import { NaturalLanguageMapper } from './natural-language-mapper';

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
    .transform((val) => {
      if (!val || val.toLowerCase().includes('random')) {
        const timestamp = Date.now().toString(36);
        const randomChars = Math.random().toString(36);
        return `bot${timestamp}${randomChars}`;
      }
      return val;
    })
    .describe(
      'Optional custom username/alias for the agent. Use "random" to generate a unique alias'
    ),
  type: z
    .enum(['autonomous', 'manual'])
    .optional()
    .describe('Agent type (default: autonomous)'),
  model: z
    .string()
    .optional()
    .describe('AI model identifier (default: agent-model-2024)'),
  capabilities: z
    .union([
      z.array(z.nativeEnum(AIAgentCapability)),
      z.array(z.string()),
      z.string(),
    ])
    .optional()
    .transform((val) => {
      if (!val) {return undefined;}
      if (typeof val === 'string') {
        return NaturalLanguageMapper.parseCapabilities(val);
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        return NaturalLanguageMapper.parseTagsOrCapabilities(val);
      }
      return val as AIAgentCapability[];
    })
    .describe('Agent capabilities - can be capability names (e.g. "ai", "data processing"), capability enum values, or array of either. Common values: "ai"/"text" (TEXT_GENERATION), "data" (DATA_INTEGRATION), "analytics" (TRANSACTION_ANALYTICS)'),
  tags: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .optional()
    .transform((val) => {
      if (!val) {return undefined;}
      if (typeof val === 'string') {
        return NaturalLanguageMapper.parseCapabilities(val);
      }
      return NaturalLanguageMapper.parseTagsOrCapabilities(val);
    })
    .describe('Tags for the agent (alternative to capabilities) - e.g. "ai", "data", "analytics". Will be converted to appropriate capabilities.'),
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
    'Creates and registers the AI agent on the Hedera network. Returns JSON string with agent details (accountId, privateKey, topics) on success. Supports natural language for capabilities/tags like "ai", "data processing", "analytics". Note: This tool requires multiple transactions and cannot be used in returnBytes mode. If alias is set to "random" or contains "random", a unique alias will be generated.';
  specificInputSchema = RegisterAgentZodSchema;
  private specificArgs: z.infer<typeof RegisterAgentZodSchema> | undefined;

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
    this.specificArgs = specificArgs;
    const params: RegisterAgentParams = {
      name: specificArgs.name,
    };

    if (specificArgs.description !== undefined) {
      params.bio = specificArgs.description;
    }
    if (specificArgs.alias !== undefined) {
      params.alias = specificArgs.alias;
    } else {
      const randomSuffix = Date.now().toString(36);
      params.alias = `${specificArgs.name}${randomSuffix}`;
    }
    if (specificArgs.type !== undefined) {
      params.type = specificArgs.type;
    }
    if (specificArgs.model !== undefined) {
      params.model = specificArgs.model;
    }

    if (specificArgs.tags !== undefined) {
      params.capabilities = specificArgs.tags as AIAgentCapability[];
    } else if (specificArgs.capabilities !== undefined) {
      params.capabilities = specificArgs.capabilities as AIAgentCapability[];
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

  /**
   * Override _call to intercept the result and save agent to state if needed
   */
  protected override async _call(
    args: z.infer<ReturnType<this['schema']>>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const result = await super._call(args, runManager);

    const shouldSetAsCurrent = this.specificArgs?.setAsCurrent !== false;

    if (this.specificArgs && shouldSetAsCurrent) {
      try {
        const parsed = JSON.parse(result);
        if (parsed.rawResult) {
          this._handleRegistrationResult(parsed.rawResult);
        } else if (parsed.state || parsed.accountId || parsed.metadata) {
          this._handleRegistrationResult(parsed);
        }
      } catch (e) {}
    }

    return result;
  }

  /**
   * Extract agent data from registration result and save to state
   */
  private _handleRegistrationResult(rawResult: any): void {
    let accountId = rawResult.accountId || rawResult.metadata?.accountId;

    if (!accountId && rawResult.state?.createdResources) {
      const accountResource = rawResult.state.createdResources.find(
        (r: string) => r.startsWith('account:')
      );
      if (accountResource) {
        accountId = accountResource.split(':')[1];
      }
    }

    const inboundTopicId =
      rawResult.inboundTopicId ||
      rawResult.metadata?.inboundTopicId ||
      rawResult.state?.inboundTopicId;

    const outboundTopicId =
      rawResult.outboundTopicId ||
      rawResult.metadata?.outboundTopicId ||
      rawResult.state?.outboundTopicId;

    const profileTopicId =
      rawResult.profileTopicId ||
      rawResult.metadata?.profileTopicId ||
      rawResult.state?.profileTopicId;

    const privateKey = rawResult.privateKey || rawResult.metadata?.privateKey;

    if (accountId && inboundTopicId && outboundTopicId && this.specificArgs) {
      const registeredAgent: RegisteredAgent = {
        name: this.specificArgs.name,
        accountId,
        inboundTopicId,
        outboundTopicId,
        profileTopicId,
        privateKey,
      };

      const hcs10Builder = this.getServiceBuilder() as HCS10Builder;
      const stateManager = hcs10Builder.getStateManager();
      if (stateManager) {
        stateManager.setCurrentAgent(registeredAgent);

        if (stateManager.persistAgentData) {
          const prefix =
            this.specificArgs.persistence?.prefix ||
            this.specificArgs.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
          stateManager
            .persistAgentData(registeredAgent, {
              type: 'env-file',
              prefix: prefix,
            })
            .catch(() => {});
        }
      }
    }
  }
}
