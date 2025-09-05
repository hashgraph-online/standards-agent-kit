import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import { HCS6Builder } from '../src';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const DEMO_TIMEOUT_MS = Number(process.env.DEMO_TIMEOUT_MS || 120000);

async function runDemo() {
  let exitCode = 0;
  let timer;
  try {
    timer = setTimeout(() => process.exit(1), DEMO_TIMEOUT_MS);
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKeyString = process.env.HEDERA_OPERATOR_KEY;
    const networkEnv = (process.env.HEDERA_NETWORK || 'testnet').toLowerCase();
    const network = networkEnv === 'mainnet' ? 'mainnet' : 'testnet';

    if (!operatorId || !operatorKeyString) {
      throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY');
    }

    const signer = new ServerSigner(operatorId, operatorKeyString, network);

    const hederaKit = new HederaAgentKit(signer);
    await hederaKit.initialize();

    const hcs6Builder = new HCS6Builder(hederaKit);

    console.log('🚀 HCS-6 Dynamic Hashinal Demo');
    console.log('==============================\n');

    console.log('Step 1: Creating dynamic registry...');
    const registryResponse = await hcs6Builder.createRegistry({
      ttl: 86400,
      submitKey: true,
    });
    if (!registryResponse.success || !registryResponse.topicId) {
      throw new Error(`Failed to create registry: ${registryResponse.error}`);
    }
    const registryTopicId = registryResponse.topicId;
    console.log(`✅ Registry created: ${registryTopicId}`);

    const submitKey = ServerSigner.prototype.getOperatorPrivateKey
      ? hederaKit.signer.getOperatorPrivateKey()
      : undefined;

    console.log('Step 2: Creating initial dynamic hashinal...');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const svgPath = path.join(__dirname, '..', 'bob.svg');
    const svgBase64 = fs.readFileSync(svgPath).toString('base64');
    const gameCharacter = {
      name: 'Hero #1234',
      class: 'Warrior',
      level: 1,
      experience: 0,
      stats: {
        strength: 10,
        defense: 8,
        magic: 5,
        health: 100,
      },
      equipment: {
        weapon: 'Iron Sword',
        armor: 'Leather Armor',
      },
    };

    const hip412Create = {
      name: gameCharacter.name,
      type: 'image/svg+xml',
      image: `data:image/svg+xml;base64,${svgBase64}`,
      description: `${gameCharacter.class} level ${gameCharacter.level}`,
      creator: operatorId,
      attributes: [
        { trait_type: 'class', value: gameCharacter.class },
        { trait_type: 'level', value: gameCharacter.level },
        { trait_type: 'experience', value: gameCharacter.experience },
        { trait_type: 'strength', value: gameCharacter.stats.strength },
        { trait_type: 'defense', value: gameCharacter.stats.defense },
        { trait_type: 'magic', value: gameCharacter.stats.magic },
        { trait_type: 'health', value: gameCharacter.stats.health },
      ],
      properties: {
        equipment: gameCharacter.equipment,
      },
    };

    const registerResult1 = await hcs6Builder.register({
      metadata: hip412Create,
      memo: 'Character creation',
      ttl: 86400,
      registryTopicId,
      data: { base64: svgBase64, mimeType: 'image/svg+xml' },
      submitKey: submitKey ? submitKey.toString() : undefined,
    });
    if (!registerResult1.success || !registerResult1.inscriptionTopicId) {
      throw new Error(`Failed to register hashinal: ${registerResult1.error}`);
    }
    console.log(`✅ Dynamic hashinal created!`);
    console.log(`   Registry: ${registryTopicId}`);
    console.log(`   Content: ${registerResult1.inscriptionTopicId}\n`);

    console.log('Step 3: Querying current state...');
    const registry1 = await hcs6Builder.getRegistry(registryTopicId, {
      order: 'asc',
      limit: 1,
    });
    if (registry1.latestEntry) {
      console.log(`📊 Current state:`);
      console.log(`   Latest content: ${registry1.latestEntry.topicId}`);
      console.log(`   Updated: ${registry1.latestEntry.timestamp}`);
      console.log(`   Memo: ${registry1.latestEntry.message?.m || ''}\n`);
    }

    console.log('⏳ Simulating gameplay...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('Step 4: Updating dynamic hashinal (level up!)...');
    const updatedCharacter = {
      ...gameCharacter,
      level: 5,
      experience: 2500,
      stats: {
        strength: 18,
        defense: 15,
        magic: 8,
        health: 150,
      },
      equipment: {
        weapon: 'Steel Sword',
        armor: 'Chain Mail',
      },
    };

    const hip412Update = {
      name: updatedCharacter.name,
      type: 'image/svg+xml',
      image: `data:image/svg+xml;base64,${svgBase64}`,
      description: `${updatedCharacter.class} level ${updatedCharacter.level}`,
      creator: operatorId,
      attributes: [
        { trait_type: 'class', value: updatedCharacter.class },
        { trait_type: 'level', value: updatedCharacter.level },
        { trait_type: 'experience', value: updatedCharacter.experience },
        { trait_type: 'strength', value: updatedCharacter.stats.strength },
        { trait_type: 'defense', value: updatedCharacter.stats.defense },
        { trait_type: 'magic', value: updatedCharacter.stats.magic },
        { trait_type: 'health', value: updatedCharacter.stats.health },
        { trait_type: 'weapon', value: updatedCharacter.equipment.weapon },
        { trait_type: 'armor', value: updatedCharacter.equipment.armor },
      ],
      properties: {
        equipment: updatedCharacter.equipment,
      },
    };

    const registerResult2 = await hcs6Builder.register({
      metadata: hip412Update,
      memo: 'Level up! New equipment acquired',
      ttl: 86400,
      registryTopicId,
      data: { base64: svgBase64, mimeType: 'image/svg+xml' },
      submitKey: submitKey ? submitKey.toString() : undefined,
    });
    if (!registerResult2.success || !registerResult2.inscriptionTopicId) {
      throw new Error(`Failed to update hashinal: ${registerResult2.error}`);
    }
    console.log(`✅ Dynamic hashinal updated!`);
    console.log(`   New content: ${registerResult2.inscriptionTopicId}`);
    console.log(`   Update memo: Level up! New equipment acquired\n`);

    console.log('Step 5: Querying updated state...');
    const registry2 = await hcs6Builder.getRegistry(registryTopicId, {
      order: 'desc',
      limit: 10,
    });
    console.log(`📊 Updated registry state:`);
    console.log(`   Total updates: ${registry2.entries.length}`);
    if (registry2.latestEntry) {
      console.log(`   Latest content: ${registry2.latestEntry.topicId}`);
      console.log(`   Updated: ${registry2.latestEntry.timestamp}`);
      console.log(`   Memo: ${registry2.latestEntry.message?.m || ''}`);
    }

    console.log('\n✨ Demo completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`- Dynamic registry: ${registryTopicId}`);
    console.log(`- Initial state: Level 1 Warrior`);
    console.log(`- Final state: Level 5 Warrior with upgraded equipment`);
    console.log(`- All updates tracked in the registry for full history`);
  } catch (error) {
    console.log(error);
    console.error('❌ Error:', error);
    exitCode = 1;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    process.exit(exitCode);
  }
}

runDemo().catch(console.error);
