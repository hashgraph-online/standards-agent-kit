import { Hbar, TransferTransaction, Client } from "@hashgraph/sdk";
import { Logger, HCS10Client, HederaMirrorNode } from "@hashgraphonline/standards-sdk";

export const MIN_REQUIRED_USD = 2.0;
export const MIN_REQUIRED_HBAR_USD = 10.0;

export async function ensureAgentHasEnoughHbar(
  logger: Logger,
  baseClient: HCS10Client,
  accountId: string,
  agentName: string
): Promise<void> {
  try {
    const account = await baseClient.requestAccount(accountId);
    const balance = account.balance.balance;
    const hbarBalance = balance / 100_000_000;

    logger.info(`${agentName} account ${accountId} has ${hbarBalance} HBAR`);

    try {
      const mirrorNode = new HederaMirrorNode('testnet', logger);
      const hbarPrice = await mirrorNode.getHBARPrice(new Date());

      if (hbarPrice) {
        const balanceInUsd = hbarBalance * hbarPrice;
        logger.info(`${agentName} balance in USD: $${balanceInUsd.toFixed(2)}`);

        if (balanceInUsd < MIN_REQUIRED_USD) {
          logger.warn(
            `${agentName} account ${accountId} has less than $${MIN_REQUIRED_USD} (${balanceInUsd.toFixed(
              2
            )}). Attempting to fund.`
          );

          try {
            const funder = baseClient.getAccountAndSigner();
            const targetHbar = MIN_REQUIRED_HBAR_USD / hbarPrice;
            const amountToTransferHbar = Math.max(0, targetHbar - hbarBalance);

            if (amountToTransferHbar > 0) {
              const transferTx = new TransferTransaction()
                .addHbarTransfer(
                  funder.accountId,
                  Hbar.fromTinybars(
                    Math.round(amountToTransferHbar * -100_000_000)
                  )
                )
                .addHbarTransfer(
                  accountId,
                  Hbar.fromTinybars(
                    Math.round(amountToTransferHbar * 100_000_000)
                  )
                );

              logger.info(
                `Funding ${agentName} account ${accountId} with ${amountToTransferHbar.toFixed(
                  2
                )} HBAR from ${funder.accountId}`
              );

              const fundTxResponse = await transferTx.execute(
                baseClient.getClient() as Client
              );
              await fundTxResponse.getReceipt(baseClient.getClient() as Client);
              logger.info(
                `Successfully funded ${agentName} account ${accountId}.`
              );
            } else {
              logger.info(
                `${agentName} account ${accountId} does not require additional funding.`
              );
            }
          } catch (fundingError) {
            logger.error(
              `Failed to automatically fund ${agentName} account ${accountId}:`,
              fundingError
            );
            logger.warn(
              `Please fund the account ${accountId} manually with at least ${(
                MIN_REQUIRED_HBAR_USD / hbarPrice
              ).toFixed(2)} HBAR.`
            );
          }
        }
      } else {
        logger.warn(
          'Failed to get HBAR price from Mirror Node. Please ensure the account has enough HBAR.'
        );
      }
    } catch (error) {
      logger.warn(
        'Failed to check USD balance. Please ensure the account has enough HBAR.'
      );
    }
  } catch (error) {
    logger.error(`Failed to check ${agentName} account balance:`, error);
  }
}