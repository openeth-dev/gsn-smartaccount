package com.tabookey.foundation

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import org.web3j.crypto.Credentials

/**
 * [Kredentials] is a jvm object that implements the pure kotlin interface [IKredentials]
 * This allows any client to create and pass into the SDK an instance that handles the
 * signing without exposing the platform-specific detail to the Multiplatform SDK code.
 */
class Kredentials(private val credentials: Credentials) : IKredentials {
    override fun getAddress(): EthereumAddress {
        return credentials.address
    }

    fun getCredentials(): Credentials {
        return credentials
    }
}