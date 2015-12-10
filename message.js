
var web3 = new Web3();

var eth_msg = (function () {
    
    var exports = {};

    var ec = new ellipticjs.ec("secp256k1");
    var ipfs = IpfsApi("programming-progress.com", 443);

    /*
    var provider = new web3.providers.HttpProvider('https://programming-progress.com/eth/');

    web3.providers.HttpProvider.prototype.prepareRequest = function (async) {
        var request = new XMLHttpRequest();
        request.open('POST', this.host, async);
        request.withCredentials = true;
        // request.setRequestHeader('Content-Type','application/json');
        return request;
    };

    web3.setProvider(provider);
    */

    var secretContract = web3.eth.contract([{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"secret","type":"string"}],"name":"message","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"hash","type":"string"}],"name":"ipfsMessage","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint8[64]"}],"name":"setKey","outputs":[],"type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"addr","type":"address"},{"indexed":false,"name":"key","type":"uint8[64]"}],"name":"SetKey","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"},{"indexed":false,"name":"receiver","type":"address"},{"indexed":false,"name":"secret","type":"string"}],"name":"Message","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"sender","type":"address"},{"indexed":false,"name":"receiver","type":"address"},{"indexed":false,"name":"hash","type":"string"}],"name":"IPFSMessage","type":"event"}]);

    /*var secret = secretContract.new(
   {
     from: web3.eth.accounts[0], 
     data: '606060405261035f806100126000396000f360606040526000357c0100000000000000000000000000000000000000000000000000000000900480634fac1bb31461004f578063530167d7146100ae578063dfe33dde1461010d5761004d565b005b6100ac6004808035906020019091908035906020019082018035906020019191908080601f0160208091040260200160405190810160405280939291908181526020018383808284378201915050505050509090919050506101bf565b005b61010b6004808035906020019091908035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843782019150505050505090909190505061028f565b005b6101496004808061080001906040806020026040519081016040528092919082604060200280828437820191505050505090909190505061014b565b005b7fd573e8e5c0e563b6f2a3417c890ed312a526ed4f93713441ded697a88a01cff53382604051808373ffffffffffffffffffffffffffffffffffffffff168152602001826040602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390a15b50565b7fb3dbe9e9894ca2c11cb6c80bd0b0bccb9f5b41d612dbeeda0d5474de40b874fe338383604051808473ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff168152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f16801561027b5780820380516001836020036101000a031916815260200191505b5094505050505060405180910390a15b5050565b7f66117aa64e1c52573f15c5899ca7cb7e6814d52fff19615fcbc3825559ac3f3a338383604051808473ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff168152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f16801561034b5780820380516001836020036101000a031916815260200191505b5094505050505060405180910390a15b505056', 
     gas: 3000000
   }, function(e, contract){
    if (typeof contract.address != 'undefined') {
         console.log(e, contract);
         console.log('Contract mined! address: ' + contract.address + ' transactionHash: ' + contract.transactionHash);
    }
 })*/
    var secret = secretContract.at("0x05e8334962fa10be2593d9e53630578d308d3e03");

    var own_key = null;
    
    var own_account = "";

    var keys = {};
    
    function handler(err) {
        if (err) console.log(err);
    }

    function hexToArray(str) {
        var res = [];
        for (var i = 0; i < str.length; i+=2) {
            res.push(parseInt(str.substr(i,2), 16));
        }
        return res;
    }

    function strToArray(str) {
        var res = [];
        for (var i = 0; i < str.length; i++) {
            res.push(str.charCodeAt(i));
        }
        return res;
    }
    
    exports.getPeers = function () {
        var res = [];
        for (var i in keys) {
            if (!keys.hasOwnProperty(i) || i == web3.eth.defaultAccount) continue;
            res.push(i);
        }
        return res;
    };

    var last_block = {};
    
    function handleKey(msg, block) {
        if ((last_block[msg.addr] || 0) > block) return;
        var str = msg.key.map(x => x > 15 ? x.toString(16) : "0" + x.toString(16)).join("");
        var x = str.substr(0,64);
        var y = str.substr(64);
        var key2 = ec.keyFromPublic({x:x,y:y});
        var shared = own_key.derive(key2.getPublic()).toString(16);
        keys[msg.addr] = shared;
        last_block[msg.addr] = block;
    }

    function handleMessage(msg) {
        console.log("Got some message");
        if (msg.receiver == own_account) {
            console.log("Message for me");
            var shared = keys[msg.sender];
            if (!shared) return;
            var str = msg.secret;
            console.log("The string is " + str);
            var res = CryptoJS.AES.decrypt(str, shared);
            var plain = web3.toAscii(res.toString());
            if (exports.onmessage) exports.onmessage(plain, msg.sender);
            console.log("Plain text: " + plain);
        }
    }

    function handleIMessage(msg) {
        if (msg.receiver == own_account) {
            console.log("Message for me");
            var shared = keys[msg.sender];
            if (!shared) return;
            var hash = msg.hash;
            console.log("The hash is " + hash);
            ipfs.cat(hash, function(err, str) {
                if(err || !str) return console.error(err);
                console.log("The string is " + str);
                var res = CryptoJS.AES.decrypt(str, shared);
                var plain = web3.toAscii(res.toString());
                console.log("Plain text: " + plain);
                if (exports.onmessage) exports.onmessage(plain, msg.sender);
            });
            
        }
    }
    function message(to, str) {
        var shared = keys[to];
        var estr = CryptoJS.AES.encrypt(str, shared);
        console.log("Sending: " + estr.toString());
        secret.message(to, estr.toString(), {gas:3000000}, handler);
    }
    
    function addMessage(to, str) {
        var shared = keys[to];
        var estr = CryptoJS.AES.encrypt(str, shared);
        console.log("Sending: " + estr.toString());
        ipfs.add(new Buffer(estr.toString()), function(err, res) {
            if(err || !res) return console.error(err);
            console.log("The hash is " + res.Hash);
            secret.ipfsMessage(to, res.Hash, handler);
        });
    }
    
    exports.send = message;
    exports.sendIPFS = addMessage;

    // message(web3.eth.coinbase, "Secret message, reaaly secret")

    function register(key) {
        var str = key.getPublic().x.toString(16)+key.getPublic().y.toString(16);
        secret.setKey(hexToArray(str), handler);
    }

    function init(acc) {

        own_account = web3.eth.defaultAccount = acc;

        var event2 = secret.SetKey({}, {fromBlock:0, toBlock:"latest"});

        event2.watch(function(error, result){
            if (!error) {
                console.log(result);
                handleKey(result.args, result.blockNumber);
            }
        });
        
        var event3 = secret.Message(function(error, result){
            if (!error) {
                console.log(result);
                handleMessage(result.args);
            }
        });
        
        var event4 = secret.IPFSMessage(function(error, result){
            if (!error) {
                console.log(result);
                handleIMessage(result.args);
            }
        });
        

        own_key = ec.genKeyPair();
        register(own_key);
    }
    
    exports.init = init;

    return exports;
})();
