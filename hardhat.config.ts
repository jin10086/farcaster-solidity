import { HardhatUserConfig,vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";
import "@nomicfoundation/hardhat-ignition-ethers";

const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY");
const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");




const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        }
      }
    ]
  },
  gasReporter: {
    enabled: false,
  },
  etherscan: {
    apiKey: "ARA9DAMQ1KXI3GD7YYR6SDFSIE8SEVBK74",
  },
  networks: {
    basesepolia: {
      url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
    base: {
      url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: "https://base-mainnet.g.alchemy.com/v2/v420WMGsNrqKkj7688s8mGviNhR-xQ8S",
      //   blockNumber: 23216000
      // }, 
      mining: {
        auto: true,
        interval: 2000
      }
    }
  },
  abiExporter: {
    path: './abi',
    runOnCompile: true,
    clear: true,
    flat: true,  
  }
};

export default config;
