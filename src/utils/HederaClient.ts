// src/utils/HederaClient.ts
import { Client, AccountId, PrivateKey, TopicMessage, TopicMessageQuery } from '@hashgraph/sdk';
import * as dotenv from 'dotenv';
import { HCS10Message } from '../hcs10/types';

// Load environment variables from .env file
dotenv.config();

/**
 * Creates and returns a Hedera Client based on environment variables.
 */
export function createHederaClient(): Client {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorId || !operatorKey) {
        throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in env.');
    }

    const client = Client.forName(network);
    client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));

    return client;
}

/**
 * HederaClient class for handling HCS-10 operations
 */
export class HederaClient {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Subscribe to messages from a topic
     * TODO: Update to use a mirror node
     */
    async subscribeToTopic(topicId: string, onMessage: (message: HCS10Message) => void, onError: (error: Error) => void): Promise<void> {
        const query = new TopicMessageQuery()
            .setTopicId(topicId)
            .setStartTime(0);

        try {
            query.subscribe(
                this.client,
                (_message: TopicMessage | null, error: Error) => {
                    if (error) {
                        onError(error);
                    }
                },
                (message: TopicMessage) => {
                    try {
                        const hcs10Message: HCS10Message = JSON.parse(message.contents.toString());
                        onMessage(hcs10Message);
                    } catch (error) {
                        onError(error instanceof Error ? error : new Error('Failed to parse message'));
                    }
                }
            );
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Failed to subscribe to topic'));
        }
    }
}
