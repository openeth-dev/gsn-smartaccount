kotlin = require('kotlin')
// kotlin = require('./kotlin.js')
// const KotlinSdk = require("../../../kotlin_sdk/build/classes/kotlin/js/main/kotlin_sdk");
const KotlinSdk = require("./kotlin_sdk");
const App = require("../../../js_foundation/src/js/index");


class Application {
    main(){
        let app = new App("", "");
        let kotlinSdk = new KotlinSdk();
    }
}

console.log(KotlinSdk.sample.hello())
// let a = new Application()
// a.main()