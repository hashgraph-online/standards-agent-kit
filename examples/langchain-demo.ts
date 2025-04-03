import * as dotenv from 'dotenv';
import readline from 'readline';

import {
  HCS10Client,
  StandardNetworkType,
  IStateManager,
  OpenConvaiState,
  CheckMessagesTool,
  ConnectionTool,
  RegisterAgentTool,
  FindRegistrationsTool,
  InitiateConnectionTool,
  ListConnectionsTool,
  SendMessageToConnectionTool,
  SendMessageTool,
} from '@hashgraphonline/standards-agent-kit';

// --- LangChain Imports ---
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ConversationTokenBufferMemory } from 'langchain/memory';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { HCS11Profile, ProfileResponse } from '@hashgraphonline/standards-sdk';

dotenv.config();

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
- Do NOT confuse these tools.

Remember the connection numbers when listing connections, as users might refer to them.`;

// --- Global Variables ---
let hcsClient: HCS10Client;
let stateManager: IStateManager; // Use renamed class and variable name
let agentExecutor: AgentExecutor;
let memory: ConversationTokenBufferMemory;
let connectionMonitor: ConnectionTool | null = null;

// --- Initialization ---
async function initialize() {
  console.log('Initializing HCS-10 LangChain Agent...');
  try {
    // --- Load Environment Variables ---
    const operatorId = process.env.HEDERA_OPERATOR_ID!;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY!;
    const network = (process.env.HEDERA_NETWORK ||
      'testnet') as StandardNetworkType;
    const openaiApiKey = process.env.OPENAI_API_KEY!;
    const registryUrl = process.env.REGISTRY_URL;

    if (!operatorId || !operatorKey) {
      throw new Error(
        'HEDERA_OPERATOR_ID and HEDERA_PRIVATE_KEY must be set in .env for initial client setup.'
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
    const standardNetwork: StandardNetworkType = hederaNetwork;

    // --- Initialize HCS Client and State ---
    hcsClient = new HCS10Client(operatorId, operatorKey, standardNetwork, {
      useEncryption: false,
      registryUrl: registryUrl,
    });

    const monitoringHcsClient = new HCS10Client(
      operatorId,
      operatorKey,
      standardNetwork,
      {
        useEncryption: false,
        registryUrl: registryUrl,
        logLevel: 'error',
      }
    );

    // Instantiate the renamed state class
    stateManager = new OpenConvaiState();

    // Use TODD details if available, now using setClient
    if (process.env.TODD_PRIVATE_KEY && process.env.TODD_ACCOUNT_ID) {
      console.log(
        `Setting client identity to TODD: ${process.env.TODD_ACCOUNT_ID}`
      );
      hcsClient.setClient(
        process.env.TODD_ACCOUNT_ID,
        process.env.TODD_PRIVATE_KEY
      );
      monitoringHcsClient.setClient(
        process.env.TODD_ACCOUNT_ID,
        process.env.TODD_PRIVATE_KEY
      );
      const toddProfile = (await hcsClient.retrieveProfile(
        process.env.TODD_ACCOUNT_ID
      )) as ProfileResponse;
      if (toddProfile.success && toddProfile.topicInfo) {
        stateManager.setCurrentAgent({
          name: (toddProfile.profile as HCS11Profile).display_name,
          accountId: process.env.TODD_ACCOUNT_ID,
          inboundTopicId: toddProfile.topicInfo.inboundTopic,
          outboundTopicId: toddProfile.topicInfo.outboundTopic,
        });
      } else {
        console.warn(
          'Could not retrieve TODD profile, using operator details.'
        );
      }
    } else {
      console.log(`Using initial operator identity: ${operatorId}`);
    }

    console.log(
      `HCS client configured for operator ${hcsClient.getOperatorId()} on ${standardNetwork}.`
    );

    // --- Instantiate Tools as an Array, passing stateManager via stateManager ---
    const tools: StructuredToolInterface[] = [
      new RegisterAgentTool(hcsClient),
      new FindRegistrationsTool({ hcsClient }),
      new InitiateConnectionTool({ hcsClient, stateManager: stateManager }),
      new ListConnectionsTool({ stateManager: stateManager }),
      new SendMessageToConnectionTool({
        hcsClient,
        stateManager: stateManager,
      }),
      new CheckMessagesTool({ hcsClient, stateManager: stateManager }),
      new SendMessageTool(hcsClient),
      new ConnectionTool({
        client: monitoringHcsClient,
        stateManager: stateManager,
      }),
    ];
    connectionMonitor = tools.find(
      (tool) => tool instanceof ConnectionTool
    ) as ConnectionTool | null;

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

const runMonitoring = async () => {
  // --- Start Connection Monitoring ---
  if (connectionMonitor) {
    console.log('Attempting to start background connection monitoring...');
    try {
      // _call now internally gets the topic ID
      await connectionMonitor._call({}); // Start the internal monitoring loop
      console.log('Background connection monitor initiated.');
      // No need to await the background process itself
    } catch (err) {
      console.error('Could not get inbound topic ID to start monitor:', err);
      console.warn('Connection monitoring could not be started.');
    }
  } else {
    console.warn('ConnectionTool instance not found, cannot monitor.');
  }
};

// --- Chat Loop ---
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

// --- Main Execution ---
async function main() {
  await initialize();
  await chatLoop();
}

main().catch((err) => {
  console.error('Unhandled error in main loop:', err);
  process.exit(1);
});
