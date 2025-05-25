#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Command } from 'commander';
import { initializeHCS10Client, HCS10Client } from '../../src';
import { AIAgentCapability, Logger } from '@hashgraphonline/standards-sdk';
import { StandardsExpertAgent } from './standards-expert-agent';
import { VectorStore } from './vector-store';
import { DocumentProcessor } from './document-processor';
import { OpenConvaiState } from '../../src/state/open-convai-state';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('standards-expert')
  .description('Hedera Standards Expert Agent')
  .version('1.0.0');

program
  .command('start')
  .description('Start the Standards Expert Agent')
  .option('-d, --docs <path>', 'Path to the documentation directory')
  .option('-v, --vector-store <path>', 'Path to the vector store directory')
  .option(
    '-n, --network <network>',
    'Hedera network (mainnet, testnet, previewnet)',
    'testnet'
  )
  .option(
    '-l, --log-level <level>',
    'Log level (debug, info, warn, error)',
    'info'
  )
  .option('-m, --model <n>', 'OpenAI model to use', 'gpt-3.5-turbo')
  .action(async (options) => {
    try {
      const requiredEnvVars = [
        'HEDERA_OPERATOR_ID',
        'HEDERA_OPERATOR_KEY',
        'AGENT_ACCOUNT_ID',
        'AGENT_PRIVATE_KEY',
        'AGENT_INBOUND_TOPIC_ID',
        'AGENT_OUTBOUND_TOPIC_ID',
        'OPENAI_API_KEY',
      ];

      const missingEnvVars = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
      );

      if (missingEnvVars.length > 0) {
        console.error(
          `Error: Missing required environment variables: ${missingEnvVars.join(
            ', '
          )}`
        );
        process.exit(1);
      }

      const stateManager = new OpenConvaiState();

      stateManager.setCurrentAgent({
        name: 'Standards Expert',
        accountId: process.env.AGENT_ACCOUNT_ID!,
        inboundTopicId: process.env.AGENT_INBOUND_TOPIC_ID!,
        outboundTopicId: process.env.AGENT_OUTBOUND_TOPIC_ID!,
        privateKey: process.env.AGENT_PRIVATE_KEY!,
        profileTopicId: '',
      });

      const { hcs10Client: clientInstance } = initializeHCS10Client({
        clientConfig: {
          operatorId: process.env.AGENT_ACCOUNT_ID!,
          operatorKey: process.env.AGENT_PRIVATE_KEY!,
          network: options.network,
          logLevel: options.logLevel,
        },
        createAllTools: true,
        stateManager,
      });

      const client = clientInstance as unknown as HCS10Client;

      const agent = new StandardsExpertAgent({
        client,
        accountId: process.env.AGENT_ACCOUNT_ID!,
        inboundTopicId: process.env.AGENT_INBOUND_TOPIC_ID!,
        outboundTopicId: process.env.AGENT_OUTBOUND_TOPIC_ID!,
        vectorStorePath:
          options.vectorStore || path.join(process.cwd(), 'vector-store'),
        openAiApiKey: process.env.OPENAI_API_KEY!,
        openAiModel: options.model,
        logLevel: options.logLevel,
      });

      await agent.initialize();

      if (options.docs) {
        const docsPath = options.docs;

        if (!fs.existsSync(docsPath)) {
          console.error(
            `Warning: Documentation directory not found at ${docsPath}`
          );
        } else {
          console.log(`Processing documentation from ${docsPath}...`);

          const vectorStore = new VectorStore({
            path:
              options.vectorStore || path.join(process.cwd(), 'vector-store'),
            namespace: 'standards-expert',
            openAiApiKey: process.env.OPENAI_API_KEY,
          });

          await vectorStore.initialize();

          const docProcessor = new DocumentProcessor({
            vectorStore,
            docsPath,
          });

          await docProcessor.processAllDocuments();
          console.log('Documentation processing complete.');
        }
      }

      console.log('Starting Standards Expert Agent...');
      await agent.start();

      process.on('SIGINT', async () => {
        console.log('Stopping agent...');
        await agent.stop();
        console.log('Agent stopped.');
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('Stopping agent...');
        await agent.stop();
        console.log('Agent stopped.');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error starting agent:', error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Set up the environment for the Standards Expert Agent')
  .option('-d, --docs <path>', 'Path to the documentation directory', 'docs')
  .option(
    '-o, --output <path>',
    'Path to write the environment file',
    '.env.local'
  )
  .action(async (options) => {
    try {
      const envPath = options.output;
      const docsPath = options.docs;

      if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true });
        console.log(`Created documentation directory at ${docsPath}`);
      }

      if (!fs.existsSync(envPath)) {
        const envTemplate = `# Hedera Account Information
HEDERA_OPERATOR_ID=
HEDERA_OPERATOR_KEY=

# Agent HCS Topics
AGENT_ACCOUNT_ID=
AGENT_PRIVATE_KEY=
AGENT_INBOUND_TOPIC_ID=
AGENT_OUTBOUND_TOPIC_ID=

# OpenAI Configuration
OPENAI_API_KEY=

# Optional Configuration
# VECTOR_STORE_PATH=./vector-store
# OPENAI_MODEL=gpt-3.5-turbo
`;

        fs.writeFileSync(envPath, envTemplate);
        console.log(`Created environment template at ${envPath}`);
        console.log(
          'Please fill in the required values in the environment file.'
        );
      } else {
        console.log(`Environment file already exists at ${envPath}`);
      }

      console.log('\nSetup complete. Next steps:');
      console.log(
        '1. Fill in your Hedera account credentials and topic IDs in the env file'
      );
      console.log('2. Add your OpenAI API key to the env file');
      console.log('3. Run the agent with: standards-expert start');
    } catch (error) {
      console.error('Error during setup:', error);
      process.exit(1);
    }
  });

