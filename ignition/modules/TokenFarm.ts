const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
import DappToken from './DappToken';
import LPToken from './LpToken';

const Owner = ""
const RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e15}

const proxyModule = buildModule("ProxyModule", (m) => {
    const { dappToken, addrDapp } = m.useModule(DappToken);
    const { lpToken, addrLp } = m.useModule(LPToken); 
    
    const proxyAdminOwner = Owner || m.getAccount(0);

    const tokenFarm = m.contract("TokenFarm");

    const encodedFunctionCall = m.encodeFunctionCall(tokenFarm, "initialize", [
        proxyAdminOwner,
        addrDapp,
        addrLp,
        RewardPerBlock[10],
        RewardPerBlock[100],
        RewardPerBlock[1000]]);

    const proxy = m.contract("TransparentUpgradeableProxy", [tokenFarm, proxyAdminOwner, encodedFunctionCall]);

    const proxyAdminAddress = m.readEventArgument(proxy, "AdminChanged", "newAdmin");

    m.call(dappToken, "transferOwnership",[proxy])

    const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

    return { proxyAdmin, proxy, proxyAdminOwner, lpToken, dappToken };
});

/**
 * This is the second module that will be run, and it is also the only module exported from this file.
 * It creates a contract instance for the Demo contract using the proxy from the previous module.
 */
const tokenFarmModule = buildModule("TokenFarmModule", (m) => {
  // Get the proxy and proxy admin from the previous module.
  const { proxyAdmin, proxy, proxyAdminOwner, lpToken, dappToken } = m.useModule(proxyModule);

  // Here we're using m.contractAt(...) a bit differently than we did above.
  // While we're still using it to create a contract instance, we're now telling Hardhat Ignition
  // to treat the contract at the proxy address as an instance of the TokenFarm contract.
  // This allows us to interact with the underlying TokenFarm contract via the proxy from within tests and scripts.
  const tokenFarm = m.contractAt("TokenFarm", proxy);

  // Return the contract instance, along with the original proxy and proxyAdmin contracts
  // so that they can be used by other modules, or in tests and scripts.
  return { proxyAdminOwner, proxy, proxyAdmin, dappToken, lpToken, tokenFarm };
});

export default tokenFarmModule;
