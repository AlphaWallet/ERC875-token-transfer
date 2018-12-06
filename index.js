let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let abi = require("./abi").abi;
let etherscanTxApiRoute = "api?module=account&action=txlist&startblock=0&endblock=99999999&sort=asc&address=";
let request = require("superagent");

$(() =>
{

    let gAllContractsTokens = {};
    //for each contract, there is an array of tokens and indices
    gAllContractsTokens.contracts = [];

    if (typeof window.web3 !== "undefined")
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
            //do nothing, just don"t halt the program
            console.log("backward incompatible web3 with privacy mode + " + e);
        }
        $("#warning").text("Loading your contracts!");
        init();
    }
    else
    {
        alert("no injected provider found, using localhost:8545, please ensure your local node is running " +
            "and rpc and rpccorsdomain is enabled");
        init();
    }

    function getEtherscanLink(cb)
    {
        web3.version.getNetwork((err, networkId) =>
        {
            if (networkId == 3) cb("https://ropsten.etherscan.io/");
            else if (networkId == 4) cb("https://rinkeby.etherscan.io/");
            else if (networkId == 42) cb("https://kovan.etherscan.io/");
            else cb("https://api.etherscan.io/");
        });
    }

    function init()
    {
        getContractsOfUser(web3.eth.coinbase, (contracts) =>
        {
            if(contracts.length == 0)
            {
                alert("No ERC875 tokens found");
                return;
            }
            for(let contract of contracts)
            {
                display875Contracts(contract);
            }
        });
    }

    function display875Contracts(contract)
    {
        //first check if it is actually 875
        getIsERC875(contract, (err, is875) =>
        {
            if(err) return;
            //contract div
            if(is875)
            {
                gAllContractsTokens.contracts.push(contract);
                getTokensFromContract(contract, web3.eth.coinbase, (tokenObj) =>
                {
                    if(tokenObj.tokens.length > 0)
                    {
                        createContractDiv(contract.address);
                        tokenObj.tokens = tokenObj.tokens.map((token) => {
                            return "0x" + token.toString(16);
                        });
                        spawnElementsWithTokens(tokenObj, contract.address);
                    }
                });
            }
        });
    }

    function createContractDiv(contractAddress)
    {
        $("<br>");
        $("<div>", { id: contractAddress }).appendTo("#contractObjects");
        $("<h5>").appendTo("#" + contractAddress).text("Contract: " + contractAddress);
        $("<h5>").appendTo("#" + contractAddress).text("Tokens of this contract");
        $("<br>");
    }

    function spawnElementsWithTokens(tokenObj, contractAddress)
    {
        let contractParentId = "#" + contractAddress;
        let tokensForContract = bundleTokens(contractAddress, tokenObj);
        for(let tokenBundle of tokensForContract.tokens)
        {
            $("<label>", { id: "tokenBundle" }).appendTo(contractParentId).text(tokenBundle.token);
            $("<label>").appendTo(contractParentId).text(" ");
            $("<br>");
            $("<select>", { id: "select" + contractAddress }).appendTo(contractParentId);
            $("<input>", {id: "to" + contractAddress, placeholder: "Send to" }).appendTo(contractParentId);
            $("<button>", { id:"button" + contractAddress, type: "button" }).appendTo(contractParentId).text("Transfer");

            for(let i = 1; i < tokenBundle.amount; i++)
            {
                //allow the user to choose how much of each unique token they want to transfer
                $("<option>", { value: i, id: contractAddress }).appendTo(
                    "#select" + contractAddress
                ).text(i);
            }
        }
        //TODO clean up
        initButtonClickHandler();
    }

    function bundleTokens(contractAddress, tokenObj)
    {
        let tokensForContract = {};
        tokensForContract.address = contractAddress;
        tokensForContract.tokens = [];
        for(let token of tokenObj.tokens)
        {
            let tokenBundle = groupTokenByNumberOfOccurrences(token, tokenObj.tokens);
            tokensForContract.tokens.push(tokenBundle);
        }
        //remove all duplicates
        tokensForContract.tokens = tokensForContract.tokens.filter((thing, index, self) =>
        self.findIndex(t => t.place === thing.place && t.name === thing.name) === index);
        return tokensForContract;
    }

    function groupTokenByNumberOfOccurrences(token, tokens)
    {
        let numberOfOccurrences = 0;
        for(let i = 0; i < tokens.length; i++)
        {
            if(token == tokens[i])
            {
                numberOfOccurrences++;
            }
        }
        return { token: token, amount: numberOfOccurrences }
    }

    function getContractsOfUser(userAddress, cb)
    {
        //get all the contracts from transaction list of user
        getEtherscanLink((link) => {
            request.get(link + etherscanTxApiRoute + userAddress, (err, data) =>
            {
                if(err) throw err;
                let transactions = data.body.result;
                let contracts = extractContractsFromEtherscan(transactions);
                cb(contracts);
            });
        });
    }

    function extractContractsFromEtherscan(transactions)
    {
        let contractAddresses = [];
        let contractObjects = [];
        for (let tx of transactions)
        {
            if(tx.input != "")
            {
                //push instantiated web3 contract instance
                if(!contractAddresses.includes(tx.to))
                {
                    contractAddresses.push(tx.to);
                }
            }
        }
        for(let address of contractAddresses)
        {
            contractObjects.push(web3.eth.contract(abi).at(address));
        }
        return contractObjects;
    }

    function getTokensFromContract(contract, addressOfUser, cb)
    {
        let tokenObject = {};
        tokenObject.tokens = [];
        contract.balanceOf(addressOfUser, (err, arrayOfTokens) =>
        {
            if(err)
            {
                cb(err);
                return;
            }
            let indices = [];
            let indicesWithTokens = [];
            for(let i = 0; i < arrayOfTokens.length; i++)
            {
                indices.push(i);
                if(arrayOfTokens[i] != 0)
                {
                    tokenObject.tokens.push(arrayOfTokens[i]);
                    indicesWithTokens.push(i);
                }
            }
            tokenObject.indices = indices;
            tokenObject.indicesWithTokens = indicesWithTokens;
            cb(tokenObject);
        });
    }

    function getIsERC875(contract, cb)
    {
        contract.isStormBirdContract((err, data) =>
        {
            if(err) cb(err, false);
            else cb(null, data);
        });
    }

    function getContractFromClick(targetElement)
    {
        for (let contract of gAllContractsTokens.contracts)
        {
            if(targetElement.includes(contract.address))
            {
                return contract;
            }
        }
    }

    //TODO refactor this code
    function initButtonClickHandler()
    {
        $("#warning").text("Loaded your ERC875 contracts");
        //maps to any transfer button call
        $(":button").click((e) =>
        {
            let targetElement = e.target.id;
            if(targetElement.includes("0x"))
            {
                let contractToExecute = getContractFromClick(targetElement);
                let quantity = $("#select" + contractToExecute.address).val();
                let to = $("#to" + contractToExecute.address).val();
                getIndicesFromContractBalance(web3.eth.coinbase, contractToExecute, quantity, (result) =>
                {
                    if (result !== false)
                    {
                        console.log("Result: " + result)
                        transfer(contractToExecute, to, result);
                    }
                    else
                    {
                        console.log("adfdsfgds: " + result)
                        $("#warning").text("Failed to make transfer");
                    }
                });
            }
        });
    }

    function getIndicesFromContractBalance(userAddress, contract, quantity, cb)
    {
        getTokensFromContract(contract, userAddress, (data) =>
        {
            let indicesWithTokens = data.indicesWithTokens;
            if(indicesWithTokens.length < quantity)
            {
                cb(false);
                return;
            }
            let indices = [];
            for(let i = 0; i < quantity; i++)
            {
                indices.push(indicesWithTokens[i]);
            }
            cb(indices);
        });
    }

    function transfer(contract, to, tokenIndices)
    {
        contract.transfer(to, tokenIndices, (err, data) =>
        {
            if(err) $("#warning").text(err);
            else $("#warning").text(data);
        });
    }

});