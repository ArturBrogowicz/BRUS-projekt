import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24", // Wersja kompilatora (musi być zgodna z wpisem pragma w Twoich plikach .sol)
};

export default config;