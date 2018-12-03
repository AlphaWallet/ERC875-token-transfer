$(() => {

    let Web3 = require("web3");
    let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    let abi = require('./abi').abi;
    let shortAbi = require('./abi').shortABI;
    let etherscanTxApi = "";
    let request = require("superagent");

    if (typeof window.web3 !== 'undefined')
    {
        web3 = new Web3(window.web3.currentProvider);
        console.log("injected provider used");
        web3.eth.defaultAccount = web3.eth.coinbase;
        try
        {
            window.web3.currentProvider.enable();
        }
        catch(e)
        {
            //do nothing, just don't halt the program
            console.log("backward incompatible web3 with privacy mode + " + e);
        }
    }
    else
    {
        alert("no injected provider found, using localhost:8545, please ensure your local node is running " +
            "and rpc and rpccorsdomain is enabled");
    }

    function redirectToEtherscan(address)
    {
        web3.version.getNetwork((err, networkId) => {
            if (networkId == 3) window.location.href = "https://ropsten.etherscan.io/address/" + address;
            else if (networkId == 4) window.location.href = "https://rinkeby.etherscan.io/address/" + address;
            else if (networkId == 42) window.location.href = "https://kovan.etherscan.io/address/" + address;
            else window.location.href = "https://etherscan.io/address/" + address;
        });
    }

    $("#start").click(() => {
       getContractsOfUser(web3.eth.coinbase, (contracts) => {
           for(contract of contracts)
           {

           }
       });
    });

    function getContractsOfUser(userAddress, cb)
    {
        let contracts = [];
        //get all the contracts from transaction list of user
        request.get(etherscanTxApi + "/" + userAddress, (err, transactions) => {
            if(err) throw err;
            for (tx of transactions)
            {
                if(tx.input != "0x")
                {
                    for(contract of contracts)
                    {
                        if(contract.address == tx.address)
                        {
                            break;
                        }
                    }
                    contracts.push(web3.eth.contract(shortAbi).at(tx.address));
                }
            }
            cb(contracts);
        });
    }

    function getTokensFromContract(contract, addressOfUser, cb)
    {
        contract.balanceOf(addressOfUser, (err, data) => {
           cb(err, data);
        });
    }

    function getIsERC875(contract, cb)
    {
        contract.isStormbird((err, data) => {
            if(err) cb(false);
            else cb(data);
        })
    }

    function transfer(contract, to, tokens)
    {
        contract.transfer(to, tokens, (err, data) =>
        {
            alert(err, data);
        });
    }

});