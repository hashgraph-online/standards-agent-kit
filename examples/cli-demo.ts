import * as dotenv from 'dotenv';
import { HCS10Client, Logger } from '@hashgraphonline/standards-sdk';
import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';
import { OpenConvaiState } from '../src/state/open-convai-state';
import { updateEnvFile } from '../src/utils/state-tools';
import { HCS10Builder } from '../src/builders/hcs10/hcs10-builder';
import { HederaTool } from '../src/plugins/PluginInterface';
import WeatherPlugin from '../src/plugins/weather';
import DeFiPlugin from '../src/plugins/defi';
import { HbarPricePlugin } from '../src/plugins/hedera/HbarPricePlugin';
import { PluginRegistry } from '../src/plugins';
import readline from 'readline';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// --- Interfaces & State ---
interface RegisteredAgent {
  name: string;
  accountId: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
  operatorPrivateKey: string;
}

interface ActiveConnection {
  targetAccountId: string;
  targetAgentName: string;
  targetInboundTopicId: string;
  connectionTopicId: string;
}

let hederaKit: HederaAgentKit;
let hcs10Builder: HCS10Builder;
let openConvAIPlugin: OpenConvAIPlugin;
let currentAgent: RegisteredAgent | null = null;
const registeredAgents: RegisteredAgent[] = [];
let stateManager: OpenConvaiState;
let tools: Record<string, HederaTool> = {};

// Plugin system state
let pluginRegistry: PluginRegistry | null = null;

// --- Readline Setup ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

// --- Helper Functions ---
function displayHeader(title: string) {
  console.log(`\n--- ${title} ---`);
}

function displayAgentInfo(agent: RegisteredAgent | null) {
  if (agent) {
    console.log(`  Name: ${agent.name}`);
    console.log(`  Account ID: ${agent.accountId}`);
    console.log(`  Inbound Topic: ${agent.inboundTopicId}`);
    console.log(`  Outbound Topic: ${agent.outboundTopicId}`);
    if (agent.profileTopicId) {
      console.log(`  Profile Topic: ${agent.profileTopicId}`);
    }
  } else {
    console.log('  No agent details available.');
  }
}

// Helper function to display available capabilities
function displayCapabilities() {
  displayHeader('Available Agent Capabilities');
  console.log('  0: TEXT_GENERATION - Generate coherent, human-like text');
  console.log('  1: IMAGE_GENERATION - Create visual content based on prompts');
  console.log(
    '  2: AUDIO_GENERATION - Synthesize speech, music, or soundscapes'
  );
  console.log('  3: VIDEO_GENERATION - Produce dynamic visual content');
  console.log('  4: CODE_GENERATION - Produce code based on text prompts');
  console.log('  5: LANGUAGE_TRANSLATION - Convert text between languages');
  console.log(
    '  6: SUMMARIZATION_EXTRACTION - Distill content into concise summaries'
  );
  console.log(
    '  7: KNOWLEDGE_RETRIEVAL - Access and reason with structured data'
  );
  console.log('  8: DATA_INTEGRATION - Aggregate and visualize data sources');
  console.log('  9: MARKET_INTELLIGENCE - Analyze financial and economic data');
  console.log(' 10: TRANSACTION_ANALYTICS - Monitor and analyze transactions');
  console.log(' 11: SMART_CONTRACT_AUDIT - Evaluate decentralized code');
  console.log(
    ' 12: GOVERNANCE_FACILITATION - Support decentralized decision-making'
  );
  console.log(
    ' 13: SECURITY_MONITORING - Detect and respond to security threats'
  );
  console.log(' 14: COMPLIANCE_ANALYSIS - Ensure regulatory adherence');
  console.log(
    ' 15: FRAUD_DETECTION - Identify and mitigate fraudulent activities'
  );
  console.log(
    ' 16: MULTI_AGENT_COORDINATION - Enable collaboration between agents'
  );
  console.log(
    ' 17: API_INTEGRATION - Connect with external systems and services'
  );
  console.log(
    ' 18: WORKFLOW_AUTOMATION - Automate routine tasks and processes'
  );
}

