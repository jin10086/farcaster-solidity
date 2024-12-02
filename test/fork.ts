import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TaskReward, FarcasterVerify, MockERC20 } from '../typechain-types';
import {time as helperstime} from "@nomicfoundation/hardhat-network-helpers";
const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Import your test data and utils
import { newcast, likecast, recast, castadd } from './rawdata';
import { getproof } from './utils1';


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
        const addressScore100000 = "0x706f927c52f12241e3fb790f6db4a5b4a9a47461"

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
});