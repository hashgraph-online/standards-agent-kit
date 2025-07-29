import readline from 'readline';
import dotenv from 'dotenv';
import { ConversationalAgent } from '@hashgraphonline/conversational-agent';
import WeatherPlugin from '../src/plugins/weather';
import DeFiPlugin from '../src/plugins/defi';
import { HbarPricePlugin } from '../src/plugins/hedera/HbarPricePlugin';
import { OpenConvaiState } from '../src/state/open-convai-state';
import type { NetworkType } from '@hashgraphonline/standards-sdk';

dotenv.config();

export const getSystemMessage = (
  accountId: string
): string => `You are a helpful assistant managing Hashgraph Online HCS-10 connections, messages, HCS-2 registries, and content inscription.

You are currently operating as agent: ${accountId}
When users ask about "my profile", "my account", "my connections", etc., use this account ID: ${accountId}

Use the available tools based on their descriptions. Each tool clearly explains when and how to use it.`;

interface AgentIdentity {
  name: string;
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
}

// --- Global Variables ---
let agent: ConversationalAgent;
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

    // --- Initialize ConversationalAgent ---
    agent = new ConversationalAgent({
      accountId: selectedAccountId,
      privateKey: selectedPrivateKey,
      network: networkType,
      openAIApiKey: openaiApiKey,
      openAIModelName: 'gpt-4o',
      verbose: false,
      operationalMode: 'autonomous',
      stateManager,
      additionalPlugins: [
        new WeatherPlugin(),
        new DeFiPlugin(),
        new HbarPricePlugin(),
      ],
      customSystemMessagePreamble: getSystemMessage(selectedAccountId),
    });

    console.log('Initializing agent...');
    await agent.initialize();

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
