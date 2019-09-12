package com.tabookey.safechannels.vault.localchanges

/**
 * In contracts, this special value is reserved for native Ether transfers.
 * I though it is ok to leak this little detail to the SDK for uniformity.
 */
const val ETH_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

abstract class TransferChange(changeType: LocalChangeType,
                              val amount: String,
                              val destination: String,
                              val token: String
) : LocalVaultChange(changeType)

class EtherTransferChange(amount: String, destination: String) : TransferChange(LocalChangeType.TRANSFER_ETH, amount, destination, ETH_TOKEN_ADDRESS)

class Erc20TransferChange(amount: String, destination: String, token: String) : TransferChange(LocalChangeType.TRANSFER_ETH, amount, destination, token)