program
  .command('process-docs')
  .description('Process documentation for the vector store')
  .option(
    '-d, --docs <path>',
    'Path to the documentation directory (for local files)',
    './docs'
  )
  .option(
    '-v, --vector-store <path>',
    'Path to the vector store directory',
    'vector-store'
  )
  .option(
    '--local-only',
    'Use only local documentation instead of GitHub',
    false
  )
  .option(
    '--github-repo <repo>',
    'GitHub repository to fetch documentation from',
    'hashgraph-online/hcs-improvement-proposals'
  )
  .option(
    '--github-branch <branch>',
    'GitHub branch to fetch documentation from',
    'main'
  )
  .option(
    '--cache-ttl <hours>',
    'Number of hours to cache GitHub content (0 to disable)',
    '24'
  )
  .option(
    '--all-repos',
    'Process all standard Hedera repositories (hcs-improvement-proposals, standards-sdk, standards-agent-kit)',
    false
  )
  .action(async (options) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY environment variable is required');
        process.exit(1);
      }

      const vectorStore = new VectorStore({
        path: options.vectorStore,
        namespace: 'standards-expert',
        openAiApiKey: process.env.OPENAI_API_KEY,
      });

      await vectorStore.initialize();

      const githubRepos = options.allRepos
        ? [
            'hashgraph-online/hcs-improvement-proposals',
            'hashgraph-online/standards-sdk',
            'hashgraph-online/standards-agent-kit',
          ]
        : [options.githubRepo];

      const processor = new DocumentProcessor({
        vectorStore,
        docsPath: options.docs,
        useGitHub: !options.localOnly,
        githubRepos,
        githubBranch: options.githubBranch,
        cacheTtlHours: parseInt(options.cacheTtl),
      });

      await processor.processAllDocuments();

      console.log('Documentation processing complete');
    } catch (error) {
      console.error('Error processing documentation:', error);
      process.exit(1);
    }
  });

program
  .command('generate-pm2')
  .description('Generate PM2 ecosystem.config.js file')
  .option(
    '-o, --output <path>',
    'Output path for ecosystem.config.js',
    'ecosystem.config.js'
  )
  .action(async (options) => {
    try {
      const ecosystemPath = options.output;
      const cwd = process.cwd();

      const ecosystemConfig = `module.exports = {
  apps: [
    {
      name: 'standards-expert',
      script: '${path.join(cwd, 'dist/examples/standards-expert/cli.ts')}',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      restart_delay: 10000,
      exp_backoff_restart_delay: 3000,
      watch: false,
      autorestart: true,
      instances: 1,
      exec_mode: 'fork',
      env_file: '${path.join(cwd, '.env')}',
    },
  ],
};`;

      fs.writeFileSync(ecosystemPath, ecosystemConfig);
      console.log(`Generated PM2 ecosystem file at ${ecosystemPath}`);
      console.log('\nTo start with PM2:');
      console.log('1. Install PM2: npm install -g pm2');
      console.log(`2. Run: pm2 start ${ecosystemPath}`);
    } catch (error) {
      console.error('Error generating PM2 config:', error);
      process.exit(1);
    }
  });