// Load an agent from environment variables with a specified prefix
async function loadAgentFromEnv(
  prefix: string
): Promise<RegisteredAgent | null> {
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
    inboundTopicId,
    outboundTopicId,
    profileTopicId,
    operatorPrivateKey: privateKey,
  };
}

// Get a tool by name
function getTool(toolName: string): HederaTool | undefined {
  return tools[toolName];
}

async function listManagedAgents() {
  displayHeader('Managed Agents (This Session)');
  if (registeredAgents.length === 0) {
    console.log('No agents have been registered in this session.');
    return;
  }
  registeredAgents.forEach((agent, index) => {
    console.log(
      `${index + 1}. ${agent.name} (${agent.accountId}) ${
        agent === currentAgent ? '[ACTIVE]' : ''
      }`
    );
  });
}

async function selectActiveAgent() {
  displayHeader('Select Active Agent');
  if (registeredAgents.length === 0) {
    console.log('No agents available to select. Register an agent first.');
    return;
  }

  await listManagedAgents();
  const choice = await question('Enter the number of the agent to activate: ');
  const index = parseInt(choice) - 1;

  if (isNaN(index) || index < 0 || index >= registeredAgents.length) {
    console.log('Invalid choice.');
    return;
  }

  currentAgent = registeredAgents[index];
  console.log(`Agent "${currentAgent.name}" selected as active.`);

  // Reconfigure HederaAgentKit for the selected agent
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const networkType: NetworkType =
    network.toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
  const serverSigner = new ServerSigner(
    currentAgent.accountId,
    currentAgent.operatorPrivateKey,
    networkType
  );

  // Suppress ALL logs during re-initialization
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;
  const originalLogLevel = process.env.LOG_LEVEL;

  process.stdout.write = () => true;
  process.stderr.write = () => true;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
  process.env.LOG_LEVEL = 'silent';

  hederaKit = new HederaAgentKit(
    serverSigner,
    {
      plugins: [openConvAIPlugin],
      appConfig: {
        stateManager,
        registryUrl: process.env.REGISTRY_URL,
      },
    },
    'autonomous',
    undefined, // userAccountId
    true, // scheduleUserTransactionsInBytesMode
    undefined, // modelCapability
    undefined, // modelName
    undefined, // mirrorNodeConfig
    true // disableLogging
  );
  await hederaKit.initialize();

  // Update HCS10Builder with new kit
  hcs10Builder = new HCS10Builder(hederaKit, stateManager, {
    logLevel: 'error',
  });

  // Re-initialize the plugin with updated HederaAgentKit
  await openConvAIPlugin.initialize({
    logger: new Logger({ module: 'OpenConvAIPlugin', silent: true }),
    config: {
      hederaKit,
      registryUrl: process.env.REGISTRY_URL,
    },
    stateManager,
  });

  // Update tools reference
  tools = {};
  openConvAIPlugin.getTools().forEach((tool) => {
    tools[tool.name] = tool;
  });

  // Wait a bit for any async logs to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Restore all console output
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.debug = originalConsoleDebug;
  process.env.LOG_LEVEL = originalLogLevel || '';

  console.log(`Client reconfigured for active agent: ${currentAgent.name}`);

  // Reset active connections when switching agents
  stateManager.setCurrentAgent(currentAgent);
  console.log('Active connections cleared for the new agent.');
}

// --- Connection Actions ---
async function startMonitoringConnections() {
  displayHeader('Monitor Incoming Connections');
  if (!currentAgent) {
    console.log(
      'No active agent selected. Please select or register an agent first.'
    );
    return;
  }

  try {
    const monitorTool = getTool('monitor_connections');
    if (!monitorTool) {
      console.log('Connection monitoring tool not available.');
      return;
    }

    console.log('Starting connection monitoring for 60 seconds...');
    const result = await monitorTool.invoke({
      acceptAll: true,
      monitorDurationSeconds: 60,
    });
    console.log(result);
  } catch (error) {
    console.error('\nError starting connection monitor:', error);
  }
}

