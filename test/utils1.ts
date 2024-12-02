import { MessageData, MessageType, FarcasterNetwork, ReactionType } from '@farcaster/core';


export function getproof(data: any) {
    const signatureBuffer = Buffer.from(data.signature, 'base64');
    
    // 转换签名的字节序
    const r = signatureBuffer.slice(0, 32);
    const s = signatureBuffer.slice(32, 64);  
  
      // 处理 hash 字段
      const processedData = data.data
    
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