kotlin = require('kotlin')
// kotlin = require('./kotlin.js')
// const KotlinSdk = require("../../../kotlin_sdk/build/classes/kotlin/js/main/kotlin_sdk");
const KotlinSdk = require("./kotlin_sdk");
const App = require("../../../js_foundation/src/js/index");


class Application {
    async main(){
        let app = new App("0x0c868eE11E1a54DAfbaa87Fd4c100Cb7BAf14522", "0xe4bc4dcd6655eaec6387cf221623237518f35dd5");
        let kotlinSdk = new KotlinSdk.com.tabookey.kotlin_sdk.Sdk(app);
        let receipt = kotlinSdk.doStuff();
        console.log(receipt);
        console.log(await receipt);
    }
}

console.log(KotlinSdk.sample.hello());
let a = new Application();
a.main();