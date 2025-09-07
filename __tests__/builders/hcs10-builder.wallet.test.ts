import { HCS10Builder } from '../../src/builders/hcs10/hcs10-builder'
import { SignerProviderRegistry } from '../../src/signing/signer-provider'
import type { HederaAgentKit } from 'hedera-agent-kit'

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HCS10Client: jest.fn().mockImplementation(() => ({
    getClient: () => ({ operatorAccountId: { toString: () => '0.0.1234' } }),
    retrieveProfile: jest.fn(async (accountId: string) => ({ success: true, profile: { name: 'Test' }, topicInfo: { inboundTopic: '0.0.5000' } })),
    sendMessage: jest.fn(async () => ({ topicSequenceNumber: { toNumber: () => 42 }, transactionId: { toString: () => '0.0.1234@123' } })),
    getMessages: jest.fn(async () => ({ messages: [] })),
    getMessageStream: jest.fn(async () => ({ messages: [] })),
  })),
}))

const mockKit = ({ network = 'testnet' as const } = {}) => ({
  signer: {
    getAccountId: () => ({ toString: () => '0.0.1234' }),
    getOperatorPrivateKey: () => ({ toStringRaw: () => '302e0201003005...' }),
  },
  client: { network: { toString: () => network } },
}) as unknown as HederaAgentKit

describe('HCS10Builder wallet-first delegates', () => {
  beforeEach(() => {
    SignerProviderRegistry.setStartHCSDelegate(null)
    SignerProviderRegistry.setWalletExecutor(null)
    SignerProviderRegistry.setPreferWalletOnly(false)
  })

  it('submitConnectionRequest uses StartHCSDelegate + WalletExecutor when provided', async () => {
    const start = jest.fn(async () => ({ transactionBytes: 'BASE64_BYTES' }))
    const exec = jest.fn(async () => ({ transactionId: '0.0.9999@123' }))
    SignerProviderRegistry.setStartHCSDelegate(start)
    SignerProviderRegistry.setWalletExecutor(exec)

    const builder = new HCS10Builder(mockKit())
    const receipt = await builder.submitConnectionRequest('0.0.5000', 'true')
    expect(start).toHaveBeenCalledWith('submitConnectionRequest', { inboundTopicId: '0.0.5000', memo: 'true' }, 'testnet')
    expect(exec).toHaveBeenCalledWith('BASE64_BYTES', 'testnet')
    expect((receipt as any).transactionId).toBe('0.0.9999@123')
  })

  it('submitConnectionRequest throws wallet_unavailable when preferWalletOnly and no delegates', async () => {
    SignerProviderRegistry.setPreferWalletOnly(true)
    const builder = new HCS10Builder(mockKit())
    await expect(builder.submitConnectionRequest('0.0.5000', 'true')).rejects.toMatchObject({ code: 'wallet_unavailable' })
  })

  it('sendMessage uses wallet delegates when configured', async () => {
    const start = jest.fn(async () => ({ transactionBytes: 'BYTES' }))
    const exec = jest.fn(async () => ({ transactionId: '0.0.7777@999' }))
    SignerProviderRegistry.setStartHCSDelegate(start)
    SignerProviderRegistry.setWalletExecutor(exec)

    const builder = new HCS10Builder(mockKit())
    const res = await builder.sendMessage('0.0.6000', 'hello world')
    expect(start).toHaveBeenCalledWith('sendMessage', { topicId: '0.0.6000', data: 'hello world', memo: undefined }, 'testnet')
    expect(exec).toHaveBeenCalledWith('BYTES', 'testnet')
    expect(res.transactionId).toBe('0.0.7777@999')
  })
})
