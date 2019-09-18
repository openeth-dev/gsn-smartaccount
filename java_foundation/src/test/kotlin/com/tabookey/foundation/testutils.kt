package com.tabookey.foundation

import org.web3j.abi.TypeEncoder
import org.web3j.abi.datatypes.Type
import org.web3j.crypto.Credentials
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.core.Request
import org.web3j.protocol.core.Response
import org.web3j.protocol.core.methods.request.Transaction
import org.web3j.protocol.http.HttpService
import org.web3j.tx.gas.StaticGasProvider
import java.math.BigInteger
import java.util.*
import kotlin.reflect.KClass

private var timeOffset = 0L
private val port = 8545
val minuteInSec = 60
val hourInSec = 60 * minuteInSec
val dayInSec = 24 * hourInSec
//private val url = "http://127.0.0.1:${port}"

val url = "http://localhost:${port}"
val httpService = HttpService(url)
val web3j = Web3j.build(httpService)
val ganachePrivateKey = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
val deployCreds = Credentials.create(ganachePrivateKey)
val gasProvider = StaticGasProvider(BigInteger.valueOf(1), BigInteger.valueOf(10_000_000L))
val zeroAddress = "0x0000000000000000000000000000000000000000"

class NumericResult : Response<String>() {
    val longValue : Long
        get() = result.toLong()
}

fun packPermissionLevel(permissions: String, level: String): String {
    val permInt = permissions.toInt()
    val levelInt = level.toInt()

    assert(permInt <= 0x07FF)
    assert(levelInt <= 0x1F)
    return /*"0x" + */((levelInt shl 11) + permInt).toString(16)
}

/**
 * for debugging: change the current time.
 * must be called in parallel to evmIncreaseTime, to make the host time in sync with node time.
 */
fun debugIncreaseLocalTime(offsetSeconds: Long ) {
    timeOffset+=offsetSeconds*1000
}

/**
 * return the current time.
 *
 * <b>IMPORTANT</b>: must use this method for current time, and NOT the native currentTimeMillis()
 * and also use DateNow() instead of Date() for current time as Date object.
 *
 * The reason is to make our code testable. we do want to be able to "move the time forward" while testing for both
 * the node (Ganache) and for the app.
 */
fun timeMillis() = System.currentTimeMillis() + timeOffset


/**
 * return the current time.
 *
 * <b>IMPORTANT</b>: must use this method for current time, and NOT the Date()
 * <br>
 * The reason is to make our code testable. we do want to be able to "move the time forward" while testing for both
 * the node (Ganache) and for the app.
 */
fun DateNow() = Date(timeMillis())


/**
 * increase the current time by given seconds amount.
 * apply both to local host (timeMillis, DateNow()) and to the node.
 */
fun increaseTime(increase: Long, web3j: Web3j) {
    val timestamp = web3j.ethGetBlockByNumber(DefaultBlockParameterName.LATEST, false).send().block.timestamp.toLong()
    val localtime = timeMillis()/1000

    debugIncreaseLocalTime(increase)
    evm_increaseTime(increase)
    evm_mine()
}

// https://github.com/trufflesuite/ganache-cli
//Jump forward in time. Takes one parameter, which is the amount of time to increase in seconds. Returns the total time adjustment, in seconds.
private fun evm_increaseTime(increase: Long) = Request("evm_increaseTime",
        listOf(increase),
        httpService,
        NumericResult::class.java).send().longValue

private fun evm_mine() = Request("evm_mine",
        listOf<String>(),
        httpService,
        Response::class.java).send().let {}

//from: https://github.com/trufflesuite/ganache-cli
//Snapshot the state of the blockchain at the current block.
// Takes no parameters. Returns the integer id of the snapshot created.
private fun evm_snapshot(service: HttpService = httpService) = Request("evm_snapshot",
        listOf<String>(),
        service,
        NumericResult::class.java).send().longValue

//Revert the state of the blockchain to a previous snapshot.
// Takes a single parameter, which is the snapshot id to revert to.
// If no snapshot id is passed it will revert to the latest snapshot.
private fun evm_revert(id:Long?=null, service: HttpService = httpService) = Request("evm_revert",
        if(id==null) listOf() else listOf(id),
        service,
        Response::class.java).send().let{}


fun moneyTransfer(web3j: Web3j, from: String, to: String, wei : BigInteger ) {
    val nonce = web3j.ethGetTransactionCount(from, DefaultBlockParameterName.LATEST).send().transactionCount

    val transaction = Transaction.createEtherTransaction(
            from, nonce, gasProvider.gasPrice, gasProvider.gasLimit, to, wei)

    val res = web3j.ethSendTransaction(transaction).send()
    res.transactionHash ?: throw Exception(res.error.message)
}

fun encodePacked(parameters: List<Type<Any>>): String {
    var sb: StringBuilder = StringBuilder("")
    parameters.forEach {
        sb.append(TypeEncoder.encodePacked(it))
    }
    return sb.toString()
}

/**
 * expect an exception with this string as the exception's "toString()"
 * for case-insensitive search, add (?i) at the beginning of the string.
 */
inline fun shouldThrow(msgRegex: String, body: () -> Unit) {
    _shouldThrow(null, msgRegex, { msgRegex }, body)
}

//expect an expcetion of this class, with any message
inline fun shouldThrow(exClass: KClass<out Throwable>, body: () -> Unit) {
    _shouldThrow(exClass, null, { exClass.toString() }, body)
}

//expect an exception of the same class as this instance, and a message with the expected message's as substring
inline fun shouldThrow(exInstance: Throwable, body: () -> Unit) {
    _shouldThrow(exInstance::class, exInstance.message, { exInstance.toString() }, body)
}

class ShouldThrowException(msg:String, cause: Throwable?=null) : AssertionError(msg, cause)

inline fun _shouldThrow(expectedClass: KClass<out Throwable>?, expectedMsgRegex: String?, expectedErMsg: () -> String, body: () -> Unit) {
    try {
        body()
        throw ShouldThrowException("Should throw: \"${expectedErMsg()}\" (but threw nothing)")
    } catch ( s: ShouldThrowException) {
        throw s
    } catch (e: Throwable) {
        if (expectedClass != null && !expectedClass.isInstance(e))
            throw ShouldThrowException("Should throw ${expectedErMsg()} not \"${throwableToStr(e)}\"")
        if ( expectedMsgRegex!=null && Regex(expectedMsgRegex).find(e.toString()) == null  )
            throw ShouldThrowException("Should throw /${expectedErMsg()}/ not \"${throwableToStr(e)}\"", e)
    }

}

fun throwableToStr(t:Throwable) = t.toString().replace("java.lang.Exception", "Exception")
