# Sample App Flows


## Components

* **User:** end-user, that runs a browser, and can accept SMS (and click links)
* **webapp:** static web-page of the application. communicate with the BE and with
   the vault (through gsn)
   contains the "account iframe", described below.
* **be**: back-end server: this is actually 2 separate components:
  * **guardian**: listen to ethereum events, and acts
  * **be**: listen to http requests from client, and pass requests to the guardian.<br>
  can be separated into 2 separate entities, but not in the demo..
* **account frame:** inside the static webapp, there's a small iframe which does:
  * google oauth.
  * creates private key and address. keep in `localStorage`
  * exposed APIs:
    * **getToken(nonce)** - returns a fresh JWT (token, email). prompt user if not logged in.
    * **getAddress()** - return address
    * **createAccount()** - authenticate and create address,privkey
    * **sign(data)** - use privkey to sign data
* **sponsor**: 
  - accepts calls to `factory`, with a signed approval from BE (jwt is fresh)
  - accepst calls to existing vault, from `isParticipant`<br>
    **TBD:** charge vault for such operations.
* **factory**: create and do initial configuration for a vault. Called through sponsor.
* **vault**: a single vault (safechannel)

### backend

* node module (so it can be used easily during testing)
* local DB to map vaultAddr-phone-email<br>
  (email can be deferred from approvaldata, but we have storage anyway.)
* SMS links:
  * we must use short SMS links, so BE genrates "short urls": links with random key
    into local storage.

## Flows:

* Create Vault
* Add Device Immediate
* Recover Device
* Transfer
* Transfer Immediate
* Technical flow: using Google Auth in iFrame.

### Vault Creation

![Vault Creation](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Vault+Creation%0a%0aparticipant+user%0aparticipant+webapp+as+app%0aparticipant+be%0aparticipant+google%0aparticipant+Sponsor%5cn%28Via+GSN%29+as+sponsor%0aparticipant+factory%0aparticipant+vault%0auser-%3e%2bapp%3a+login%0aapp-%3egoogle%3a+gapi%2esignIn%28email%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e%2bbe%3acreateAccount%28jwt%2c+phone%29%0adeactivate+app%0abe-%3e-user%3a+SMS+click+here+%28email%2cserver-nonce%29%0auser-%3e%2bapp%3a+click%0aapp-%3egoogle%3a+gapi%2eauthenticate%28email%2c+nonce%28address%29%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e%2bbe%3acreateVault%28JWT%2c+server-nonce%29%0anote+over+be%3a+validate+nonce%2c%5cnsave+email%2cphone%2c%5cnparse+JWT%2c%5cnsign+with+ECDSA%0abe-%3e-sponsor%3a+createVault%5cn%28approvalData%28email%2csig%29%29%0aactivate+sponsor%0asponsor-%3e-factory%3a+createVault%0afactory-%3e%2bvault%3a+create%0avault--%3e-webapp%3a+monitor+changes)


### Add Device Immediate

![Add Device Immediate](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Add+Device+Immediate%0a%0aparticipant+%22NewDevice%22+as+new%0aparticipant+%22OldDevice%22+as+user%0aparticipant+webapp+as+app%0aparticipant+be%0aparticipant+vault%0aparticipant+google%0a%0anew-%3e%2bapp%3a+login+%28email%29%0aactivate+new%0aapp-%3egoogle%3a+authenticate%28email%2c+nonce%28newaddr%29%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e-be%3aaddDeviceNow%28jwt%29%0aactivate+be%0anote+over+be%3a+get+SMS+for+email%0abe-%3euser%3a+SMS%3a+click+to+add+%28newaddr%29%0adeactivate+be%0auser-%3e%2bapp%3a+click%0anote+over+app%3a+auth%0aapp-%3e-vault%3a+addOperatorNow%28newaddr%29%0anote+over+vault%3a+PendingChange%0avault--%3e%2bbe%3a+monitor+changes%0anote+over+be%3a+approve+with%5cnno+SMS%0abe-%3e-vault%3a+approve%28%29%5cnas+guardian%0avault--%3enew%3a+monitor+change)


### Recover Device

