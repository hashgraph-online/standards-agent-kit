import * as dotenv from 'dotenv';
import readline from 'readline';

import { HCS10Client } from '@hashgraphonline/standards-agent-kit';

import { ConnectionMonitorTool } from '../src/tools/ConnectionMonitorTool';
import { AcceptConnectionRequestTool } from '../src/tools/AcceptConnectionRequestTool';
import { ManageConnectionRequestsTool } from '../src/tools/ManageConnectionRequestsTool';
import { CheckMessagesTool } from '../src/tools/CheckMessagesTool';
import { ConnectionTool } from '../src/tools/ConnectionTool';
import { RegisterAgentTool } from '../src/tools/RegisterAgentTool';
import { FindRegistrationsTool } from '../src/tools/FindRegistrationsTool';
import { InitiateConnectionTool } from '../src/tools/InitiateConnectionTool';
import { ListConnectionsTool } from '../src/tools/ListConnectionsTool';
import { SendMessageToConnectionTool } from '../src/tools/SendMessageToConnectionTool';
import { SendMessageTool } from '../src/tools/SendMessageTool';
import { IStateManager } from '../src/state/state-types';
import { OpenConvaiState } from '../src/state/open-convai-state';

// --- LangChain Imports ---
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ConversationTokenBufferMemory } from 'langchain/memory';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { RetrieveProfileTool } from '../src/tools/RetrieveProfileTool';

dotenv.config();

interface AgentIdentity {
  name: string;
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
}

// --- Configuration ---
const AGENT_PERSONALITY = `You are a helpful assistant managing Hedera HCS-10 connections and messages.
You have access to tools for registering agents, finding registered agents, initiating connections, listing active connections, sending messages over connections, and checking for new messages.
The current agent you are operating as is configured via environment variables (OPERATOR_ID), but can switch if a new agent is registered.
When asked to perform an action, use the available tools. Ask for clarification if needed.
Be concise and informative in your responses.

*** IMPORTANT TOOL SELECTION RULES ***
- To REGISTER a new agent, use 'register_agent'.
- To FIND existing registered agents in the registry, use 'find_registrations'. You can filter by accountId or tags.
- To START a NEW connection TO a specific target agent (using their account ID), ALWAYS use the 'initiate_connection' tool.
- To LISTEN for INCOMING connection requests FROM other agents, use the 'monitor_connections' tool (it takes NO arguments).
- To ACCEPT incoming connection requests, use the 'accept_connection_request' tool.
- To MANAGE and VIEW pending connection requests, use the 'manage_connection_requests' tool.
- Do NOT confuse these tools.

Remember the connection numbers when listing connections, as users might refer to them.`;

// --- Global Variables ---
let hcsClient: HCS10Client;
let stateManager: IStateManager;
let agentExecutor: AgentExecutor;
let memory: ConversationTokenBufferMemory;
let connectionMonitor: ConnectionTool | null = null;
let connectionMonitorTool: ConnectionMonitorTool | null = null;
let tools: StructuredToolInterface[] = [];

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

    // --- Initialize HCS Client and State ---
    hcsClient = new HCS10Client(operatorId, operatorKey, hederaNetwork, {
      useEncryption: false,
      registryUrl: registryUrl,
    });

    const monitoringHcsClient = new HCS10Client(
      operatorId,
      operatorKey,
      hederaNetwork,
      {
        useEncryption: false,
        registryUrl: registryUrl,
        logLevel: 'error',
      }
    );

    // Instantiate the state class with default prefix TODD
    stateManager = new OpenConvaiState();
    console.log('State manager initialized with default prefix: TODD');

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
      const agent = await loadAgentFromEnv(prefix);
      if (agent) {
        loadedAgents.push(agent);
        console.log(`Loaded agent: ${agent.name} (${agent.accountId})`);
      }
    }

    // --- Prompt user to select an agent if multiple are available ---
    if (loadedAgents.length > 0) {
      const selectedAgent = await promptUserToSelectAgent(loadedAgents);

      if (selectedAgent) {
        console.log(
          `Using agent: ${selectedAgent.name} (${selectedAgent.accountId})`
        );

        // Configure clients with selected identity
        hcsClient.setClient(selectedAgent.accountId, selectedAgent.privateKey);

        monitoringHcsClient.setClient(
          selectedAgent.accountId,
          selectedAgent.privateKey
        );

        // Update state manager
        stateManager.setCurrentAgent({
          name: selectedAgent.name,
          accountId: selectedAgent.accountId,
          inboundTopicId: selectedAgent.inboundTopicId,
          outboundTopicId: selectedAgent.outboundTopicId,
          profileTopicId: selectedAgent.profileTopicId,
        });

        console.log(`Client configured to use ${selectedAgent.name}.`);
      } else {
        console.log('No agent selected. Using initial operator identity.');
      }
    } else {
      console.log(
        `No registered agents found. Using initial operator identity: ${operatorId}`
      );
    }

    console.log(
      `HCS client configured for operator ${hcsClient.getOperatorId()} on ${hederaNetwork}.`
    );

    // --- Instantiate Tools as an Array, passing stateManager ---
    tools = [
      new RegisterAgentTool(hcsClient),
      new FindRegistrationsTool({ hcsClient }),
      new InitiateConnectionTool({ hcsClient, stateManager }),
      new ListConnectionsTool({ hcsClient, stateManager }),
      new SendMessageToConnectionTool({
        hcsClient,
        stateManager,
      }),
      new CheckMessagesTool({ hcsClient, stateManager }),
      new SendMessageTool(hcsClient),
      new ConnectionTool({
        client: monitoringHcsClient,
        stateManager,
      }),
      new ConnectionMonitorTool({
        hcsClient: monitoringHcsClient,
        stateManager,
      }),
      new ManageConnectionRequestsTool({
        hcsClient,
        stateManager,
      }),
      new AcceptConnectionRequestTool({
        hcsClient,
        stateManager,
      }),
      new RetrieveProfileTool(hcsClient),
    ];

    connectionMonitor = tools.find(
      (tool) => tool instanceof ConnectionTool
    ) as ConnectionTool | null;

    connectionMonitorTool = tools.find(
      (tool) => tool instanceof ConnectionMonitorTool
    ) as ConnectionMonitorTool | null;

    console.log('Tools initialized.');

    // --- Initialize LangChain Components ---
    const llm = new ChatOpenAI({
      apiKey: openaiApiKey,
      modelName: 'gpt-4o',
      temperature: 0,
    });

    memory = new ConversationTokenBufferMemory({
      llm: llm,
      memoryKey: 'chat_history',
      returnMessages: true,
      outputKey: 'output',
      maxTokenLimit: 1000,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', AGENT_PERSONALITY],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt,
    });

    agentExecutor = new AgentExecutor({
      agent,
      tools,
      memory,
      verbose: false,
    });

    runMonitoring();

    console.log('LangChain agent initialized.');
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Initializes monitoring for connections with proper Promise handling
 */
