import { HCS10Client, StandardNetworkType } from './hcs10/HCS10Client';
import { RegisterAgentTool } from './tools/RegisterAgentTool';
import { SendMessageTool } from './tools/SendMessageTool';
import { ConnectionTool } from './tools/ConnectionTool';
import { IStateManager } from './state/open-convai-state';

export interface HCS10InitializationOptions {
  useEncryption?: boolean;
  registryUrl?: string;
  stateManager?: IStateManager;
}

/**
 * Initializes the HCS10 client and returns pre-registered LangChain tools.
 *
 * @param options - Optional settings including useEncryption, registryUrl, and stateManager.
 */
export async function initializeHCS10Client(
  options?: HCS10InitializationOptions
): Promise<{
  hcs10Client: HCS10Client;
  tools: {
    registerAgentTool: RegisterAgentTool;
    sendMessageTool: SendMessageTool;
    connectionTool: ConnectionTool;
  };
}> {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorPrivateKey = process.env.HEDERA_OPERATOR_KEY;
  // Get network from env, default to testnet

  const networkEnv = process.env.HEDERA_NETWORK || 'testnet';
  // Validate and cast network type
  let network: StandardNetworkType;
  if (networkEnv === 'mainnet') {
    network = 'mainnet';
  } else if (networkEnv === 'testnet') {
    network = 'testnet';
  } else {
    console.warn(
      `Unsupported network specified in HEDERA_NETWORK: '${networkEnv}'. Defaulting to 'testnet'.`
    );
    network = 'testnet'; // Default to testnet if invalid/unsupported
  }

  if (!operatorId || !operatorPrivateKey) {
    throw new Error(
      'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in environment variables.'
    );
  }

  // Instantiate HCS10Client with validated network type
  const hcs10Client = new HCS10Client(
    operatorId,
    operatorPrivateKey,
    network, // Pass the validated StandardNetworkType
    {
      useEncryption: options?.useEncryption,
      registryUrl: options?.registryUrl,
    }
  );

  // Create pre-registered LangChain tool instances.
  const registerAgentTool = new RegisterAgentTool(hcs10Client);
  const sendMessageTool = new SendMessageTool(hcs10Client);

  // Instantiate ConnectionTool, passing stateManager if provided
  if (!options?.stateManager) {
    // This case should ideally not happen for interactive-demo, but handle defensively
    console.warn(
      '[initializeHCS10Client] Warning: stateManager not provided. ConnectionTool background updates will not update shared state.'
    );
    // Potentially throw an error if stateManager is strictly required for ConnectionTool
  }
  const connectionTool = new ConnectionTool({
    client: hcs10Client,
    stateManager: options?.stateManager as IStateManager,
  });

  return {
    hcs10Client,
    tools: {
      registerAgentTool,
      sendMessageTool,
      connectionTool,
    },
  };
}

export * from './hcs10';
export * from './tools';
export * from './state';
