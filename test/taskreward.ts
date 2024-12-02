import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TaskReward, FarcasterVerify, MockERC20 } from '../typechain-types';
import {time as helperstime} from "@nomicfoundation/hardhat-network-helpers";


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
            const endTime = await helperstime.latest() + oneDay;
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
            const endTime = await helperstime.latest() + oneDay;
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

    describe('RECAST Proof Submission', () => {
        let recastProof = getproof(recast);
     

        it('should revert with TaskNotFound', async () => {
            const nonExistentTaskId = 999999;
            await expect(
                taskReward.submitProof(
                    nonExistentTaskId,
                    user1.address,
                    {
                        public_key: recastProof.public_key,
                        signature_r: recastProof.signature_r,
                        signature_s: recastProof.signature_s,
                        message: recastProof.message
                    }
                )).to.be.revertedWithCustomError(taskReward, 'TaskNotFound');
        });

        it('should revert with wait for endtime', async () => {
            const endTime = await helperstime.latest() + oneDay;
            await expect(taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                10, // maxParticipants
                zerotargetHash,
                [], // requiredWords
                0, // minLength
                500000 // score
            )).to.be.not.reverted;
            
            let taskId = await taskReward.taskIdCounter() - BigInt(1);

            await expect(
                taskReward.submitProof(
                    taskId,
                    user1.address,
                    {
                        public_key: recastProof.public_key,
                        signature_r: recastProof.signature_r,
                        signature_s: recastProof.signature_s,
                        message: recastProof.message
                    }
                )).to.be.revertedWithCustomError(taskReward, 'WaitForEnd');
        });

        it('Should verify and reward RECAST proof', async () => {

            let taskId = await taskReward.taskIdCounter()
            let tragetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            // Ensure tragetHash_ is defined and convert properly
            if (!tragetHash_) {
                throw new Error('Target hash is undefined');
            }
            //Uint8Array to bytes20
            let tragetHash = ethers.hexlify(tragetHash_);
            console.log("task0 targetHash:::", tragetHash);
            const endTime = await helperstime.latest() + oneDay;
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
            await helperstime.increase(endTime + 1);

            const tx = await taskReward.submitProof(
                taskId, // taskId
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
                .withArgs(taskId, user1.address, oneETH / BigInt(maxParticipants_), mockToken.target);
        });
        it('should revert with UserAlreadyClaimed', async () => {
            let taskId = await taskReward.taskIdCounter() - BigInt(1);
            
            await expect(
                taskReward.submitProof(
                    taskId, // taskId
                    user1.address,
                    {
                        public_key: recastProof.public_key,
                        signature_r: recastProof.signature_r,
                        signature_s: recastProof.signature_s,
                        message: recastProof.message
                    }
                )).to.be.revertedWithCustomError(taskReward, 'UserAlreadyClaimed');

        })

        it('should revert with TaskIsFullStaffed', async () => {
            let taskId = await taskReward.taskIdCounter() - BigInt(1);
            const signers = await ethers.getSigners();
            // First complete the task by reaching max participants
            for(let i = 2; i < 11; i++) { // 前两个账号用了. 这边 9 个+之前的 1 个，刚好满
                let user = await signers[i];
                await taskReward.submitProof(
                    taskId,
                    user.address,
                    {
                        public_key: recastProof.public_key,
                        signature_r: recastProof.signature_r,
                        signature_s: recastProof.signature_s,
                        message: recastProof.message
                    }
                );
            }

            // Try to submit proof after task is completed
            const newUser = await signers[15];
            await expect(
                taskReward.submitProof(
                    taskId,
                    newUser.address,
                    {
                        public_key: recastProof.public_key,
                        signature_r: recastProof.signature_r,
                        signature_s: recastProof.signature_s,
                        message: recastProof.message
                    }
                )).to.be.revertedWithCustomError(taskReward, 'TaskIsFullStaffed');
        });

        it('should revert with recast InvalidTaskType', async () => {

            let taskId = await taskReward.taskIdCounter()
            let tragetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            // Ensure tragetHash_ is defined and convert properly
            if (!tragetHash_) {
                throw new Error('Target hash is undefined');
            }
            //Uint8Array to bytes20
            let tragetHash = ethers.hexlify(tragetHash_);
            console.log("task0 targetHash:::", tragetHash);
            const endTime = await helperstime.latest() + oneDay;
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
            await helperstime.increase(endTime + 1);


            //use likecast to verify recast
            let likecastproof = getproof(likecast);
            await expect(taskReward.submitProof(
                taskId, // taskId
                user1.address,
                {
                    public_key: likecastproof.public_key,
                    signature_r: likecastproof.signature_r,
                    signature_s: likecastproof.signature_s,
                    message: likecastproof.message
                }
            )).to.be.revertedWithCustomError(taskReward, 'InvalidTaskType');

        })

        it('should revert with recast TargetHashMismatch', async () => {

            let taskId = await taskReward.taskIdCounter()
            let maxParticipants_ = 10
            // Ensure tragetHash_ is defined and convert properly

            
            //Uint8Array to bytes20
            let tragetHash = zerotargetHash;
            console.log("task0 targetHash:::", tragetHash);
            //lasttime	+   oneday
            const endTime = await helperstime.latest() + oneDay;
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
            await helperstime.increase(endTime + 1);


            await expect(taskReward.submitProof(
                taskId, // taskId
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: recastProof.signature_r,
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            )).to.be.revertedWithCustomError(taskReward, 'TargetHashMismatch');

        })



    });

    describe('LIKE Proof Submission', () => {
        let likeProof = getproof(likecast);

        it('Should verify and reward LIKE proof', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = likeProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);
            
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                3, // TaskType.LIKE
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                [],
                0,
                500000
            );

            await helperstime.increase(endTime + 1);

            const tx = await taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: likeProof.public_key,
                    signature_r: likeProof.signature_r,
                    signature_s: likeProof.signature_s,
                    message: likeProof.message
                }
            );

            await expect(tx)
                .to.emit(taskReward, 'RewardPaid')
                .withArgs(taskId, user1.address, oneETH / BigInt(maxParticipants_), mockToken.target);
        });
    });

    describe('REPLY Proof Submission', () => {
        let replyProof = getproof(castadd);

        it('Should verify and reward REPLY proof with required words and min length', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = replyProof.rawmessage.castAddBody?.parentCastId?.hash;
            let maxParticipants_ = 10
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);
            
            const endTime = await helperstime.latest() + oneDay;
            const requiredWords = ["真不错", "啊"];
            const minLength = 2;

            await taskReward.createTask(
                1, // TaskType.REPLY
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                requiredWords,
                minLength,
                500000
            );

            await helperstime.increase(endTime + 1);

            const tx = await taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: replyProof.public_key,
                    signature_r: replyProof.signature_r,
                    signature_s: replyProof.signature_s,
                    message: replyProof.message
                }
            );

            await expect(tx)
                .to.emit(taskReward, 'RewardPaid')
                .withArgs(taskId, user1.address, oneETH / BigInt(maxParticipants_), mockToken.target);
        });

        it('should revert with MinLengthMismatch for REPLY', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = replyProof.rawmessage.castAddBody?.parentCastId?.hash;
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);
            
            const endTime = await helperstime.latest() + oneDay;
            const minLength = 1000; // Set a very large minimum length

            await taskReward.createTask(
                1, // TaskType.REPLY
                oneETH,
                mockToken.target,
                endTime,
                10,
                targetHash,
                [],
                minLength,
                500000
            );

            await helperstime.increase(endTime + 1);

            await expect(
                taskReward.submitProof(
                    taskId,
                    user1.address,
                    {
                        public_key: replyProof.public_key,
                        signature_r: replyProof.signature_r,
                        signature_s: replyProof.signature_s,
                        message: replyProof.message
                    }
                )
            ).to.be.revertedWithCustomError(taskReward, 'MinLengthMismatch');
        });

        it('should revert with RequiredWordsMismatch for REPLY', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = replyProof.rawmessage.castAddBody?.parentCastId?.hash;
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);
            
            const endTime = await helperstime.latest() + oneDay;
            const requiredWords = ["ThisWordWillDefinitelyNotBeInTheMessage123456"];

            await taskReward.createTask(
                1, // TaskType.REPLY
                oneETH,
                mockToken.target,
                endTime,
                10,
                targetHash,
                requiredWords,
                0,
                500000
            );

            await helperstime.increase(endTime + 1);

            await expect(
                taskReward.submitProof(
                    taskId,
                    user1.address,
                    {
                        public_key: replyProof.public_key,
                        signature_r: replyProof.signature_r,
                        signature_s: replyProof.signature_s,
                        message: replyProof.message
                    }
                )
            ).to.be.revertedWithCustomError(taskReward, 'RequiredWordsMismatch');
        });
    });

    describe('NEW_CAST Proof Submission', () => {
        let newcastProof = getproof(newcast);

        it('Should verify and reward NEW_CAST proof with required words and min length', async () => {
            let taskId = await taskReward.taskIdCounter()
            let maxParticipants_ = 10
            
            const endTime = await helperstime.latest() + oneDay;
            const requiredWords = ["How", "meme"];
            const minLength = 3;

            await taskReward.createTask(
                2, // TaskType.NEW_CAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                zerotargetHash,
                requiredWords,
                minLength,
                500000
            );

            await helperstime.increase(endTime + 1);

            const tx = await taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: newcastProof.public_key,
                    signature_r: newcastProof.signature_r,
                    signature_s: newcastProof.signature_s,
                    message: newcastProof.message
                }
            );

            await expect(tx)
                .to.emit(taskReward, 'RewardPaid')
                .withArgs(taskId, user1.address, oneETH / BigInt(maxParticipants_), mockToken.target);
        });

        it('should revert with MinLengthMismatch for NEW_CAST', async () => {
            let taskId = await taskReward.taskIdCounter()
            
            const endTime = await helperstime.latest() + oneDay;
            const minLength = 1000; // Set a very large minimum length

            await taskReward.createTask(
                2, // TaskType.NEW_CAST
                oneETH,
                mockToken.target,
                endTime,
                10,
                zerotargetHash,
                [],
                minLength,
                500000
            );

            await helperstime.increase(endTime + 1);

            await expect(
                taskReward.submitProof(
                    taskId,
                    user1.address,
                    {
                        public_key: newcastProof.public_key,
                        signature_r: newcastProof.signature_r,
                        signature_s: newcastProof.signature_s,
                        message: newcastProof.message
                    }
                )
            ).to.be.revertedWithCustomError(taskReward, 'MinLengthMismatch');
        });

        it('should revert with RequiredWordsMismatch for NEW_CAST', async () => {
            let taskId = await taskReward.taskIdCounter()
            
            const endTime = await helperstime.latest() + oneDay;
            const requiredWords = ["ThisWordWillDefinitelyNotBeInTheMessage123456"];

            await taskReward.createTask(
                2, // TaskType.NEW_CAST
                oneETH,
                mockToken.target,
                endTime,
                10,
                zerotargetHash,
                requiredWords,
                0,
                500000
            );

            await helperstime.increase(endTime + 1);

            await expect(
                taskReward.submitProof(
                    taskId,
                    user1.address,
                    {
                        public_key: newcastProof.public_key,
                        signature_r: newcastProof.signature_r,
                        signature_s: newcastProof.signature_s,
                        message: newcastProof.message
                    }
                )
            ).to.be.revertedWithCustomError(taskReward, 'RequiredWordsMismatch');
        });
    });
});