async function runMonitoring(): Promise<void> {
  const monitoringPromises = [];

  if (connectionMonitor) {
    console.log('Attempting to start background connection monitoring...');
    try {
      const monitorPromise = connectionMonitor.invoke({});
      monitoringPromises.push(monitorPromise);

      monitorPromise
        .then(() => {
          console.log('Background connection monitor initiated.');
        })
        .catch((err) => {
          console.error(
            'Could not get inbound topic ID to start monitor:',
            err
          );
          console.warn('Connection monitoring could not be started.');
        });
    } catch (err) {
      console.error('Error initializing connection monitor:', err);
    }
  } else {
    console.warn('ConnectionTool instance not found, cannot monitor.');
  }

  if (connectionMonitorTool) {
    console.log(
      'Attempting to start ConnectionMonitorTool with 300 second monitoring...'
    );
    try {
      const toolMonitorPromise = connectionMonitorTool.invoke({
        monitorDurationSeconds: 300,
        acceptAll: false,
      });
      monitoringPromises.push(toolMonitorPromise);

      toolMonitorPromise
        .then(() => {
          console.log(
            'ConnectionMonitorTool started to watch for connection requests.'
          );
        })
        .catch((err) => {
          console.error('Could not start ConnectionMonitorTool:', err);
        });
    } catch (err) {
      console.error('Error initializing ConnectionMonitorTool:', err);
    }
  }

  // Wait for all promises to settle (either resolve or reject)
  await Promise.allSettled(monitoringPromises);

  // Add an additional delay to allow monitoring logs to complete
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Clear line to separate monitoring logs from chat
  console.log('\n----------------------------------------');
}

/**
 * Creates the LangChain agent with tools and memory
 */
async function setupAgent() {
  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-4o',
    temperature: 0,
  });

  memory = new ConversationTokenBufferMemory({
    llm: llm,
    memoryKey: 'chat_history',
    returnMessages: true,
    outputKey: 'output',
    maxTokenLimit: 1000,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', AGENT_PERSONALITY],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    verbose: false,
  });

  console.log('LangChain agent initialized.');
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

  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('You: ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') {
      console.log('Exiting chat...');
      rl.close();
      if (
        connectionMonitor &&
        typeof connectionMonitor.stopMonitoring === 'function'
      ) {
        console.log('Stopping connection monitor...');
        connectionMonitor.stopMonitoring();
      }
      break;
    }

    try {
      console.log('Agent thinking...');
      const result = await agentExecutor.invoke({ input: userInput });
      console.log(`Agent: ${result.output}`);
    } catch (error) {
      console.error('Error during agent execution:', error);
      console.log('Agent: Sorry, I encountered an error. Please try again.');
    }
  }
}

/**
 * Main program execution with clean sequential flow
 */
async function main() {
  try {
    // Step 1: Initialize client, state, and load agent identities
    await initialize();

    // Step 2: Set up LangChain agent with tools
    await setupAgent();

    // Step 3: Start monitoring and wait for it to complete initialization
    await runMonitoring();

    // Step 4: Only start chat loop after everything is fully ready
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
