export type NetworkString = 'mainnet' | 'testnet'

export interface DAppSigner {
  getAccountId(): { toString(): string }
  [key: string]: unknown
}

export type WalletInfo = { accountId: string; network: NetworkString }

export type WalletInfoResolver = () => Promise<WalletInfo | null> | WalletInfo | null

export type WalletExecutor = (
  base64: string,
  network: NetworkString
) => Promise<{ transactionId: string }>

export type HCSOperation =
  | 'submitConnectionRequest'
  | 'handleConnectionRequest'
  | 'sendMessage'
  | 'hcs2.createRegistry'
  | 'hcs2.migrateRegistry'
  | 'hcs2.registerEntry'
  | 'hcs2.updateEntry'
  | 'hcs2.deleteEntry'
  | 'hcs2.submitMessage'
  | 'hcs6.createRegistry'
  | 'hcs6.registerEntry'
  | 'hcs6.submitMessage'

export type StartHCSDelegate = (
  op: HCSOperation,
  request: Record<string, unknown>,
  network: NetworkString
) => Promise<{ transactionBytes: string }>

/**
 * Central registry for browser signer and wallet execution delegates
 */
export class SignerProviderRegistry {
  private static _signerProvider: (() => Promise<DAppSigner | null>) | (() => DAppSigner | null) | DAppSigner | null
  private static _walletInfoResolver: WalletInfoResolver | null
  private static _walletExecutor: WalletExecutor | null
  private static _startHCSDelegate: StartHCSDelegate | null
  private static _browserHCSClientFactory: ((network: NetworkString) => unknown) | null
  private static _preferWalletOnly = false

  static setSignerProvider(provider: typeof SignerProviderRegistry._signerProvider): void {
    this._signerProvider = provider
  }

  static async getSigner(): Promise<DAppSigner | null> {
    const p = this._signerProvider
    if (!p) return null
    try {
      if (typeof p === 'function') {
        const val = (p as () => Promise<DAppSigner | null> | DAppSigner | null)()
        return (val && typeof (val as Promise<unknown>).then === 'function')
          ? await (val as Promise<DAppSigner | null>)
          : (val as DAppSigner | null)
      }
      return p as DAppSigner
    } catch {
      return null
    }
  }

  static setWalletInfoResolver(resolver: WalletInfoResolver | null): void {
    this._walletInfoResolver = resolver || null
  }

  static async getWalletInfo(): Promise<WalletInfo | null> {
    const r = this._walletInfoResolver
    if (!r) return null
    try {
      const val = r()
      return (val && typeof (val as Promise<unknown>).then === 'function')
        ? await (val as Promise<WalletInfo | null>)
        : (val as WalletInfo | null)
    } catch {
      return null
    }
  }

  static setWalletExecutor(executor: WalletExecutor | null): void {
    this._walletExecutor = executor || null
  }

  static get walletExecutor(): WalletExecutor | null {
    return this._walletExecutor || null
  }

  static setStartHCSDelegate(delegate: StartHCSDelegate | null): void {
    this._startHCSDelegate = delegate || null
  }

  static get startHCSDelegate(): StartHCSDelegate | null {
    return this._startHCSDelegate || null
  }

  static setPreferWalletOnly(flag: boolean): void {
    this._preferWalletOnly = !!flag
  }

  /**
   * Register a factory to construct a BrowserHCSClient-like instance for wallet-driven flows
   */
  static setBrowserHCSClientFactory(factory: ((network: NetworkString) => unknown) | null): void {
    this._browserHCSClientFactory = factory || null
  }

  static getBrowserHCSClient(network: NetworkString): unknown | null {
    return this._browserHCSClientFactory ? this._browserHCSClientFactory(network) : null
  }

  static get preferWalletOnly(): boolean {
    return this._preferWalletOnly
  }
}

