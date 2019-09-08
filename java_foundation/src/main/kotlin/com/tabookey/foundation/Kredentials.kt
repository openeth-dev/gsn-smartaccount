package com.tabookey.foundation

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import org.web3j.crypto.Credentials

class Kredentials(private val credentials: Credentials) : IKredentials {
    override fun getAddress(): EthereumAddress {
        return credentials.address
    }

    fun getCredentials(): Credentials {
        return credentials
    }
}