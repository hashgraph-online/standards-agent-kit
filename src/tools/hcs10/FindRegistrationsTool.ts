import { z } from 'zod';
import { AIAgentCapability } from '@hashgraphonline/standards-sdk';
import { BaseHCS10QueryTool } from './base-hcs10-tools';
import { HCS10QueryToolParams } from './hcs10-tool-params';

/**
 * A tool to search for registered HCS-10 agents using the configured registry.
 */
const FindRegistrationsZodSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe(
      'Optional: Filter registrations by a specific Hedera account ID (e.g., 0.0.12345).'
    ),
  tags: z
    .array(z.nativeEnum(AIAgentCapability))
    .optional()
    .describe(
      'Optional: Filter registrations by a list of tags (API filter only).'
    ),
});

export class FindRegistrationsTool extends BaseHCS10QueryTool<
  typeof FindRegistrationsZodSchema
> {
  name = 'find_registrations';
  description =
    'Searches the configured agent registry for HCS-10 agents. You can filter by account ID or tags. Returns basic registration info.';
  specificInputSchema = FindRegistrationsZodSchema;
  constructor(params: HCS10QueryToolParams) {
    super(params);
  }

  protected async executeQuery({
    accountId,
    tags,
  }: z.infer<typeof FindRegistrationsZodSchema>): Promise<unknown> {
    const hcs10Builder = this.hcs10Builder;
    const params: { accountId?: string; tags?: number[] } = {};
    if (accountId) {
      params.accountId = accountId;
    }
    if (tags) {
      params.tags = tags;
    }
    await hcs10Builder.findRegistrations(params);

    const result = await hcs10Builder.execute();

    if (result.success && 'rawResult' in result && result.rawResult) {
      const raw = result.rawResult as {
        formattedOutput?: string;
        message?: string;
      };
      return {
        success: true,
        data: raw.formattedOutput || raw.message || 'Registrations searched',
      };
    }

    return result;
  }
}