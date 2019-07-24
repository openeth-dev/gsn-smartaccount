package com.tabookey.foundation

import com.tabookey.foundation.generated.Gatekeeper
import junit.framework.TestCase
import org.web3j.protocol.Web3j
import org.web3j.tx.TransactionManager

class TestSample : TestCase() {

    fun test1(){
        if (true){
            return
        }
        val a: Web3j? = null
        val b: TransactionManager? = null
        val Gatekeeper = Gatekeeper.load("", a, b, null)
    }

}