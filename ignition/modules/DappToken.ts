import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const DappToken = buildModule("DappToken", (m) => {

  const dappToken = m.contract("DappToken", [Owner]);

  const addrDapp = m.readEventArgument(dappToken, "Deployed", "addr");


  return { 
        dappToken, 
        addrDapp
    };
});

export default DappToken;