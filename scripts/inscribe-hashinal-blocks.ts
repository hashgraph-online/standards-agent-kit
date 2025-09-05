#!/usr/bin/env node
/**
 * Script to inscribe HCS-12 display block for Hashinal inscriptions (Universal Version)
 *
 * This script creates a single universal HCS-12 block with a self-contained template
 * that handles all content types dynamically. The resulting block ID is then used
 * to replace the placeholder implementation in InscribeHashinalTool.ts
 */

import dotenv from 'dotenv';
import {
  Logger,
  HCS12Client,
  NetworkType,
  BlockBuilder,
} from '@hashgraphonline/standards-sdk';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const NETWORK: NetworkType = 'testnet';

/**
 * Inscribe universal HCS-12 block for Hashinal display
 */
async function inscribeUniversalHashinalBlock() {
  const logger = new Logger({
    module: 'HashinalBlockInscriber',
    level: 'debug',
    prettyPrint: true,
  });

  try {
    logger.info('Starting Universal Hashinal block inscription');

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      throw new Error(
        'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY environment variables must be set'
      );
    }

    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;

    const client = new HCS12Client({
      network: NETWORK,
      operatorId,
      operatorPrivateKey: operatorKey,
      logger,
    });

    /**
     * Load the universal template from file
     */
    const templatePath = path.join(
      __dirname,
      'universal-hashinal-template.html'
    );
    const universalTemplate = await fs.readFile(templatePath, 'utf-8');
    logger.info('Loaded universal template', {
      templateLength: universalTemplate.length,
    });

    /**
     * Create Universal Display Block
     */
    logger.info('Creating universal display block...');

    const universalBlockBuilder = BlockBuilder.createDisplayBlock(
      'hashinal/universal-display',
      'Hashinal Universal Display'
    )
      .setDescription(
        'Universal display block for all Hashinal inscription types with HCS-5 support, ' +
          'kiloscribe CDN integration, dynamic content detection, and HIP-412 metadata preview. ' +
          'Self-contained template with immediate JavaScript execution (no DOMContentLoaded).'
      )
      .setIcon('media-universal')
      .setKeywords([
        'hashinal',
        'universal',
        'inscription',
        'display',
        'nft',
        'image',
        'document',
        'multimedia',
        'hcs-5',
        'hcs-12',
      ])
      .addAttribute('name', 'string', 'Untitled Content')
      .addAttribute('creator', 'string', '')
      .addAttribute('topicId', 'string', '')
      .addAttribute('hrl', 'string', '')
      .addAttribute('network', 'string', 'testnet');

    universalBlockBuilder.setTemplate(Buffer.from(universalTemplate));

    await client.registerBlock(universalBlockBuilder);
    const universalBlockTopicId = universalBlockBuilder.getTopicId();

    logger.info('Universal display block created', { universalBlockTopicId });

    /**
     * Save block ID to config file for later use
     */
    const configData = {
      network: NETWORK,
      timestamp: new Date().toISOString(),
      universal: {
        topicId: universalBlockTopicId,
        hashLink: `hcs://12/${universalBlockTopicId}`,
        name: 'Hashinal Universal Display',
        description:
          'Universal display block for all Hashinal inscription types with dynamic content detection, ' +
          'self-contained JavaScript, fixed HCS URL regex, and proper IIFE execution.',
        features: ['Renders Hashinal inscriptions'],
      },
    };

    const configPath = path.join(
      process.cwd(),
      'hashinal-universal-block-config.json'
    );
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

    logger.info('Universal Hashinal block inscription initiated successfully!');
    logger.info('Block configuration saved to:', { configPath });
    logger.info(
      'Block ID will be available once inscription completes on the network'
    );

    console.log('\n=== UNIVERSAL HASHINAL BLOCK INSCRIPTION STARTED ===');
    console.log(`Universal Display Block: ${universalBlockTopicId}`);
    console.log(`Configuration saved to: ${configPath}`);
    console.log('====================================================\n');
  } catch (error) {
    logger.error('Universal Hashinal block inscription failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      error: error,
    });
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

inscribeUniversalHashinalBlock()
  .then(() => {
    console.log('Universal Hashinal block inscription completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