![Recover Device](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Recover+Device%0a%0aparticipant+%22OldDevice%22+as+user%0aparticipant+%22NewDevice%22+as+new%0aparticipant+webapp+as+app%0aparticipant+be%0aparticipant+vault%0aparticipant+google%0a%0anote+over+user%3a+device%5cnlost%2e%2e%2e%0anote+over+new%3a+recover+SIM%0anew-%3e%2bapp%3a+login+%28%29%0aactivate+new%0aapp-%3egoogle%3a+authenticate%28email%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e-be%3arecoverDevice%28jwt%29%0aactivate+be%0anote+over+be%3a+get+SMS+for+email%0adeactivate+new%0abe-%3enew%3a+SMS%3a+click+to+recover+%28email%2bserver-nonce%29%0adeactivate+be%0anew-%3e%2bapp%3a+click%0aapp-%3egoogle%3a+authenticate%28email%2c+nonce%28newaddr%29%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e-be%3a+addOperator%28newaddr%2cjwt%2c+server-nonce%29%0aactivate+be%0anote+over+be%3a+validate%5cnserver-nonce%0abe-%3evault%3a+addOperator%28newaddr%29%0anote+over+vault%3a+PendingChange%0avault--%3eapp%3a+monitor+changes%0avault--%3euser%3a+monitor+changes%0auser-%3evault%3a+%5bOPTIONAL%5d+cancelPending%0anote+over+be%3a+time+passes%2e%2e%0abe-%3e-vault%3a+apply%28%29+as+guardian%0avault--%3eapp%3a+monitor+change)


### Transfer

![Transfer](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Transfer+Scenario%0a%0aparticipant+user%0aparticipant+%22Guardian%5cnWeb%22+as+web%0aparticipant+%22guardian%5cn%28be%29%22+as+guardian%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0a%0auser-%3e%2bweb%3a+transfer%0aweb-%3evault%3a+transfer%0anote+over+vault%3a+pending%0avault--%3eweb%3a+view+pending%0adeactivate+web%0avault+--%3e%2b+guardian%3a+view+pending%0anote+over+guardian%3a+read+phone+from%5cnvault+db%0aguardian-%3e-user%3a+SMS%3a+click+to+cancel%0a%0aalt+Cancel%0auser-%3e%2bweb%3a+click%0anote+right+of+web%3a+no+need%5cnto+auth%0aweb-%3e-guardian%3a+cancel%0aactivate+guardian%0aguardian-%3evault%3a+cancelPending%0adeactivate+guardian%0aelse+After+timeout%0anote+over+user%3a+ignore+cancel%5cnSMS%0a%0anote+over+guardian%3a+wait+for+timeout%0aguardian-%3evault%3a+apply%0a%0aend)


### Transfer Immediate

![Transfer Immediate](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Transfer+Immediate+Scenario%0a%0aparticipant+user%0aparticipant+%22Guardian%5cnWeb%22+as+web%0aparticipant+%22guardian%5cn%28be%29%22+as+guardian%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0a%0auser-%3e%2bweb%3a+transferImmediate%0aweb-%3evault%3a+transfer%0anote+over+vault%3a+done)


### Technical flow: Google Auth using iFrame

This is more techincal flow of using google auth and a separate "secured" iframe.
This means that the trusted app that contacts google OAuth service is not the sample app, but
"accounts.safechannel.com", which doesn't change between apps.

![Google Auth2 using iframe](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Google+Auth2+using+iframe%0aparticipant+user%0aparticipant+app%0aparticipant+iframe%0aparticipant+google%0a%0auser-%3eapp%3a+login%0aapp-%3eiframe%3a+getAddress%28%29%0aiframe--%3eapp%3a+null%0aapp-%3eiframe%3a+signIn%28%29%0aiframe-%3egoogle%3a+gapi%2esignIn%28%29%0agoogle-%3eiframe%3a+onSignIn%28JWT%29%0aiframe-%3eapp%3a+onSignIn%28JWT%29%0aapp-%3eiframe%3a+createAccount%28%29%0anote+over+iframe%3a+create%5cnPrivateKey%2c%5cnaddress%0aiframe-%3egoogle%3a+authenticate%28nonce%3aaddress%29%0anote+right+of+app%3a+%0aJWT+contains%3a+%0aemail%2c+timestamp%2c+nonce%3aaddress%0a%28also+iframe-url%2c+signature%29%0aend+note%0agoogle--%3eiframe%3a+jwt%0aiframe-%3eapp%3a+jwt)