program
  .command('register')
  .description('Register a new Standards Expert Agent on the Hedera network')
  .option('-n, --name <n>', 'Name of the agent', 'Standards Expert')
  .option(
    '-d, --description <text>',
    'Description of the agent',
    'This agent helps answer questions about Hedera Standards'
  )
  .option(
    '-p, --picture <path>',
    'Path to profile picture',
    path.join(__dirname, 'agent-logo.svg')
  )
  .option(
    '-n, --network <network>',
    'Hedera network (mainnet, testnet, previewnet)',
    'testnet'
  )
  .option(
    '-f, --fee <amount>',
    'Optional HBAR fee to charge per message',
    parseFloat
  )
  .option('-c, --collector <id>', 'Fee collector account ID')
  .option(
    '--persist <prefix>',
    'Persist agent to env file with prefix',
    'AGENT'
  )
  .action(async (options) => {
    try {
      const requiredEnvVars = ['HEDERA_OPERATOR_ID', 'HEDERA_OPERATOR_KEY'];

      const missingEnvVars = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
      );

      if (missingEnvVars.length > 0) {
        console.error(
          `Error: Missing required environment variables: ${missingEnvVars.join(
            ', '
          )}`
        );
        process.exit(1);
      }

      const stateManager = new OpenConvaiState();

      stateManager.setCurrentAgent({
        name: options.name,
        accountId: process.env.HEDERA_OPERATOR_ID!,
        privateKey: process.env.HEDERA_OPERATOR_KEY!,
        inboundTopicId: '',
        outboundTopicId: '',
        profileTopicId: '',
      });

      const { tools } = initializeHCS10Client({
        clientConfig: {
          operatorId: process.env.HEDERA_OPERATOR_ID!,
          operatorKey: process.env.HEDERA_OPERATOR_KEY!,
          network: options.network,
        },
        createAllTools: true,
        stateManager,
      });

      const registerTool = tools.registerAgentTool!;

      const capabilities = [AIAgentCapability.TEXT_GENERATION];

      interface RegistrationParams {
        name: string;
        description: string;
        capabilities: AIAgentCapability[];
        type: 'autonomous';
        model: string;
        setAsCurrent: boolean;
        persistence: { prefix: string };
        profilePicture?: string;
        hbarFee?: number;
        feeCollectorAccountId?: string;
      }

      const registrationParams: RegistrationParams = {
        name: options.name,
        description:
          options.description ||
          'This agent helps answer questions about Hedera Standards',
        capabilities,
        type: 'autonomous' as const,
        model: 'gpt-3.5-turbo',
        setAsCurrent: true,
        persistence: {
          prefix: options.persist,
        },
      };

      if (options.picture) {
        registrationParams.profilePicture = options.picture;
      }

      if (options.fee && options.fee > 0) {
        registrationParams.hbarFee = options.fee;
        if (options.collector) {
          registrationParams.feeCollectorAccountId = options.collector;
        }
      }

      console.log('Registering Standards Expert Agent...');
      const resultJson = await registerTool._call(registrationParams);
      const result = JSON.parse(resultJson);

      if (result.success) {
        console.log(`✅ Agent registered successfully: ${result.name}`);
        console.log(`Agent Account ID: ${result.accountId}`);
        console.log(`Inbound Topic ID: ${result.inboundTopicId}`);
        console.log(`Outbound Topic ID: ${result.outboundTopicId}`);
        const envPath = path.join(process.cwd(), '.env.local');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf-8');
        }
        const envVars = {
          AGENT_ACCOUNT_ID: result.accountId,
          AGENT_PRIVATE_KEY: result.privateKey,
          AGENT_INBOUND_TOPIC_ID: result.inboundTopicId,
          AGENT_OUTBOUND_TOPIC_ID: result.outboundTopicId,
        };
        for (const [key, value] of Object.entries(envVars)) {
          if (envContent.includes(`${key}=`)) {
            envContent = envContent.replace(
              new RegExp(`${key}=.*`),
              `${key}=${value}`
            );
          } else {
            envContent += `\n${key}=${value}`;
          }
        }
        fs.writeFileSync(envPath, envContent);
        console.log(`\nEnvironment variables saved to ${envPath}`);
        console.log('\nNext steps:');
        console.log('1. Make sure your .env file includes your OpenAI API key');
        console.log(
          '2. Process documentation: standards-expert process-docs -d <docs_path>'
        );
        console.log('3. Start the agent: standards-expert start');
      } else {
        console.error(`❌ Failed to register agent: ${result.message}`);
      }
    } catch (error) {
      console.error('Error registering agent:', error);
      process.exit(1);
    }
  });

