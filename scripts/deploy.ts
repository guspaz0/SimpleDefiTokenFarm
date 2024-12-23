import { web3 } from 'hardhat';
import TokenFarm from '../artifacts/contracts/TokenFarm.sol/TokenFarm.json';
import DappToken from '../artifacts/contracts/DappToken.sol/DappToken.json';
import LPtoken from '../artifacts/contracts/LPtoken.sol/LPtoken.json';

async function main() {
     
    const [deployer] = await web3.eth.getAccounts();

    console.log("owner: "+deployer+'\n')

    const DappTokenContract = new web3.eth.Contract(DappToken.abi);
    DappTokenContract.handleRevert = true;

    const LPtokenContract = new web3.eth.Contract(LPtoken.abi);
    LPtokenContract.handleRevert = true;

    const DappTokenDeploy = DappTokenContract.deploy({
        data: DappToken.bytecode,
        arguments:[deployer]
    })

    const DappGas = await DappTokenDeploy.estimateGas({from: deployer});
	console.log('DappToken estimated gas: ', DappGas);

    const DappTx = await DappTokenDeploy.send({
        from: deployer,
        gas: String(DappGas),
        gasPrice: '10000000000',
    });

    console.log("DappToken contract address: " + DappTx.options.address + '\n')

    const LPTokenDeploy = LPtokenContract.deploy({
        data: LPtoken.bytecode,
        arguments:[deployer]
    })

    const LPgas = await DappTokenDeploy.estimateGas({from: deployer});
    console.log("LPToken estemated gas: "+LPgas)

    const LPTokenTx = await LPTokenDeploy.send({
        from: deployer,
        gas: String(LPgas),
        gasPrice: '10000000000',
    })
    console.log("LPToken contract address: " + LPTokenTx.options.address + '\n')

    let RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e18}
	const fee = 3;

	const TFarmContract = new web3.eth.Contract(TokenFarm.abi);
    TFarmContract.handleRevert = true;

	const rawContract = TFarmContract.deploy({
		data: TokenFarm.bytecode,
		arguments: [ 
            DappTx.options.address, 
            LPTokenTx.options.address,
            fee,
            RewardPerBlock[10],
            RewardPerBlock[100],
            RewardPerBlock[1000]
        ],
	});

    
    const TFarmInit = (await rawContract.send({from: deployer }))
    console.log("TokenFarm contract address: "+TFarmInit.options.address+'\n')

    await DappTx.methods.transferOwnership(TFarmInit.options.address).send({from: deployer})

    console.log('Ownership of DappToken transfered to: '+TFarmInit.options.address+'(TokenFarm)\n')

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(()=> process.exit())
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });