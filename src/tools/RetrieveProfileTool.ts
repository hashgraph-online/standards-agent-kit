import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { HCS10Client } from '../hcs10/HCS10Client';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Tool for retrieving the HCS-11 profile associated with a Hedera account ID.
 * Utilizes the HCS10Client's retrieveProfile method, which handles fetching.
 */
export class RetrieveProfileTool extends StructuredTool {
  name = 'retrieve_profile';
  description =
    'Retrieves the HCS-11 profile data associated with a given Hedera account ID. If no account ID is provided, it defaults to the current operator account ID. Returns the profile object as a JSON string on success.';

  private client: HCS10Client;
  private logger: Logger;

  schema = z.object({
    accountId: z
      .string()
      .optional()
      .describe(
        'The Hedera account ID (e.g., 0.0.12345) to retrieve the profile for. If omitted, defaults to the current operator account ID.'
      ),
    disableCache: z
      .boolean()
      .optional()
      .describe(
        'Optional: Set to true to bypass the cache and fetch fresh profile data.'
      ),
  });

  /**
   * Creates a new RetrieveProfileTool instance.
   * @param client - An instance of HCS10Client.
   */
  constructor(client: HCS10Client) {
    super();
    this.client = client;
    this.logger = Logger.getInstance({ module: this.name });
  }

  /**
   * Executes the profile retrieval.
   * @param input - The input object containing accountId and optional disableCache flag.
   * @returns A JSON string of the profile on success, or an error message string.
   */
  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    let targetAccountId: string;
    try {
      if (input.accountId) {
        targetAccountId = input.accountId;
      } else {
        this.logger.info('accountId not provided, defaulting to operator ID.');
        targetAccountId = this.client.getOperatorId();
      }

      if (!targetAccountId) {
        throw new Error('Could not determine target account ID.');
      }

      this.logger.info(
        `Attempting to retrieve profile for account: ${targetAccountId}, Disable Cache: ${!!input.disableCache}`
      );

      // Call retrieveProfile via the standardClient instance using the determined ID
      const result = await this.client.standardClient.retrieveProfile(
        targetAccountId,
        input.disableCache
      );

      if (result.success && result.profile) {
        this.logger.info(
          `Successfully retrieved profile for ${targetAccountId}.`
        );

        return JSON.stringify(result.profile, null, 2);
      } else {
        const errorMessage = `Error retrieving profile for ${targetAccountId}: ${
          result.error || 'Profile not found or invalid.'
        }`;
        this.logger.error(errorMessage);
        return errorMessage;
      }
    } catch (error) {
      const idForError = input.accountId || 'operator default';
      const errorMessage = `Unexpected error retrieving profile for ${idForError}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this.logger.error(errorMessage, error);
      return errorMessage;
    }
  }
}