program
  .command('info')
  .description(
    'Display information about the current agent, connections, and state'
  )
  .option('-e, --env-file <path>', 'Path to .env file', '.env')
  .action(async (options) => {
    try {
      const logger = new Logger({ module: 'app' });
      const envPath = path.resolve(process.cwd(), options.envFile);

      if (!fs.existsSync(envPath)) {
        console.error(`Environment file not found: ${envPath}`);
        console.error(
          'Please create an .env file or specify a valid path with --env-file'
        );
        process.exit(1);
      }

      dotenv.config({ path: envPath });

      const operatorId = process.env.AGENT_ACCOUNT_ID as string;
      const operatorPrivateKey = process.env.AGENT_PRIVATE_KEY as string;
      const inboundTopicId = process.env.AGENT_INBOUND_TOPIC_ID as string;
      const outboundTopicId = process.env.AGENT_OUTBOUND_TOPIC_ID as string;

      if (
        !operatorId ||
        !operatorPrivateKey ||
        !inboundTopicId ||
        !outboundTopicId
      ) {
        console.error('Missing required environment variables:');
        if (!operatorId) {
          console.error('- AGENT_ACCOUNT_ID');
        }
        if (!operatorPrivateKey) {
          console.error('- AGENT_PRIVATE_KEY');
        }
        if (!inboundTopicId) {
          console.error('- AGENT_INBOUND_TOPIC_ID');
        }
        if (!outboundTopicId) {
          console.error('- AGENT_OUTBOUND_TOPIC_ID');
        }
        process.exit(1);
      }

      logger.info('State manager initialized');
      const stateManager = new OpenConvaiState();

      const client = new HCS10Client(
        operatorId,
        operatorPrivateKey,
        'testnet',
        { logLevel: 'info' }
      );
      logger.info(`HCS10Client initialized for ${operatorId} on testnet`);

      stateManager.initializeConnectionsManager(client.standardClient);

      stateManager.setCurrentAgent({
        name: 'Standards Expert',
        accountId: operatorId,
        inboundTopicId,
        outboundTopicId,
        privateKey: operatorPrivateKey,
      });

      const agent = new StandardsExpertAgent({
        client,
        accountId: operatorId,
        inboundTopicId,
        outboundTopicId,
        logLevel: 'info',
      });

      await agent.initialize();

      const connectionsManager = stateManager.getConnectionsManager();

      console.log('\n===== Agent Information =====');
      console.log(`Account ID: ${operatorId}`);
      console.log(`Inbound Topic: ${inboundTopicId}`);
      console.log(`Outbound Topic: ${outboundTopicId}`);

      console.log('\n===== Connections =====');
      if (connectionsManager) {
        await connectionsManager.fetchConnectionData(operatorId);

        const allConnections = connectionsManager.getAllConnections();
        console.log(`Total connections: ${allConnections.length}`);

        if (allConnections.length > 0) {
          console.log('\nActive connections:');
          allConnections.forEach((conn, index) => {
            console.log(
              `\n[${index + 1}] ${conn.targetAgentName || conn.targetAccountId}`
            );
            console.log(`  Account ID: ${conn.targetAccountId}`);
            console.log(`  Connection Topic: ${conn.connectionTopicId}`);
            console.log(`  Status: ${conn.status}`);
            console.log(`  Created: ${conn.created.toISOString()}`);
            console.log(
              `  Last Activity: ${
                conn.lastActivity ? conn.lastActivity.toISOString() : 'N/A'
              }`
            );
            if (conn.connectionRequestId) {
              console.log(
                `  Connection Request ID: ${conn.connectionRequestId}`
              );
            }
            if (conn.inboundRequestId) {
              console.log(`  Inbound Request ID: ${conn.inboundRequestId}`);
            }
            console.log(`  Processed: ${conn.processed ? 'Yes' : 'No'}`);
          });
        } else {
          console.log('No active connections found.');
        }

        const pendingRequests = connectionsManager.getPendingRequests();
        console.log(`\nPending requests: ${pendingRequests.length}`);
        if (pendingRequests.length > 0) {
          pendingRequests.forEach((req, index) => {
            console.log(`\n[${index + 1}] Request to: ${req.targetAccountId}`);
            console.log(
              `  Request ID: ${req.connectionRequestId || req.inboundRequestId}`
            );
            console.log(`  Status: ${req.status}`);
          });
        }
      } else {
        console.log('ConnectionsManager not initialized in state manager');
      }

      process.exit(0);
    } catch (error) {
      console.error('Error getting agent info:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
