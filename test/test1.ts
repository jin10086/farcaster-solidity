import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FarcasterVerify } from '../typechain-types';
import { MessageData, MessageType, FarcasterNetwork, ReactionType } from '@farcaster/core';

import { newcast, likecast, recast, castadd } from './rawdata';



function getproof(data: any) {
  const signatureBuffer = Buffer.from(data.signature, 'base64');
  
  // 转换签名的字节序
  const r = signatureBuffer.slice(0, 32);
  const s = signatureBuffer.slice(32, 64);  

    // 处理 hash 字段
    const processedData = {
      ...data.data,
      network: FarcasterNetwork.MAINNET // 确保使用正确的枚举值
    };
  
    if (processedData.type === "MESSAGE_TYPE_CAST_ADD" && processedData.castAddBody?.parentCastId) {
      processedData.castAddBody.parentCastId.hash = Buffer.from(processedData.castAddBody.parentCastId.hash.slice(2), 'hex');
    } else if (processedData.type === "MESSAGE_TYPE_REACTION_ADD") {
      processedData.reactionBody.targetCastId.hash = Buffer.from(processedData.reactionBody.targetCastId.hash.slice(2), 'hex');
      // 转换 reaction type 为枚举值
      // processedData.reactionBody.type = processedData.reactionBody.type === "REACTION_TYPE_LIKE" ? ReactionType.LIKE : ReactionType.RECAST;
    }

  // 构造消息数据
  const message = MessageData.fromJSON(processedData);
  const messageBytes = MessageData.encode(message).finish();


  return {
    public_key: data.signer,
    signature_r: "0x" + r.toString('hex'),
    signature_s: "0x" + s.toString('hex'),
    message: messageBytes,
    rawmessage: message
  };
}

let newcastproof = getproof(newcast);
let likecastproof = getproof(likecast);
let recastproof = getproof(recast);
let castaddproof = getproof(castadd);



describe('Test real message', async () => {
  let test:FarcasterVerify

  it('Deploy', async () => {
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
    test = await FarcasterVerify.deploy();
  });


  it('Verify auto real cast', async () => {

    let data = newcastproof
    const tx = test.verifyCastAddMessage(
      data.public_key,
      data.signature_r,
      data.signature_s,
      data.message
      );
  
      await expect(tx)
        .to.emit(test, 'MessageCastAddVerified')
        .withArgs(
          data.rawmessage.fid,
          data.rawmessage.castAddBody?.text,
          data.rawmessage.castAddBody?.mentions
        );
    
  })
  it('Verify auto recast', async () => {

    let data = recastproof
    
      const tx = await test.verifyReactionAddMessage(
          data.public_key,
          data.signature_r,
          data.signature_s,
          data.message
      );
      await expect(tx)
        .to.emit(test, 'MessageReactionAddVerified')
        .withArgs(
          data.rawmessage.fid,
          data.rawmessage.reactionBody?.type,
          data.rawmessage.reactionBody?.targetCastId?.fid,
          data.rawmessage.reactionBody?.targetCastId?.hash
        );
      
    
  })

  it('Verify auto castadd', async () => {

    let data = castaddproof
    
      const tx = await test.verifyCastAddMessage(
        data.public_key,
        data.signature_r,
        data.signature_s,
        data.message
      );
      await expect(tx)
        .to.emit(test, 'MessageCastAddVerified')
        .withArgs(
          data.rawmessage.fid,
          data.rawmessage.castAddBody?.text,
          data.rawmessage.castAddBody?.mentions
        );
  })

  it('Verify auto Like', async () => {

    let data = likecastproof
   
      const tx = await test.verifyReactionAddMessage(  // Like 是 reaction 类型
        data.public_key,
        data.signature_r,
        data.signature_s,
        data.message
      );
      await expect(tx)
        .to.emit(test, 'MessageReactionAddVerified')
        .withArgs(
          data.rawmessage.fid,
          data.rawmessage.reactionBody?.type,
          data.rawmessage.reactionBody?.targetCastId?.fid,
          data.rawmessage.reactionBody?.targetCastId?.hash
        );
  })
});