async function initiateConnection() {
  displayHeader('Initiate Connection');
  if (!currentAgent) {
    console.log(
      'No active agent selected. Please select or register an agent first.'
    );
    return;
  }

  const targetAccountId = await question(
    "Enter the target agent's Account ID (e.g., 0.0.12345): "
  );
  if (!targetAccountId || !/^\d+\.\d+\.\d+$/.test(targetAccountId)) {
    console.log('Invalid Account ID format.');
    return;
  }

  if (targetAccountId === currentAgent.accountId) {
    console.log('Cannot connect to yourself.');
    return;
  }

  try {
    console.log(`Initiating connection to ${targetAccountId}...`);

    const initiateTool = getTool('initiate_connection');
    if (!initiateTool) {
      console.log('Initiate connection tool not available.');
      return;
    }

    const result = await initiateTool.invoke({ targetAccountId });
    console.log(result);
  } catch (error) {
    console.error('\nError during connection initiation:', error);
  }
}

async function listActiveConnections() {
  displayHeader('Active Connections');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  try {
    const listTool = getTool('list_connections');
    if (!listTool) {
      console.log('List connections tool not available.');
      return;
    }

    const result = await listTool.invoke({
      includeDetails: true,
      showPending: true,
    });
    console.log(result);
  } catch (error) {
    console.error('\nError listing connections:', error);
  }
}

async function manageConnectionRequests() {
  displayHeader('Manage Connection Requests');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  const manageTool = getTool('manage_connection_requests');
  const acceptTool = getTool('accept_connection_request');

  if (!manageTool || !acceptTool) {
    console.log('Connection management tools not available.');
    return;
  }

  console.log('Connection Request Management Options:');
  console.log('  1. List Pending Requests');
  console.log('  2. View Request Details');
  console.log('  3. Accept Request');
  console.log('  4. Reject Request');
  console.log('  0. Back to Main Menu');

  const choice = await question('Enter your choice: ');

  switch (choice.trim()) {
    case '1':
      try {
        const result = await manageTool.invoke({ action: 'list' });
        console.log(result);
      } catch (error) {
        console.error('\nError listing requests:', error);
      }
      break;

    case '2':
      const viewRequestId = await question('Enter request ID to view: ');
      try {
        const result = await manageTool.invoke({
          action: 'view',
          requestKey: viewRequestId,
        });
        console.log(result);
      } catch (error) {
        console.error('\nError viewing request:', error);
      }
      break;

    case '3':
      const acceptRequestId = await question('Enter request ID to accept: ');
      try {
        const result = await acceptTool.invoke({
          requestKey: acceptRequestId,
        });
        console.log(result);
      } catch (error) {
        console.error('\nError accepting request:', error);
      }
      break;

    case '4':
      const rejectRequestId = await question('Enter request ID to reject: ');
      try {
        const result = await manageTool.invoke({
          action: 'reject',
          requestKey: rejectRequestId,
        });
        console.log(result);
      } catch (error) {
        console.error('\nError rejecting request:', error);
      }
      break;

    case '0':
      return;

    default:
      console.log('Invalid choice.');
      break;
  }

  await manageConnectionRequests();
}

