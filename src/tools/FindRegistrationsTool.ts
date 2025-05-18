import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import {
  AIAgentCapability,
  Logger,
  RegistrationSearchOptions,
} from '@hashgraphonline/standards-sdk';

export interface FindRegistrationsToolParams extends ToolParams {
  hcsClient: HCS10Client;
}

/**
 * A tool to search for registered HCS-10 agents using the configured registry.
 */
export class FindRegistrationsTool extends StructuredTool {
  name = 'find_registrations';
  description =
    'Searches the configured agent registry for HCS-10 agents. You can filter by account ID or tags. Returns basic registration info.';
  schema = z.object({
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

  private hcsClient: HCS10Client;
  private logger: Logger;

  constructor({ hcsClient, ...rest }: FindRegistrationsToolParams) {
    super(rest);
    this.hcsClient = hcsClient;
    this.logger = Logger.getInstance({ module: 'FindRegistrationsTool' });
  }

  protected async _call({
    accountId,
    tags,
  }: z.infer<this['schema']>): Promise<string> {
    this.logger.info(
      'Searching registrations with filters - Account ID',
      JSON.stringify({
        accountId,
        tags,
      })
    );

    const options: RegistrationSearchOptions = {};
    if (accountId) {
      options.accountId = accountId;
    }
    if (tags && tags.length > 0) {
      options.tags = tags;
    }
    options.network = this.hcsClient.getNetwork();

    try {
      if (!this.hcsClient.standardClient) {
        throw new Error(
          'Standard SDK client instance is not available in HCS10Client wrapper.'
        );
      }
      const result = await this.hcsClient.standardClient.findRegistrations(
        options
      );

      if (!result.success || result.error) {
        return `Error finding registrations: ${
          result.error || 'Unknown error'
        }`;
      }

      if (!result.registrations || result.registrations.length === 0) {
        return 'No registrations found matching the criteria.';
      }

      // Format the results based on available data from RegistrationSearchResult
      let output = `Found ${result.registrations.length} registration(s):\n`;
      result.registrations.forEach((reg, index: number) => {
        const metadata = reg.metadata;
        output += `${index + 1}. Name: ${metadata.alias || 'N/A'}\n`;
        output += `Description: ${metadata.bio || 'N/A'}\n`;
        output += `   Account ID: ${reg.accountId}\n`;
        output += `   Status: ${reg.status}\n`;
        output += `   Model: ${metadata.properties?.model || 'N/A'}\n`;
        if (metadata.properties?.capabilities && metadata.properties.capabilities.length > 0) {
          output += `   Capabilities: ${metadata.properties.capabilities.join(', ')}\n`;
        }
        if (metadata.properties) {
          output += `   Properties: ${JSON.stringify(metadata.properties)}\n`;
        }
        output += `   Inbound Topic: ${reg.inboundTopicId}\n`;
        output += `   Outbound Topic: ${reg.outboundTopicId}\n`;
        output += `   Created At: ${reg.createdAt}\n`;
      });

      return output.trim();
    } catch (error) {
      this.logger.error(`Failed to execute findRegistrations: ${error}`);
      return `Error searching registrations: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}
