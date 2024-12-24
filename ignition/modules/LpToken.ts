import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const LPToken = buildModule("LPToken", (m) => {

  const lpToken = m.contract("LPToken", [Owner]);

  const addrLp = m.readEventArgument(lpToken, "Deployed", "addr");

  return { 
      lpToken, 
      addrLp
  };
});

export default LPToken;