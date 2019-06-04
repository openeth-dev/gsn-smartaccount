package com.tabookey.kotlin_sdk

class Sdk(val app: IApp) {

    fun doStuff(): Receipt {
        return app.emitMessageWrapped("Hello", 7)
    }
}