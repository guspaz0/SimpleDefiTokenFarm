import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { web3 } from 'hardhat';
import TokenFarmV2Artifact from '../artifacts/contracts/TokenFarmV2.sol/TokenFarmV2.json';
import deployTokenFarmV1Fixture from './FixtureTokenFarmV1.test'

const fee = 3;

export default async function deployTokenFarmV2Fixture(){
    try {
        const {	TokenFarm, deployer, DappToken, LpToken, Proxy, ProxyAdmin } = await loadFixture(deployTokenFarmV1Fixture);

        const TokenFarmV2Contract = new web3.eth.Contract(TokenFarmV2Artifact.abi);
        TokenFarmV2Contract.handleRevert = true;
    
        const rawContract = TokenFarmV2Contract.deploy({
            data: TokenFarmV2Artifact.bytecode,
            arguments: []
        });
        const estimateGas = await rawContract.estimateGas({from: deployer});
        const TokenFarmV2 = await rawContract.send({
            from: deployer,
            gas: estimateGas.toString(),
            gasPrice: '10000000000'
        });
    
        const encodeFunctionCall = web3.eth.abi.encodeFunctionCall(
            TokenFarmV2Artifact.abi.find(e => e.name == "setFee"), [fee]);
    
        Proxy.options.jsonInterface = TokenFarmV2Artifact.abi

        await ProxyAdmin.methods.upgradeAndCall(
            Proxy.options.address, 
            TokenFarmV2.options.address, 
            encodeFunctionCall
        ).send({from: deployer});

        
        return  { TokenFarm, deployer, DappToken, LpToken, Proxy, ProxyAdmin, TokenFarmV2 }
    } catch (e) {
        console.log("----------Inicio error Fixture V2: ---------------")
        console.log(e)
        console.log("----------Fin error Fixture V2: ---------------")
    }
    
}