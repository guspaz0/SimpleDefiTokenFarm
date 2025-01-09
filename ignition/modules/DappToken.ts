import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Owner = "";

const DappToken = buildModule("DappToken", (m) => {
  
  const proxyAdminOwner = Owner || m.getAccount(0);

  const dappToken = m.contract("DappToken", [proxyAdminOwner]);

  const addrDapp = m.readEventArgument(dappToken, "Deployed", "addr");

  return { 
        dappToken, 
        addrDapp
    };
});

export default DappToken;