// --- Messaging Actions ---
async function selectConnection(
  promptMessage: string
): Promise<ActiveConnection | null> {
  if (!currentAgent) {
    console.log('No active agent selected.');
    return null;
  }

  // Get current connections from state manager
  const currentConnections = stateManager.listConnections();
  if (currentConnections.length === 0) {
    console.log('No active connections available.');
    return null;
  }

  displayHeader('Select Connection');
  console.log(
    `Connections for ${currentAgent?.name} (${currentAgent?.accountId}):`
  );

  currentConnections.forEach((conn, index) => {
    console.log(
      `${index + 1}. To: ${conn.targetAgentName} (${conn.targetAccountId})`
    );
    console.log(`     Connection Topic: ${conn.connectionTopicId}`);
    let statusDisplay = conn.status || 'unknown';
    if (conn.isPending) {
      statusDisplay = 'pending';
    } else if (conn.needsConfirmation) {
      statusDisplay = 'needs confirmation';
    } else if (!statusDisplay || statusDisplay === 'unknown') {
      statusDisplay = 'established';
    }
    console.log(`     Status: ${statusDisplay}`);
  });

  const choice = await question(promptMessage);
  const index = parseInt(choice) - 1;

  if (isNaN(index) || index < 0 || index >= currentConnections.length) {
    console.log('Invalid choice.');
    return null;
  }
  return currentConnections[index];
}

async function sendMessageToConnection() {
  displayHeader('Send Message');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  const connection = await selectConnection(
    'Select connection to send message to: '
  );
  if (!connection) {
    console.log('Invalid connection selection.');
    return;
  }

  const messageContent = await question('Enter message content: ');
  if (!messageContent) {
    console.log('Message cannot be empty.');
    return;
  }

  try {
    console.log(`Sending message to ${connection.targetAgentName}...`);

    const sendTool = getTool('send_message_to_connection');
    if (!sendTool) {
      console.log('Send message tool not available.');
      return;
    }

    const result = await sendTool.invoke({
      targetIdentifier: connection.targetAccountId,
      message: messageContent,
    });

    console.log(result);
  } catch (error) {
    console.error('\nError sending message:', error);
  }
}

async function viewMessagesFromConnection() {
  displayHeader('View Incoming Messages');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  const connection = await selectConnection(
    'Select connection to view messages from: '
  );
  if (!connection) {
    console.log('Invalid connection selection.');
    return;
  }

  try {
    console.log(`Checking for messages from ${connection.targetAgentName}...`);

    const checkTool = getTool('check_messages');
    if (!checkTool) {
      console.log('Check messages tool not available.');
      return;
    }

    const result = await checkTool.invoke({
      targetIdentifier: connection.targetAccountId,
      lastMessagesCount: 10,
    });

    console.log(result);
  } catch (error) {
    console.error('\nError checking messages:', error);
  }
}

async function listUnapprovedConnectionRequests() {
  displayHeader('Unapproved Connection Requests');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  try {
    const listTool = getTool('list_unapproved_connection_requests');
    if (!listTool) {
      console.log('List unapproved requests tool not available.');
      return;
    }

    const result = await listTool.invoke({});
    console.log(result);
  } catch (error) {
    console.error('\nError listing unapproved connection requests:', error);
  }
}

