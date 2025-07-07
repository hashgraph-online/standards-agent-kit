import * as dotenv from 'dotenv';
import readline from 'readline';
import { HederaConversationalAgent, ServerSigner } from 'hedera-agent-kit';
import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';
import WeatherPlugin from '../src/plugins/weather';
import DeFiPlugin from '../src/plugins/defi';
import { HbarPricePlugin } from '../src/plugins/hedera/HbarPricePlugin';
import { Logger, HCS10Client } from '@hashgraphonline/standards-sdk';
import { OpenConvaiState } from '../src/state/open-convai-state';
import type { NetworkType } from '@hashgraphonline/standards-sdk';

dotenv.config();

interface AgentIdentity {
  name: string;
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
}

// --- Global Variables ---
let agent: HederaConversationalAgent;
let stateManager: OpenConvaiState;

/**
 * Loads agent details from environment variables using a specified prefix
 */
async function loadAgentFromEnv(prefix: string): Promise<AgentIdentity | null> {
  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  const privateKey = process.env[`${prefix}_PRIVATE_KEY`];
  const inboundTopicId = process.env[`${prefix}_INBOUND_TOPIC_ID`];
  const outboundTopicId = process.env[`${prefix}_OUTBOUND_TOPIC_ID`];
  const profileTopicId = process.env[`${prefix}_PROFILE_TOPIC_ID`];

  if (!accountId || !privateKey || !inboundTopicId || !outboundTopicId) {
    console.log(`Incomplete agent details for prefix ${prefix}, skipping.`);
    return null;
  }

  return {
    name: `${prefix} Agent`,
    accountId,
    privateKey,
    inboundTopicId,
    outboundTopicId,
    profileTopicId,
  };
}

/**
 * Displays available agents and prompts user to select one
 */
async function promptUserToSelectAgent(
  agents: AgentIdentity[]
): Promise<AgentIdentity | null> {
  if (agents.length === 0) {
    console.log('No agents available. Please register a new agent first.');
    return null;
  }

  if (agents.length === 1) {
    console.log(`Auto-selecting the only available agent: ${agents[0].name}`);
    return agents[0];
  }

  console.log('\nAvailable agents:');
  agents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} (${agent.accountId})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const choice = await new Promise<string>((resolve) => {
    rl.question(
      'Select agent number (or press Enter to use first agent): ',
      resolve
    );
  });
  rl.close();

  if (!choice.trim()) {
    console.log(`Defaulting to first agent: ${agents[0].name}`);
    return agents[0];
  }

  const index = parseInt(choice) - 1;
  if (isNaN(index) || index < 0 || index >= agents.length) {
    console.log(`Invalid choice. Defaulting to first agent: ${agents[0].name}`);
    return agents[0];
  }

  return agents[index];
}

