import { z } from 'zod';
import { BaseHCS10QueryTool } from './base-hcs10-tools';
import { HCS10QueryToolParams } from './hcs10-tool-params';
const RetrieveProfileZodSchema = z.object({
  accountId: z
    .string()
    .describe(
      'The Hedera account ID of the agent whose profile you want to retrieve (e.g., 0.0.12345).'
    ),
  disableCache: z
    .boolean()
    .optional()
    .describe(
      'Optional: Force refresh from the network instead of using cache.'
    ),
});

/**
 * Tool to retrieve detailed profile information for a specific HCS-10 agent
 */
export class RetrieveProfileTool extends BaseHCS10QueryTool<
  typeof RetrieveProfileZodSchema
> {
  name = 'retrieve_profile';
  description =
    'Gets the detailed profile information for a specific HCS-10 agent by their account ID. Returns name, bio, capabilities, topics, and other metadata.';
  specificInputSchema = RetrieveProfileZodSchema;
  constructor(params: HCS10QueryToolParams) {
    super(params);
  }

  protected async executeQuery({
    accountId,
    disableCache,
  }: z.infer<typeof RetrieveProfileZodSchema>): Promise<unknown> {
    const hcs10Builder = this.hcs10Builder;
    const params: { accountId: string; disableCache?: boolean } = {
      accountId,
    };
    if (disableCache !== undefined) {
      params.disableCache = disableCache;
    }
    await hcs10Builder.retrieveProfile(params);

    const result = await hcs10Builder.execute();

    if (result.success && 'rawResult' in result && result.rawResult) {
      const raw = result.rawResult as {
        profileDetails?: string;
        rawProfile?: unknown;
      };
      return {
        success: true,
        data: raw.profileDetails || 'Profile retrieved',
        rawProfile: raw.rawProfile,
      };
    }

    return result;
  }
}