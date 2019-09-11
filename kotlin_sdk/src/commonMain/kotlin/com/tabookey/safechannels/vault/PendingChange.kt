package com.tabookey.safechannels.vault

import com.tabookey.safechannels.blockchain.BlockchainTransaction

class PendingChange(
        val transaction: BlockchainTransaction,
        val dueBlock: Int
)