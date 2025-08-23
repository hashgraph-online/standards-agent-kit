
import { FeeConfigBuilderInterface } from '@hashgraphonline/standards-sdk';

/**
 * Agent metadata interface used during registration.
 */
export interface AgentMetadata {
    name: string;
    description?: string;
    contact?: string;
    type?: 'autonomous' | 'manual';
    model?: string;
    capabilities?: number[];
    social?: Record<string, string>;
    properties?: Record<string, unknown>;
    socials?: Record<string, string>;
    creator?: string;
    feeConfig?: FeeConfigBuilderInterface;
}

/**
 * AgentChannels represents the communication topics for an agent.
 */
export interface AgentChannels {
    inboundTopicId: string;
    outboundTopicId: string;

}

/**
 * Represents a message in the HCS-10 protocol
 */
export interface HCS10Message {
    sender: string;
    recipient: string;
    content: string;
    timestamp: number;
    messageId: string;
    metadata?: Record<string, unknown>;
}