```
title Google Auth2 using iframe
participant user
participant app
participant iframe
participant google

user->app: login
app->iframe: getAddress()
iframe-->app: null
app->iframe: signIn()
iframe->google: gapi.signIn()
google->iframe: onSignIn(JWT)
iframe->app: onSignIn(JWT)
app->iframe: createAccount()
note over iframe: create\nPrivateKey,\naddress
iframe->google: authenticate(nonce:address)
note right of app: 
JWT contains: 
email, timestamp, nonce:address
(also iframe-url, signature)
end note
google-->iframe: jwt
iframe->app: jwt
```

## Diagrams Source:
update with "websequence-md Flows.md", to read these flows into the images above.

```
title Vault Creation

participant user
participant webapp as app
participant be
participant google
participant Sponsor\n(Via GSN) as sponsor
participant factory
participant vault
user->+app: login
app->google: gapi.signIn(email)
google-->app: JWT
app->+be:createAccount(jwt, phone)
deactivate app
be->-user: SMS click here (email,server-nonce)
user->+app: click
app->google: gapi.authenticate(email, nonce(address))
google-->app: JWT
app->+be:createVault(JWT, server-nonce)
note over be: validate nonce,\nsave email,phone,\nparse JWT,\nsign with ECDSA
be->-sponsor: createVault\n(approvalData(email,sig))
activate sponsor
sponsor->-factory: createVault
factory->+vault: create
vault-->-webapp: monitor changes
```


```
title Add Device Immediate

participant "NewDevice" as new
participant "OldDevice" as user
participant webapp as app
participant be
participant vault
participant google

new->+app: login (email)
activate new
app->google: authenticate(email, nonce(newaddr))
google-->app: JWT
app->-be:addDeviceNow(jwt)
activate be
note over be: get SMS for email
be->user: SMS: click to add (newaddr)
deactivate be
user->+app: click
note over app: auth
app->-vault: addOperatorNow(newaddr)
note over vault: PendingChange
vault-->+be: monitor changes
note over be: approve with\nno SMS
be->-vault: approve()\nas guardian
vault-->new: monitor change
```

```
title Recover Device

participant "OldDevice" as user
participant "NewDevice" as new
participant webapp as app
participant be
participant vault
participant google

note over user: device\nlost...
note over new: recover SIM
new->+app: login ()
activate new
app->google: authenticate(email)
google-->app: JWT
app->-be:recoverDevice(jwt)
activate be
note over be: get SMS for email
deactivate new
be->new: SMS: click to recover (email+server-nonce)
deactivate be
new->+app: click
app->google: authenticate(email, nonce(newaddr))
google-->app: JWT
app->-be: addOperator(newaddr,jwt, server-nonce)
activate be
note over be: validate\nserver-nonce
be->vault: addOperator(newaddr)
note over vault: PendingChange
vault-->app: monitor changes
vault-->user: monitor changes
user->vault: [OPTIONAL] cancelPending
note over be: time passes..
be->-vault: apply() as guardian
vault-->app: monitor change
```

```
title Transfer Scenario

participant user
participant "Guardian\nWeb" as web
participant "guardian\n(be)" as guardian
participant "Vault\n(contract)" as vault

user->+web: transfer
web->vault: transfer
note over vault: pending
vault-->web: view pending
deactivate web
vault -->+ guardian: view pending
note over guardian: read phone from\nvault db
guardian->-user: SMS: click to cancel

alt Cancel
user->+web: click
note right of web: no need\nto auth
web->-guardian: cancel
activate guardian
guardian->vault: cancelPending
deactivate guardian
else After timeout
note over user: ignore cancel\nSMS

note over guardian: wait for timeout
guardian->vault: apply

end
```

```
title Transfer Immediate Scenario

participant user
participant "Guardian\nWeb" as web
participant "guardian\n(be)" as guardian
participant "Vault\n(contract)" as vault

user->+web: transferImmediate
web->vault: transfer
note over vault: done
```