// --- Initialization ---
async function initialize() {
  console.log('Initializing HCS-10 LangChain Agent...');
  try {
    // --- Load Environment Variables ---
    const operatorId = process.env.HEDERA_OPERATOR_ID!;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY!;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const openaiApiKey = process.env.OPENAI_API_KEY!;
    const registryUrl = process.env.REGISTRY_URL;

    if (!operatorId || !operatorKey) {
      throw new Error(
        'HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env for initial client setup.'
      );
    }
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY must be set in .env');
    }

    // Validate and cast network type
    const hederaNetwork = network.toLowerCase();
    if (hederaNetwork !== 'mainnet' && hederaNetwork !== 'testnet') {
      throw new Error(
        `Invalid HEDERA_NETWORK: ${network}. Must be 'mainnet' or 'testnet'.`
      );
    }

    const networkType: NetworkType =
      hederaNetwork === 'mainnet' ? 'mainnet' : 'testnet';

    // Instantiate the state class
    stateManager = new OpenConvaiState();
    console.log('State manager initialized');

    // --- Load all known agents from environment variables ---
    const knownPrefixes = (process.env.KNOWN_AGENT_PREFIXES || 'TODD')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    console.log(
      `Found ${
        knownPrefixes.length
      } known agent prefix(es): ${knownPrefixes.join(', ')}`
    );

    const loadedAgents: AgentIdentity[] = [];
    for (const prefix of knownPrefixes) {
      const agentData = await loadAgentFromEnv(prefix);
      if (agentData) {
        loadedAgents.push(agentData);
        console.log(`Loaded agent: ${agentData.name} (${agentData.accountId})`);
      }
    }

    // --- Prompt user to select an agent if multiple are available ---
    let selectedAccountId = operatorId;
    let selectedPrivateKey = operatorKey;

    if (loadedAgents.length > 0) {
      const selectedAgent = await promptUserToSelectAgent(loadedAgents);

      if (selectedAgent) {
        console.log(
          `Using agent: ${selectedAgent.name} (${selectedAgent.accountId})`
        );

        selectedAccountId = selectedAgent.accountId;
        selectedPrivateKey = selectedAgent.privateKey;

        // Update state manager
        stateManager.setCurrentAgent({
          name: selectedAgent.name,
          accountId: selectedAgent.accountId,
          inboundTopicId: selectedAgent.inboundTopicId,
          outboundTopicId: selectedAgent.outboundTopicId,
          profileTopicId: selectedAgent.profileTopicId,
        });
      }
    }

    // --- Initialize HederaConversationalAgent ---
    const serverSigner = new ServerSigner(
      selectedAccountId,
      selectedPrivateKey,
      networkType
    );

    agent = new HederaConversationalAgent(serverSigner, {
      pluginConfig: {
        plugins: [
          new OpenConvAIPlugin(),
          new WeatherPlugin(),
          new DeFiPlugin(),
          new HbarPricePlugin(),
        ],
        appConfig: {
          stateManager,
          registryUrl,
          weatherApiKey: process.env.WEATHER_API_KEY,
          logger: new Logger({ module: 'PluginSystem' }),
        },
      },
      openAIApiKey: openaiApiKey,
      openAIModelName: 'gpt-4o',
      verbose: false,
      customSystemMessagePreamble: `You are a helpful assistant managing Hedera HCS-10 connections and messages.
// You have access to tools for registering agents, finding registered agents, initiating connections, listing active connections, sending messages over connections, and checking for new messages.

// *** IMPORTANT CONTEXT ***
// You are currently operating as agent: ${selectedAccountId}
// When users ask about "my profile", "my account", "my connections", etc., use this account ID: ${selectedAccountId}

// You also have access to a plugin system that provides additional tools for various functionalities:
// - Weather tools: Get current weather and weather forecasts for locations
// - DeFi tools: Get token prices, check token balances, and simulate token swaps
// - Hedera tools: Get the current HBAR price

// *** IMPORTANT TOOL SELECTION RULES ***
// - To REGISTER a new agent, use 'register_agent'.
// - To FIND existing registered agents in the registry, use 'find_registrations'. You can filter by accountId or tags.
// - To START a NEW connection TO a specific target agent (using their account ID), ALWAYS use the 'initiate_connection' tool.
// - To LISTEN for INCOMING connection requests FROM other agents, use the 'monitor_connections' tool (it takes NO arguments).
// - To SEND a message to a specific agent, use 'send_message_to_connection' tool.
// - To ACCEPT incoming connection requests, use the 'accept_connection_request' tool.
// - To MANAGE and VIEW pending connection requests, use the 'manage_connection_requests' tool.
// - To CHECK FOR *NEW* messages since the last check, use the 'check_messages' tool.
// - To GET THE *LATEST* MESSAGE(S) in a conversation, even if you might have seen them before, use the 'check_messages' tool and set the parameter 'fetchLatest: true'. You can optionally specify 'lastMessagesCount' to get more than one latest message (default is 1).
// - To RETRIEVE a profile, use the 'retrieve_profile' tool. When users ask for "my profile", use the current account ID: ${selectedAccountId}
// - For WEATHER information, use the appropriate weather plugin tools.
// - For DeFi operations, use the appropriate DeFi plugin tools.
// - For the CURRENT HBAR PRICE, use the 'getHbarPrice' tool.
// - Do NOT confuse these tools.

Remember the connection numbers when listing connections, as users might refer to them.`,
    });

    console.log('Initializing agent...');
    await agent.initialize();

    // Initialize ConnectionsManager with HCS10Client
    const hcs10Client = new HCS10Client({
      network: networkType,
      operatorId: selectedAccountId,
      operatorPrivateKey: selectedPrivateKey,
      logLevel: 'error',
    });
    stateManager.initializeConnectionsManager(hcs10Client);

    if (!process.env.WEATHER_API_KEY) {
      console.log(
        '\nNote: Weather API key not found in environment variables.'
      );
      console.log(
        'Weather plugin tools will not function correctly without an API key.'
      );
      console.log(
        'Set WEATHER_API_KEY in your .env file to use the Weather plugin.'
      );
    }

    console.log('LangChain agent initialized.');

    // Wait a moment for all async initialization to complete and logs to flush
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start connection monitoring in the background
    await startConnectionMonitoring();
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Starts connection monitoring in the background
 */
async function startConnectionMonitoring(): Promise<void> {
  // Connection monitoring is handled by the agent tools
  // The monitor_connections tool can be invoked through the agent's chat interface
  console.log('\n----------------------------------------');
  console.log(
    'Note: To monitor connections, ask the agent to "monitor connections"'
  );
  console.log('----------------------------------------\n');
}

/**
 * Handles the main chat interaction loop
 */
async function chatLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\nAgent ready. Type your message or 'exit' to quit.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('You: ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') {
      console.log('Exiting chat...');
      rl.close();
      // Note: The new ConnectionMonitorTool doesn't have a stopMonitoring method
      // It runs for a specified duration and stops automatically
      break;
    }

    try {
      console.log('Agent thinking...');
      const result = await agent.processMessage(userInput);
      console.log(`Agent: ${result.message || result.output}`);

      // Display any transaction details if present
      if (result.transactionBytes) {
        console.log('\nTransaction bytes:', result.transactionBytes);
      }
      if (result.scheduleId) {
        console.log('Schedule ID:', result.scheduleId);
      }
      if (result.transactionId) {
        console.log('Transaction ID:', result.transactionId);
      }
    } catch (error) {
      console.error('Error during agent execution:', error);
      console.log(
        'Agent: Sorry, I encountered an error processing your request. Please try again.'
      );
    }
  }
}

/**
 * Main program execution
 */
async function main() {
  try {
    // Step 1: Initialize and set up everything
    await initialize();

    // Step 2: Start the chat loop
    await chatLoop();
  } catch (err) {
    console.error('Unhandled error in main execution flow:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main loop:', err);
  process.exit(1);
});
