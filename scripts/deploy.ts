import { ethers } from 'hardhat';
import { TaskReward, FarcasterVerify, MockERC20 } from '../typechain-types';
async function main() {
  // Deploy mock ERC20 token
  const MockERC20 = await ethers.getContractFactory('MockERC20');
  const mockToken = await MockERC20.deploy();

  console.log("mockToken:::", mockToken.target);

  // Deploy FarcasterVerify and its dependencies (similar to test1.ts)
  const Blake3 = await ethers.getContractFactory('Blake3');
  const blake3 = await Blake3.deploy();

  const Ed25519_pow = await ethers.getContractFactory('Ed25519_pow');
  const ed25519_pow = await Ed25519_pow.deploy();

  const Sha512 = await ethers.getContractFactory('Sha512');
  const sha512 = await Sha512.deploy();

  const Ed25519 = await ethers.getContractFactory('Ed25519', {
      libraries: {
          Ed25519_pow: ed25519_pow.target,
          Sha512: sha512.target,
      }
  });
  const ed25519 = await Ed25519.deploy();

  const FarcasterVerify = await ethers.getContractFactory('FarcasterVerify', {
      libraries: {
          Blake3: blake3.target,
          Ed25519: ed25519.target,
      }
  });
  const farcasterVerify = await FarcasterVerify.deploy();

  // Deploy TaskReward
  const TaskReward = await ethers.getContractFactory('TaskReward');
  const taskReward = await TaskReward.deploy(farcasterVerify.target);

  console.log("taskReward:::", taskReward.target);

  let myaddress = '0x9e8065Beaf8D02D818C4598bF02C35828fD61aa3';
  await mockToken.transfer(myaddress, ethers.parseEther("1000000.0"));

  //send eth to myaddress
  await ethers.provider.send("hardhat_setBalance", [
    myaddress,
    "0x1000000000000000000000000000000000000000000000",
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });