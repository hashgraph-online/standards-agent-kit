import { InscriberBuilder } from '../../src/builders/inscriber/inscriber-builder';
import type { HederaAgentKit } from 'hedera-agent-kit';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  inscribe: jest.fn(async () => ({ quote: false, confirmed: true, result: { transactionId: '0.0.1000@123456789.000000000' } })),
  inscribeWithSigner: jest.fn(async () => ({ quote: false, confirmed: true, result: { transactionId: '0.0.2000@123456789.000000000' } })),
}));

describe('InscriberBuilder wallet-first selection', () => {
  const mockHederaKit = {
    signer: {
      getAccountId: () => ({ toString: () => '0.0.1234' }),
      getOperatorPrivateKey: () => ({ toStringRaw: () => '302e020100300506032b657004220420...' }),
    },
    client: { network: { toString: () => 'testnet' } },
  } as unknown as HederaAgentKit;

  it('awaits async signer provider and uses inscribeWithSigner when signer available', async () => {
    const builder = new InscriberBuilder(mockHederaKit);
    InscriberBuilder.setSignerProvider(async () => ({ getAccountId: () => ({ toString: () => '0.0.1234' }) } as any));

    const res = await builder.inscribeAuto({ type: 'url', url: 'https://example.com/image.png' }, { mode: 'hashinal' } as any);

    const { inscribeWithSigner } = require('@hashgraphonline/standards-sdk');
    expect(inscribeWithSigner).toHaveBeenCalled();
    expect(res?.result?.transactionId).toContain('0.0.2000');
  });

  it('falls back to server inscribe when no signer is provided', async () => {
    const builder = new InscriberBuilder(mockHederaKit);
    InscriberBuilder.setSignerProvider(() => null);

    const res = await builder.inscribeAuto({ type: 'url', url: 'https://example.com/image.png' }, { mode: 'hashinal' } as any);

    const { inscribe } = require('@hashgraphonline/standards-sdk');
    expect(inscribe).toHaveBeenCalled();
    expect(res?.result?.transactionId).toContain('0.0.1000');
  });

  it('throws wallet_unavailable when preferWalletOnly=true and no wallet is connected', async () => {
    const builder = new InscriberBuilder(mockHederaKit);
    InscriberBuilder.setSignerProvider(() => null);
    InscriberBuilder.setWalletInfoResolver(() => null);
    InscriberBuilder.setPreferWalletOnly(true);

    await expect(
      builder.inscribeAuto({ type: 'url', url: 'https://example.com/file.png' }, { mode: 'hashinal' } as any)
    ).rejects.toMatchObject({ code: 'wallet_unavailable' });

    InscriberBuilder.setPreferWalletOnly(false);
  });
});

