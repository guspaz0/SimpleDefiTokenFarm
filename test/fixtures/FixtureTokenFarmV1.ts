import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import TokenFarmArtifact from '../../artifacts/contracts/TokenFarm.sol/TokenFarm.json';
import TUProxyArtifact from "../../artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json";
import ProxyAdminArtifact from "../../artifacts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json";
import deployLpTokenFixture from './FixtureLpToken';
import deployDappTokenFixture from './FixtureDappToken';
import { web3 } from 'hardhat';

const RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e15}


export default async function deployTokenFarmV1Fixture() {
    const { DappToken } = await loadFixture(deployDappTokenFixture);
    const { LpToken } = await loadFixture(deployLpTokenFixture);

    const [deployer, otherAccount] = await web3.eth.getAccounts();

    const TokenFarmContract = new web3.eth.Contract(TokenFarmArtifact.abi);
    TokenFarmContract.handleRevert = true;

    const rawContract = TokenFarmContract.deploy({
        data: TokenFarmArtifact.bytecode,
        arguments: []
    });
    const estimateGas = await rawContract.estimateGas({from: deployer});
    const TokenFarm = await rawContract.send({
        from: deployer,
        gas: estimateGas.toString(),
        gasPrice: '10000000000'
    });

    const encodeFunctionInitialize = web3.eth.abi.encodeFunctionCall(
        TokenFarmArtifact.abi.find(e => e.name == "initialize"),
        [
            deployer,
            DappToken.options.address,
            LpToken.options.address,
            RewardPerBlock[10],
            RewardPerBlock[100],
            RewardPerBlock[1000] 
    ]);

    const ProxyContract = new web3.eth.Contract(TUProxyArtifact.abi)
    ProxyContract.handleRevert = true;

    const rawProxy = ProxyContract.deploy({
        data: TUProxyArtifact.bytecode,
        arguments: [
            TokenFarm.options.address,
            deployer,
            encodeFunctionInitialize
        ]
    })

    const estimateGasProxy = await rawProxy.estimateGas({from: deployer});
    const Proxy = await rawProxy.send({
        from: deployer,
        gas: estimateGasProxy.toString(),
        gasPrice: '10000000000'
    });

    const Events = await Proxy.getPastEvents("AdminChanged", 
        {
            filter: {
                //src: [Proxy.options.address] // se puede filtrar por propiedad "src" address o "dst" address
            }, 
            fromBlock: 1n,
            toBlock: "latest",
        }
    );

    const ProxyAdminAddress = Events[0].returnValues.newAdmin

    const ProxyAdmin = new web3.eth.Contract(ProxyAdminArtifact.abi, ProxyAdminAddress);

    Proxy.options.jsonInterface = TokenFarmArtifact.abi

    return { TokenFarm, deployer, TokenFarmContract, DappToken, LpToken, otherAccount, ProxyAdmin, Proxy };
}