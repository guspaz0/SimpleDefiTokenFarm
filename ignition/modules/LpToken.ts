import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Owner = "";

const LPToken = buildModule("LPToken", (m) => {

  const proxyAdminOwner = Owner || m.getAccount(0);

  const lpToken = m.contract("LPToken", [proxyAdminOwner]);

  const addrLp = m.readEventArgument(lpToken, "Deployed", "addr");

  return { 
      lpToken, 
      addrLp
  };
});

export default LPToken;