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
    const score = 500000;

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
                score // score
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
                    score
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
                score // score
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
                    score
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
                    score
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
                score // score
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
            let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            // Ensure targetHash_ is defined and convert properly
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            //Uint8Array to bytes20
            let targetHash = ethers.hexlify(targetHash_);
            console.log("task0 targetHash:::", targetHash);
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                [],
                0,
                score
            );

            // Fast forward time to after endTime
            await helperstime.increaseTo(endTime + 1);

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

        it('should revert with InvalidTaskType when using wrong reaction type', async () => {
            let likeProof = getproof(likecast);
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = likeProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);            
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                [],
                0,
                score
            );

            await helperstime.increaseTo(endTime + 1);

            // Use likeProof for recast task - this will pass signature verification but fail on reaction type
            await expect(taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: likeProof.public_key,
                    signature_r: likeProof.signature_r,
                    signature_s: likeProof.signature_s,
                    message: likeProof.message
                }
            )).to.be.revertedWithCustomError(taskReward, 'InvalidTaskType');
        });

        it('should revert with InvalidMessageType when using wrong message type', async () => {
            let newcastProof = getproof(newcast);
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = newcastProof.rawmessage.castAddBody?.parentCastId?.hash;
            let maxParticipants_ = 10
            
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                zerotargetHash,
                [],
                0,
                score
            );

            await helperstime.increaseTo(endTime + 1);

            // Use newcast for recast task - this will fail on message type check
            await expect(taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: newcastProof.public_key,
                    signature_r: newcastProof.signature_r,
                    signature_s: newcastProof.signature_s,
                    message: newcastProof.message
                }
            )).to.be.revertedWithCustomError(farcasterVerify, 'InvalidMessageType');
        });

        it('should revert with recast TargetHashMismatch', async () => {

            let taskId = await taskReward.taskIdCounter()
            let maxParticipants_ = 10
            // Ensure targetHash_ is defined and convert properly

            
            //Uint8Array to bytes20
            let targetHash = zerotargetHash;
            console.log("task0 targetHash:::", targetHash);
            //lasttime	+   oneday
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                [],
                0,
                score
            );

            await helperstime.increaseTo(endTime + 1);

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

        it('should revert with InvalidSignature when using wrong signature', async () => {
            let taskId = await taskReward.taskIdCounter()
            let recastProof = getproof(recast);
            let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            let maxParticipants_ = 10
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let targetHash = ethers.hexlify(targetHash_);
            
            const endTime = await helperstime.latest() + oneDay;
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                targetHash,
                [],
                0,
                score
            );

            await helperstime.increaseTo(endTime + 1);

            // 修改签名以使验证失败
            await expect(taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: "0x1234567890123456789012345678901234567890123456789012345678901234", // 错误的签名
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            )).to.be.revertedWithCustomError(farcasterVerify, 'InvalidSignature');
        });
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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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
                score
            );

            await helperstime.increaseTo(endTime + 1);

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

    describe('Withdraw Unused Rewards', () => {
        let recastProof = getproof(recast);

        it('should revert with TaskNotFound when task does not exist', async () => {
            const nonExistentTaskId = 999999;
            await expect(
                taskReward.withdrawUnusedRewards(nonExistentTaskId)
            ).to.be.revertedWithCustomError(taskReward, 'TaskNotFound');
        });

        it('should revert with TaskNotExpired when task has not expired', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let maxParticipants_ = 10
            
            const endTime = await helperstime.latest() + oneDay;            
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                ethers.hexlify(targetHash_),
                [],
                0,
                score
            );
            let taskinfo = await taskReward.getTask(taskId)
            console.log(taskinfo)
            let expiredTime = taskinfo[6]

            await helperstime.increaseTo(expiredTime - BigInt(100)); // 小于过期时间
            await expect(
                taskReward.withdrawUnusedRewards(taskId)
            ).to.be.revertedWithCustomError(taskReward, 'TaskNotExpired');
        });

        it('should revert with InvaildTaskStatus when all rewards are claimed', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let maxParticipants_ = 1 // 只允许一个参与者
            
            const endTime = await helperstime.latest() + oneDay;
            
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                ethers.hexlify(targetHash_),
                [],
                0,
                score
            );

            // 提交一个证明以完成任务
            await helperstime.increaseTo(endTime + 1);
            await taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: recastProof.signature_r,
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            );

            // 等待过期时间
            let taskinfo = await taskReward.getTask(taskId)
            let expiredTime = taskinfo[6]
            await helperstime.increaseTo(expiredTime+BigInt(1));

            await expect(
                taskReward.withdrawUnusedRewards(taskId)
            ).to.be.revertedWithCustomError(taskReward, 'InvaildTaskStatus');
        });

        it('should successfully withdraw unused rewards', async () => {
            let taskId = await taskReward.taskIdCounter()
            let targetHash_ = recastProof.rawmessage.reactionBody?.targetCastId?.hash;
            if (!targetHash_) {
                throw new Error('Target hash is undefined');
            }
            let maxParticipants_ = 2 // 允许两个参与者
            
            const endTime = await helperstime.latest() + oneDay;
            
            await taskReward.createTask(
                0, // TaskType.RECAST
                oneETH,
                mockToken.target,
                endTime,
                maxParticipants_,
                ethers.hexlify(targetHash_),
                [],
                0,
                score
            );

            // 提交一个证明，留下一个未使用的奖励
            await helperstime.increaseTo(endTime + 1);
            await expect(taskReward.submitProof(
                taskId,
                user1.address,
                {
                    public_key: recastProof.public_key,
                    signature_r: recastProof.signature_r,
                    signature_s: recastProof.signature_s,
                    message: recastProof.message
                }
            )).to.emit(taskReward, 'RewardPaid')
            .withArgs(taskId, user1.address, oneETH / BigInt(maxParticipants_), mockToken.target);

            // 等待过期时间
            let taskinfo = await taskReward.getTask(taskId)
            let expiredTime = taskinfo[6]
            await helperstime.increaseTo(expiredTime+BigInt(1));

            // 记录创建者的初始余额
            const initialBalance = await mockToken.balanceOf(owner.address);

            const unusedRewards = (oneETH/BigInt(maxParticipants_)) * (BigInt(maxParticipants_)-BigInt(1));
            // 提取未使用的奖励
            await expect(taskReward.withdrawUnusedRewards(taskId))
                .to.emit(taskReward, 'TaskExpired')
                .withArgs(taskId, owner.address, unusedRewards); // 应该退还一个参与者的奖励金额

            // 验证创建者的余额增加了未使用的奖励金额
            const finalBalance = await mockToken.balanceOf(owner.address);
            expect(finalBalance - initialBalance).to.equal(unusedRewards);

            // 验证任务状态改变
            const task = await taskReward.getTask(taskId);
            expect(task.status).to.equal(2); // TaskStatus.EXPIRED
        });
    });
});