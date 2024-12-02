import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TaskReward, FarcasterVerify, MockERC20 } from '../typechain-types';

// Import your test data and utils
import { newcast, likecast, recast, castadd } from './rawdata';
import { getproof } from './utils1';

describe('TaskReward Contract', async () => {
    let taskReward: TaskReward;
    let farcasterVerify: FarcasterVerify;
    let mockToken: MockERC20;
    let owner: any;
    let user1: any;
    let user2: any;
    const zerotargetHash = "0x0000000000000000000000000000000000000000";  // 正好20字节（40个十六进制字符）

    const oneDay = 24 * 60 * 60;
    const oneETH = ethers.parseEther("1.0");

    before(async () => {
        [owner, user1, user2] = await ethers.getSigners();

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

        // Mint tokens to owner for testing
        await mockToken.approve(taskReward.target, ethers.parseEther("1000000.0"));
    });

    describe('Task Creation', () => {
        it('Should create a RECAST task successfully', async () => {
            const endTime = Math.floor(Date.now() / 1000) + oneDay;
            const tx = await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                10, // maxParticipants
                zerotargetHash,
                [], // requiredWords
                0, // minLength
                500000 // score
            );

            await expect(tx)
                .to.emit(taskReward, 'TaskCreated')
                .withArgs(
                    0, // taskId
                    owner.address,
                    0, // TaskType.RECAST
                    oneETH,
                    mockToken.target,
                    endTime,
                    10,
                    0, // TaskStatus.ACTIVE
                    zerotargetHash,
                    [],
                    0,
                    500000
                );
        });

        it('Should create a RECAST task with targetHash successfully', async () => {
            const endTime = Math.floor(Date.now() / 1000) + oneDay;
            const targetHash = "0x9f22514691c2375e25ae09263512ec7ec2c8e5de";
            const tx = await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                10, // maxParticipants
                targetHash,
                [], // requiredWords
                0, // minLength
                500000 // score
            );

            await expect(tx)
                .to.emit(taskReward, 'TaskCreated')
                .withArgs(
                    1, // taskId
                    owner.address,
                    0, // TaskType.RECAST
                    oneETH,
                    mockToken.target,
                    endTime,
                    10,
                    0, // TaskStatus.ACTIVE
                    targetHash,
                    [],
                    0,
                    500000
                );
        });

        it('Should revert with invalid parameters', async () => {
            const endTime = Math.floor(Date.now() / 1000) - oneDay; // Past time
            await expect(
                taskReward.createTask(
                    0,
                    oneETH,
                    mockToken.target,
                    endTime,
                    10,
                    zerotargetHash,
                    [],
                    0,
                    500000
                )
            ).to.be.revertedWithCustomError(taskReward, 'InvalidEndtime');
        });
    });

    describe('Proof Submission', () => {
        it('Should verify and reward RECAST proof', async () => {

            let recastProof = getproof(recast);
            let tragetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10

            // Ensure tragetHash_ is defined and convert properly
            if (!tragetHash_) {
                throw new Error('Target hash is undefined');
            }
            let tragetHash = ethers.hexlify(tragetHash_);
            console.log("task0 targetHash:::",tragetHash);
            const endTime = Math.floor(Date.now() / 1000) + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                tragetHash,
                [],
                0,
                500000
            );

            // Fast forward time to after endTime
            await ethers.provider.send("evm_increaseTime", [oneDay + 1]);
            await ethers.provider.send("evm_mine", []);

            const tx = await taskReward.submitProof(
                0, // taskId
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: recastProof.signature_r,
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            );            

            await expect(tx)
                .to.emit(taskReward, 'RewardPaid')
                .withArgs(0, user1.address, oneETH/BigInt(maxParticipants_), mockToken.target);
        });
    });

    describe('Task Status Management', () => {
        it('Should complete task when max participants reached', async () => {
            const endTime = Math.floor(Date.now() / 1000) + oneDay;
            await taskReward.createTask(
                0,
                oneETH,
                mockToken.target,
                endTime,
                1, // Only one participant
                ethers.keccak256(ethers.toUtf8Bytes("targetHash")),
                [],
                0,
                500000
            );

            await ethers.provider.send("evm_increaseTime", [oneDay + 1]);
            await ethers.provider.send("evm_mine", []);

            const recastProof = getproof(recast);
            const tx = await taskReward.submitProof(
                1, // taskId
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: recastProof.signature_r,
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            );

            await expect(tx)
                .to.emit(taskReward, 'TaskStatusChanged')
                .withArgs(1, 1); // TaskStatus.COMPLETED
        });
    });
});