// --- Plugin System ---
async function usePluginTool() {
  displayHeader('Use Plugin Tool');

  if (!pluginRegistry) {
    console.log('Plugin system not initialized.');
    return;
  }

  const pluginTools = pluginRegistry.getAllTools();
  if (pluginTools.length === 0) {
    console.log('No plugin tools available.');
    return;
  }

  // Display available tools
  console.log('Available tools:');
  pluginTools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
  });

  // Let user select a tool
  const toolChoice = await question('Select a tool (enter number): ');
  const toolIndex = parseInt(toolChoice) - 1;

  if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= pluginTools.length) {
    console.log('Invalid tool selection.');
    return;
  }

  const selectedTool = pluginTools[toolIndex];
  console.log(`\nSelected tool: ${selectedTool.name}`);
  console.log(`Description: ${selectedTool.description}`);

  // Handle different tools with specific parameter prompts
  try {
    let result;

    if (selectedTool.name === 'get_current_weather') {
      const location = await question('Enter location (e.g., London, UK): ');
      const unit = await question(
        'Enter temperature unit (celsius/fahrenheit): '
      );

      result = await selectedTool.invoke({
        location,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    } else if (selectedTool.name === 'get_weather_forecast') {
      const location = await question('Enter location (e.g., London, UK): ');
      const daysStr = await question('Enter number of days (1-7): ');
      const unit = await question(
        'Enter temperature unit (celsius/fahrenheit): '
      );

      const days = parseInt(daysStr);

      result = await selectedTool.invoke({
        location,
        days: isNaN(days) ? 3 : days,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    } else if (selectedTool.name === 'getHbarPrice') {
      result = await selectedTool.invoke({});
    } else if (selectedTool.name === 'get_token_price') {
      const tokenId = await question('Enter token ID (e.g., 0.0.1234): ');
      result = await selectedTool.invoke({ tokenId });
    } else if (selectedTool.name === 'swap_tokens') {
      const fromTokenId = await question(
        'Enter source token ID (e.g., 0.0.1234): '
      );
      const toTokenId = await question(
        'Enter destination token ID (e.g., 0.0.5678): '
      );
      const amountStr = await question('Enter amount to swap: ');
      const amount = parseFloat(amountStr);

      result = await selectedTool.invoke({
        fromTokenId,
        toTokenId,
        amount: isNaN(amount) ? 1 : amount,
      });
    } else if (selectedTool.name === 'check_token_balance') {
      const tokenId = await question('Enter token ID (e.g., 0.0.1234): ');
      const accountId = await question(
        'Enter account ID (optional, press Enter to use current agent): '
      );

      result = await selectedTool.invoke({
        tokenId,
        accountId: accountId.trim() || currentAgent?.accountId,
      });
    } else {
      console.log(
        'This tool requires custom parameters that are not supported in this demo.'
      );
      return;
    }

    console.log('\nResult:');
    console.log(result);
  } catch (error) {
    console.error('Error using tool:', error);
  }
}

// Helper function to update KNOWN_AGENT_PREFIXES in the .env file
async function addPrefixToKnownAgents(prefix: string): Promise<void> {
  const envFilePath = '.env';
  const currentPrefixes = process.env.KNOWN_AGENT_PREFIXES || '';

  // Split by comma, filter empty entries, add new prefix if not already there
  const prefixList = currentPrefixes
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (!prefixList.includes(prefix)) {
    prefixList.push(prefix);

    // Update the env file with the new list
    await updateEnvFile(envFilePath, {
      KNOWN_AGENT_PREFIXES: prefixList.join(','),
    });

    console.log(`Added ${prefix} to known agent prefixes.`);
  }
}

// Register new agent
async function registerNewAgent() {
  displayHeader('Register New Agent');
  const name = await question('Enter agent name: ');
  const description = await question('Enter agent description (optional): ');
  const model = await question(
    'Enter agent model identifier (optional, e.g., gpt-4o): '
  );

  if (!name) {
    console.error('Agent name is required.');
    return;
  }

  // Display capabilities and let user select
  displayCapabilities();
  console.log(
    '\nSelect capabilities (comma-separated numbers, e.g., "0,4,7"): '
  );
  const capabilitiesInput = await question('> ');
  let capabilities: number[] | undefined = undefined;

  try {
    if (capabilitiesInput.trim()) {
      capabilities = capabilitiesInput.split(',').map((num) => {
        const parsed = parseInt(num.trim(), 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 18) {
          throw new Error(`Invalid capability number: ${num.trim()}`);
        }
        return parsed;
      });
      if (capabilities.length === 0) {
        console.log('No valid capabilities selected, using tool default.');
        capabilities = undefined;
      }
    } else {
      console.log('Using tool default capabilities (TEXT_GENERATION).');
      capabilities = undefined;
    }
  } catch (error) {
    console.error(
      `Error parsing capabilities: ${
        error instanceof Error ? error.message : error
      }`
    );
    console.log('Using tool default capabilities (TEXT_GENERATION).');
    capabilities = undefined;
  }

  console.log(
    `Selected capabilities: ${
      capabilities ? capabilities.join(', ') : 'Default'
    }`
  );

  // Profile picture
  const profilePictureInput = await question(
    'Enter profile picture path or URL (optional, e.g., todd.svg or https://example.com/pfp.png): '
  );

  // Environment variable persistence configuration
  console.log('\nConfigure environment variable persistence:');
  const prefixInput = await question(
    'Enter prefix for environment variables (e.g., DAVE, AGENT - leave blank for default TODD): '
  );

  let persistence: { prefix?: string } | undefined = undefined;
  const customPrefix = prefixInput.trim();

  if (customPrefix) {
    persistence = { prefix: customPrefix };
    console.log(`Environment variables will use the prefix: ${customPrefix}`);
  } else {
    console.log('Using default prefix: TODD');
  }

  try {
    console.log(
      `\nRegistering agent "${name}"... this may take several minutes.`
    );

    const registerTool = getTool('register_agent');
    if (!registerTool) {
      console.log('Register agent tool not available.');
      return;
    }

    // Resolve local profile picture path
    let resolvedPfpInput: string | undefined = undefined;
    if (profilePictureInput) {
      const isUrl =
        profilePictureInput.startsWith('http://') ||
        profilePictureInput.startsWith('https://');
      if (isUrl) {
        resolvedPfpInput = profilePictureInput;
      } else {
        // Assume local path, resolve relative to project root
        resolvedPfpInput = path.join(projectRoot, profilePictureInput);
        console.log(`Resolved local profile picture path: ${resolvedPfpInput}`);
      }
    }

    // Prepare input based on tool schema
    const toolInput: Record<string, unknown> = {
      name,
      description,
      model,
      capabilities,
      profilePicture: resolvedPfpInput,
    };

    if (persistence && persistence.prefix) {
      toolInput.persistence = persistence;
    }

    // Invoke the tool
    const resultString = await registerTool.invoke(toolInput);

    // Process the result string
    try {
      const result = JSON.parse(resultString);

      if (
        result.success &&
        result.accountId &&
        result.privateKey &&
        result.inboundTopicId &&
        result.outboundTopicId
      ) {
        const newAgent: RegisteredAgent = {
          name: result.name,
          accountId: result.accountId,
          inboundTopicId: result.inboundTopicId,
          outboundTopicId: result.outboundTopicId,
          profileTopicId:
            result.profileTopicId !== 'N/A' ? result.profileTopicId : undefined,
          operatorPrivateKey: result.privateKey,
        };

        registeredAgents.push(newAgent);
        console.log('\nRegistration Successful!');
        console.log(result.message || resultString);
        displayAgentInfo(newAgent);

        // If user specified a custom prefix, add it to KNOWN_AGENT_PREFIXES in .env
        if (persistence && persistence.prefix) {
          await addPrefixToKnownAgents(persistence.prefix);
        } else {
          await addPrefixToKnownAgents('TODD');
        }

        // Ask if they want to switch to the new agent
        const switchToNew = await question(
          'Would you like to switch to this new agent? (y/n): '
        );
        if (switchToNew.toLowerCase().startsWith('y')) {
          currentAgent = newAgent;
          await selectActiveAgent(); // This will reconfigure everything
        }
      } else {
        console.error(
          'Registration via tool reported an issue or missing data:'
        );
        console.log(result.message || resultString);
      }
    } catch (parseError) {
      console.error('\nRegistration failed. Tool returned an error:');
      console.error(resultString);
    }
  } catch (error) {
    console.error('\nError during agent registration process:', error);
  }
}

// --- Main Menu Loop ---
async function showMenu() {
  console.log('\n============ HCS-10 CLI Demo ============');
  console.log(
    `Active Agent: ${
      currentAgent
        ? `${currentAgent.name} (${currentAgent.accountId})`
        : 'None Selected'
    }`
  );
  console.log(
    `Plugin System: ${pluginRegistry ? 'INITIALIZED' : 'NOT INITIALIZED'}`
  );
  console.log('-----------------------------------------');
  console.log('Agent Management:');
  console.log('  1. Register New Agent');
  console.log('  2. List Managed Agents (This Session)');
  console.log('  3. Select Active Agent');
  console.log('-----------------------------------------');
  console.log('Connection Management:');
  console.log('  4. Start Monitoring Incoming Connections (for Active Agent)');
  console.log('  5. Initiate Connection to Another Agent');
  console.log('  6. List Active Connections (for Active Agent)');
  console.log('  7. Manage Connection Requests');
  console.log('  8. List Unapproved Connection Requests');
  console.log('-----------------------------------------');
  console.log('Messaging:');
  console.log('  9. Send Message to Active Connection');
  console.log(' 10. View Incoming Messages from Active Connection');
  console.log('-----------------------------------------');
  console.log('Plugin System:');
  console.log(' 11. Use Plugin Tool');
  console.log('-----------------------------------------');
  console.log('  0. Exit');
  console.log('=========================================');

  const choice = await question('Enter your choice: ');

  switch (choice.trim()) {
    case '1':
      await registerNewAgent();
      break;
    case '2':
      await listManagedAgents();
      break;
    case '3':
      await selectActiveAgent();
      break;
    case '4':
      await startMonitoringConnections();
      break;
    case '5':
      await initiateConnection();
      break;
    case '6':
      await listActiveConnections();
      break;
    case '7':
      await manageConnectionRequests();
      break;
    case '8':
      await listUnapprovedConnectionRequests();
      break;
    case '9':
      await sendMessageToConnection();
      break;
    case '10':
      await viewMessagesFromConnection();
      break;
    case '11':
      await usePluginTool();
      break;
    case '0':
      console.log('Exiting demo...');
      rl.close();
      return; // Stop loop
    default:
      console.log('Invalid choice. Please try again.');
      break;
  }
  // Show menu again unless exiting
  await showMenu();
}

// --- Initialization and Start ---
async function main() {
  // Print initial message before suppressing logs
  console.log('Initializing HCS-10 CLI Demo...');

  // Suppress logs during entire initialization process - do this FIRST
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;

  // Store original log level
  const originalLogLevel = process.env.LOG_LEVEL;

  // Suppress all console output immediately
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
  process.env.LOG_LEVEL = 'silent';

  try {
    // Initialize state manager
    stateManager = new OpenConvaiState();

    // Get network configuration
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const networkType: NetworkType =
      network.toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID!;
    const operatorKey =
      process.env.HEDERA_OPERATOR_KEY ||
      process.env.HEDERA_OPERATOR_PRIVATE_KEY!;

    if (!operatorId || !operatorKey) {
      // Restore console for error message
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      console.error = originalConsoleError;
      throw new Error(
        'HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env'
      );
    }

    // Initialize HederaAgentKit with OpenConvAI plugin
    const serverSigner = new ServerSigner(operatorId, operatorKey, networkType);

    // Create the plugin
    openConvAIPlugin = new OpenConvAIPlugin();

    hederaKit = new HederaAgentKit(
      serverSigner,
      {
        plugins: [openConvAIPlugin],
        appConfig: {
          stateManager,
          registryUrl: process.env.REGISTRY_URL,
          silent: true,
        },
      },
      'autonomous',
      undefined, // userAccountId
      true, // scheduleUserTransactionsInBytesMode
      undefined, // modelCapability
      undefined, // modelName
      undefined, // mirrorNodeConfig
      true // disableLogging - this will suppress HederaAgentKit logs
    );

    await hederaKit.initialize();

    // Create HCS10Builder
    hcs10Builder = new HCS10Builder(hederaKit, stateManager, {
      logLevel: 'error',
    });

    // Initialize the plugin with context
    await openConvAIPlugin.initialize({
      logger: new Logger({ module: 'OpenConvAIPlugin', silent: true }),
      config: {
        hederaKit,
        registryUrl: process.env.REGISTRY_URL,
      },
      stateManager,
    });

    // Get tools from plugin
    tools = {};
    openConvAIPlugin.getTools().forEach((tool) => {
      tools[tool.name] = tool;
    });

    // Keep logs suppressed until after prompt is shown
    // They will be restored after agent selection

    // Initialize HCS10Client for ConnectionsManager
    const hcs10Client = new HCS10Client({
      network: networkType,
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'error',
      guardedRegistryBaseUrl: process.env.REGISTRY_URL,
    });
    stateManager.initializeConnectionsManager(hcs10Client);

    // Add a small delay to ensure all initialization logs are flushed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Restore console output to show agent loading
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
    process.env.LOG_LEVEL = originalLogLevel || '';

    // Load all known agents from environment variables
    const knownPrefixes = (process.env.KNOWN_AGENT_PREFIXES || 'TODD')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    console.log(
      `Found ${knownPrefixes.length} known agent prefixes: ${knownPrefixes.join(
        ', '
      )}`
    );

    for (const prefix of knownPrefixes) {
      const agent = await loadAgentFromEnv(prefix);
      if (agent) {
        registeredAgents.push(agent);
        console.log(`Loaded agent: ${agent.name} (${agent.accountId})`);
      }
    }

    // Prompt the user to select an agent to use
    if (registeredAgents.length > 0) {
      console.log('\nSelect an agent to use:');
      if (registeredAgents.length === 1) {
        console.log(
          `Auto-selecting the only available agent: ${registeredAgents[0].name}`
        );

        currentAgent = registeredAgents[0];
        await selectActiveAgent();
      } else {
        await listManagedAgents();

        // Add small delay to ensure prompt appears after any remaining logs
        await new Promise((resolve) => setTimeout(resolve, 50));
        const choice = await question(
          'Enter the number of the agent to use (or press Enter to skip): '
        );

        if (choice.trim()) {
          const index = parseInt(choice) - 1;
          if (!isNaN(index) && index >= 0 && index < registeredAgents.length) {
            currentAgent = registeredAgents[index];
            await selectActiveAgent();
          }
        }
      }
    } else {
      console.log('No agents found. Please register a new agent.');
    }

    // Initialize plugin system
    try {
      console.log('\nInitializing plugin system...');

      // Create plugin context
      const pluginContext = {
        hederaKit,
        logger: new Logger({ module: 'PluginSystem', silent: true }),
        config: {
          weatherApiKey: process.env.WEATHER_API_KEY,
        },
      };

      // Initialize plugin registry
      pluginRegistry = new PluginRegistry(pluginContext);

      // Load and register plugins
      const weatherPlugin = new WeatherPlugin();
      const defiPlugin = new DeFiPlugin();
      const hbarPricePlugin = new HbarPricePlugin();

      await pluginRegistry.registerPlugin(weatherPlugin);
      await pluginRegistry.registerPlugin(defiPlugin);
      await pluginRegistry.registerPlugin(hbarPricePlugin);

      console.log('Plugin system initialized successfully!');
      console.log('Weather, DeFi, and HBAR Price plugins loaded.');

      if (!process.env.WEATHER_API_KEY) {
        console.log(
          '\nWARNING: Weather API key not found in environment variables.'
        );
        console.log(
          'To use the Weather plugin, add WEATHER_API_KEY to your .env file.'
        );
      }
    } catch (error) {
      console.error('Error initializing plugin system:', error);
      console.log('Continuing without plugin functionality.');
    }

    // Small delay to ensure all logs are flushed before showing menu
    await new Promise((resolve) => setTimeout(resolve, 100));
    await showMenu();
  } catch (error) {
    console.error('Failed to initialize:', error);
    rl.close();
  }
}

main();
