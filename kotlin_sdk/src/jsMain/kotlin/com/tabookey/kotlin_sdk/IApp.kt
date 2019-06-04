package com.tabookey.kotlin_sdk

actual external interface IApp
{

    actual fun emitMessageWrapped(message: String, value: Int): Receipt

    actual fun getData(): Any

    actual fun foo(value: Int)
}