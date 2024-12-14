import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("GOGOGO", (m) => {
  
    const blake3 = m.library("Blake3");
    const ed25519_pow = m.library("Ed25519_pow");
    const sha512 = m.library("Sha512");

    const ed25519 = m.contract("Ed25519", [], {
        libraries: {
            Ed25519_pow: ed25519_pow,
            Sha512: sha512,
        },
      });
    
      const farcasterVerify = m.contract("FarcasterVerify", [], {
        libraries: {
            Blake3: blake3,
            Ed25519: ed25519,
        },
      });
      const taskReward = m.contract("TaskReward",[farcasterVerify])


    //   m.call(taskReward, "setFee", [100]);
    
      
    

  return { taskReward };
});