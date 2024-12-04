import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TaskReward, FarcasterVerify, MockERC20 } from '../typechain-types';
import {time as helperstime} from "@nomicfoundation/hardhat-network-helpers";
const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Import your test data and utils
import { newcast, likecast, recast, castadd ,castaddinChannel,castnewinChannel,castlikeinChannel} from './rawdata';
import { getproof } from './utils1';

const BASETIME = 1609459200;
describe("TaskReward contract", function () {
    async function deployTokenFixture() {
        let taskReward: TaskReward;
        let farcasterVerify: FarcasterVerify;
        let mockToken: MockERC20;
        let owner: any;
        let user1: any;
        let user2: any;
        const zerotargetHash = "0x0000000000000000000000000000000000000000";  // 正好20字节（40个十六进制字符）
        const oneDay = 24 * 60 * 60;
        const oneETH = ethers.parseEther("1.0");
        [owner, user1, user2] = await ethers.getSigners();
        const addressScore100000 = "0x706f927C52f12241E3fb790F6db4A5B4a9A47461"

        // Deploy mock ERC20 token
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        mockToken = await MockERC20.deploy();

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
        farcasterVerify = await FarcasterVerify.deploy();

        // Deploy TaskReward
        const TaskReward = await ethers.getContractFactory('TaskReward');
        taskReward = await TaskReward.deploy(farcasterVerify.target);

        const addressScore0 = user1.address;


        // Mint tokens to owner for testing
        await mockToken.approve(taskReward.target, ethers.parseEther("1000000.0"));
        return { taskReward,mockToken,owner, user1, user2 ,zerotargetHash,oneDay,oneETH,addressScore100000,addressScore0};
    }
  
    it("check fork blocknumber", async function () {
      const { taskReward, owner,mockToken } = await loadFixture(deployTokenFixture);
  
      let blockNumber = await ethers.provider.getBlockNumber();
      console.log("blockNumber",blockNumber);
    });

    it("should revert with NotEnoughScore when user score is too low", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay } = await loadFixture(deployTokenFixture);
        
        const starttime = await helperstime.latest();
        const endtime = starttime + oneDay;
        let taskId = await taskReward.taskIdCounter()
        let recastProof = getproof(recast);
        let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
        if (!targetHash_) {
            throw new Error('Target hash is undefined');
        }
        //Uint8Array to bytes20
        let targetHash = ethers.hexlify(targetHash_);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            0, // TaskType.RECAST
            ethers.parseEther("100.0"),
            mockToken.target,
            starttime,
            endtime,
            10, // maxParticipants
            targetHash,
            [], // requiredWords
            0, // minLength
            1000000 // Very high score requirement
        )).to.not.be.reverted;

        await helperstime.increaseTo(endtime + 1);

        // Try to complete task with insufficient score
        await expect(taskReward.submitProof(
            taskId, // taskId
            addressScore0,
            {
                public_key: recastProof.public_key,
                signature_r: recastProof.signature_r,
                signature_s: recastProof.signature_s,
                message: recastProof.message
            }
        )).to.be.revertedWithCustomError(taskReward, "NotEnoughScore");
    });

    it("should revert with NotFoundFID ", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay } = await loadFixture(deployTokenFixture);
        
        const starttime = await helperstime.latest();
        const endtime = starttime + oneDay;
        let taskId = await taskReward.taskIdCounter()
        let recastProof = getproof(recast);
        let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
        if (!targetHash_) {
            throw new Error('Target hash is undefined');
        }
        //Uint8Array to bytes20
        let targetHash = ethers.hexlify(targetHash_);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            0, // TaskType.RECAST
            ethers.parseEther("100.0"),
            mockToken.target,
            starttime,
            endtime,
            10, // maxParticipants
            targetHash,
            [], // requiredWords
            0, // minLength
            0 // Very high score requirement
        )).to.not.be.reverted;

        await helperstime.increaseTo(endtime + 1);

        // Try to complete task with insufficient score
        await expect(taskReward.submitProof(
            taskId, // taskId
            addressScore0,
            {
                public_key: recastProof.public_key,
                signature_r: recastProof.signature_r,
                signature_s: recastProof.signature_s,
                message: recastProof.message
            }
        )).to.be.revertedWithCustomError(taskReward, "NotFoundFID");
    });

    it("should revert with AddressDontMatchFid ", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay } = await loadFixture(deployTokenFixture);
        
        const starttime = await helperstime.latest();
        const endtime = starttime + oneDay;
        let taskId = await taskReward.taskIdCounter()
        let recastProof = getproof(recast);
        let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
        if (!targetHash_) {
            throw new Error('Target hash is undefined');
        }
        //Uint8Array to bytes20
        let targetHash = ethers.hexlify(targetHash_);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            0, // TaskType.RECAST
            ethers.parseEther("100.0"),
            mockToken.target,
            starttime,
            endtime,
            10, // maxParticipants
            targetHash,
            [], // requiredWords
            0, // minLength
            1000000 // Very high score requirement
        )).to.not.be.reverted;

        await helperstime.increaseTo(endtime + 1);

        // Try to complete task with insufficient score
        await expect(taskReward.submitProof(
            taskId, // taskId
            addressScore100000,
            {
                public_key: recastProof.public_key,
                signature_r: recastProof.signature_r,
                signature_s: recastProof.signature_s,
                message: recastProof.message
            }
        )).to.be.revertedWithCustomError(taskReward, "AddressDontMatchFid");
    });

    function getcasthash(rawmessage:any){
        let targetHash_;
        if (rawmessage.castAddBody.parentUrl) {
             targetHash_ = rawmessage.castAddBody?.embeds[0]?.castId?.hash;
            
        }else{
             targetHash_ = rawmessage.castAddBody?.parentCastId?.hash;
        }
        if (!targetHash_) {
            throw new Error('Target hash is undefined');
        }
        return ethers.hexlify(targetHash_);

    }
    //帖子的时间早于 任务发布时间
    it("should revert with InvaildMessageTime and posttime before starttime ", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay } = await loadFixture(deployTokenFixture);
        
        
        let taskId = await taskReward.taskIdCounter()
        let castaddpoorf = getproof(castaddinChannel);
        let posttime = castaddinChannel.data.timestamp+BASETIME;

        const starttime = posttime + 1000; //在帖子发布之后开始
        const endtime = await helperstime.latest() + oneDay;

       
        //Uint8Array to bytes20
        let targetHash = getcasthash(castaddpoorf.rawmessage);
        console.log("task0 targetHash:::", targetHash);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            1, // TaskType.REPLY
            ethers.parseEther("100.0"),
            mockToken.target,
            starttime,
            endtime,
            10, // maxParticipants
            targetHash,
            [], // requiredWords
            0, // minLength
            1000000 // Very high score requirement
        )).to.not.be.reverted;

        await helperstime.increaseTo(endtime + 1);

        // Try to complete task with insufficient score
        await expect(taskReward.submitProof(
            taskId, // taskId
            addressScore100000,
            {
                public_key: castaddpoorf.public_key,
                signature_r: castaddpoorf.signature_r,
                signature_s: castaddpoorf.signature_s,
                message: castaddpoorf.message
            }
        )).to.be.revertedWithCustomError(taskReward, "InvaildMessageTime");
    });

    //帖子的时间晚于 任务结束时间
    it("should revert with InvaildMessageTime and posttime after endtime ", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay } = await loadFixture(deployTokenFixture);
        
        
        let taskId = await taskReward.taskIdCounter()
        let castaddpoorf = getproof(castaddinChannel);
        let posttime = castaddinChannel.data.timestamp+BASETIME;

        const starttime = posttime - 1000; 
        const endtime = posttime -10;   

       
        //Uint8Array to bytes20
        let targetHash = getcasthash(castaddpoorf.rawmessage);
        console.log("task0 targetHash:::", targetHash);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            1, // TaskType.REPLY
            ethers.parseEther("100.0"),
            mockToken.target,
            starttime,
            endtime,
            10, // maxParticipants
            targetHash,
            [], // requiredWords
            0, // minLength
            1000000 // Very high score requirement
        )).to.not.be.reverted;
        // Try to complete task with insufficient score
        await expect(taskReward.submitProof(
            taskId, // taskId
            addressScore100000,
            {
                public_key: castaddpoorf.public_key,
                signature_r: castaddpoorf.signature_r,
                signature_s: castaddpoorf.signature_s,
                message: castaddpoorf.message
            }
        )).to.be.revertedWithCustomError(taskReward, "InvaildMessageTime");
    });


    it("should verify and reward castadd proof", async function () {
        const { taskReward, mockToken, addressScore100000, addressScore0,oneDay, owner } = await loadFixture(deployTokenFixture);
        
        
        let taskId = await taskReward.taskIdCounter()
        let castaddpoorf = getproof(castaddinChannel);
        let posttime = castaddinChannel.data.timestamp+BASETIME;

        const starttime = posttime - 1000; 
        const endtime = posttime + oneDay;   

        let reward = ethers.parseEther("100.0");
        let maxParticipants = 10;

       
        //Uint8Array to bytes20
        let targetHash = getcasthash(castaddpoorf.rawmessage);
                
        // Create a task with high score requirement
        await expect(taskReward.createTask(
            1, // TaskType.REPLY
            reward,
            mockToken.target,
            starttime,
            endtime,
            maxParticipants,
            targetHash,
            [], // requiredWords
            0, // minLength
            1000000 // Very high score requirement
        )).to.not.be.reverted;
        // Try to complete task with insufficient score

        let tx = await taskReward.submitProof(
            taskId, // taskId
            addressScore100000,
            {
                public_key: castaddpoorf.public_key,
                signature_r: castaddpoorf.signature_r,
                signature_s: castaddpoorf.signature_s,
                message: castaddpoorf.message
            }
        )
        let fee = await taskReward.fee();
        let toUser;
        let toDev;
        let perUserAmount = reward / BigInt(maxParticipants)
        if (fee>0){
            toUser =  perUserAmount * (10000n -fee)/10000n;
            toDev = perUserAmount  * fee/10000n;
        }
        console.log("toUser:::", toUser);
        console.log("toDev:::", toDev);

        await expect(tx)
        .to.emit(taskReward, 'RewardPaid')
        .withArgs(taskId, addressScore100000, toUser, mockToken.target);

        await expect(tx)
        .to.changeTokenBalances(mockToken,[taskReward.target,addressScore100000,owner],[-ethers.parseEther("10.0"),toUser,toDev])
        
    });


});