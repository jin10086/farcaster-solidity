import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FarcasterVerify } from '../typechain-types';
import { MessageData, MessageType, FarcasterNetwork } from '@farcaster/core';

import { newcast, likecast, recast, castadd } from './rawdata';



function getproof(data: any) {
  const signatureBuffer = Buffer.from(data.signature, 'base64');

  let message = MessageData.fromJSON(data.data);

  return {
    public_key: data.signer,
    signature_r: "0x"+signatureBuffer.slice(0, 32).toString('hex'),
    signature_s: "0x"+ signatureBuffer.slice(32, 64).toString('hex'),
    message: MessageData.encode(message).finish(),
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

  it('Verify manual real cast', async () => {
    // 原始签名（Base64格式）
    const signatureBase64 = "ASwnupcSGRnER5s9cYDHMpq2RNFUQi+Hol3eGgcHqLH/UtzNL7qHtY6sT8uc/MHKXMSetsERXCUaYABtM65BBw==";
    
    // 将Base64转换为Buffer
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    
    // 分离r和s
    const r = signatureBuffer.slice(0, 32);
    const s = signatureBuffer.slice(32, 64);
    console.log(r.toString('hex'));
    console.log(s.toString('hex'));

    // 使用signer作为public key
    const public_key = "0xeaf4d80bbd2d32701a14be495c9581eff3ed1779972d75119580ef4241b9b2fd";

    // 构造消息数据
    const message_data: MessageData = {
      type: MessageType.CAST_ADD,
      fid: 880794,
      timestamp: 122566244,
      network: FarcasterNetwork.MAINNET,
      castAddBody: {
        embedsDeprecated: [],
        mentions: [],
        text: "How can I get 100x meme",
        mentionsPositions: [],
        embeds: []
      }
    };

    // 编码消息
    const message = MessageData.encode(message_data).finish();
    console.log(message);

    // 验证消息
    const tx = test.verifyCastAddMessage(
      public_key,
      "0x" + r.toString('hex'),
      "0x" + s.toString('hex'),
      message
    );

    await expect(tx)
      .to.emit(test, 'MessageCastAddVerified')
      .withArgs(
        message_data.fid,
        message_data.castAddBody?.text,
        message_data.castAddBody?.mentions
      );
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
    // console.log("raw message:::",data.rawmessage)
    const tx = test.verifyReactionAddMessage(
        data.public_key,
        data.signature_r,
        data.signature_s,
        data.message
      );
  
      await expect(tx)
        .to.emit(test, 'MessageReactionAddVerified')
        // .withArgs(
        //     data.rawmessage.fid,
        //     data.rawmessage.
        //     data.rawmessage.castAddBody?.mentions
        // );
    
  })


  it('Verify auto castadd', async () => {

    let data = castaddproof
    // console.log("raw message:::",data.rawmessage)
    const tx = test.verifyCastAddMessage(
      data.public_key,
      data.signature_r,
      data.signature_s,
      data.message
      );
  
      await expect(tx)
        .to.emit(test, 'MessageCastAddVerified')
        // .withArgs(
        //     data.rawmessage.fid,
        //     data.rawmessage.
        //     data.rawmessage.castAddBody?.mentions
        // );
    
  })
});
