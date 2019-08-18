package com.tabookey.safechannels

import com.tabookey.safechannels.vault.VaultStorageInterface

/**
 *I assume there can be 2 modes of work with private keys 'storage'
 *In 'debug' mode, keys can be created, imported and exported by the SDK itself
 *In real world, the key will be generated outside of the SDK (preferably in the HSM)
 *Therefore, the 'sign' will not happen inside the SDK, but there
 */
interface DebugStorageInterface : VaultStorageInterface {
    fun importPrivateKey(privateKey: String): String
    fun getPrivateKey(publicKey: String): String
}