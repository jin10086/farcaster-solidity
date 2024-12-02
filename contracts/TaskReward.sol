// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
// import "./libraries/Blake3.sol";
// import "./libraries/Ed25519.sol";
// import "./protobufs/message.proto.sol";

//通过地址获取 fid
interface IVerificationsV4Reader {
    function getFidWithEvent(address verifier) external returns (uint256 fid);
}

//通过地址获取分数
interface INeynarUserScoresReader {
    function getScoreWithEvent(address verifier) external returns (uint24 score);

}

import { MessageData,MessageType,ReactionType } from './protobufs/message.proto.sol';

interface IFarcasterVerify{
    function verifyCastAddMessage(
    bytes32 public_key,
    bytes32 signature_r,
    bytes32 signature_s,
    bytes memory message
  ) external returns(MessageData memory);

  function verifyReactionAddMessage(
    bytes32 public_key,
    bytes32 signature_r,
    bytes32 signature_s,
    bytes memory message
  ) external returns(MessageData memory);

}

contract TaskReward is  ReentrancyGuard {
    enum TaskType { RECAST, REPLY, NEW_CAST, LIKE }
    enum TaskStatus { ACTIVE, COMPLETED, EXPIRED }

    IFarcasterVerify public farcasterVerify;
    IVerificationsV4Reader public getuserfid = IVerificationsV4Reader(0xdB1eCF22d195dF9e03688C33707b19C68BdEd142);
    INeynarUserScoresReader public getuserscore = INeynarUserScoresReader(0xd3C43A38D1D3E47E9c420a733e439B03FAAdebA8);

    //farcaster basetime https://docs.farcaster.xyz/learn/what-is-farcaster/messages#timestamps
    uint32 constant BASETIME = 1609459200;

    struct Task {
        address creator;
        TaskType taskType;
        uint256 reward;  //总奖励金额
        uint256 perUserAmount;    // 每人奖励金额
        address rewardToken;  //not eth   
        uint32 starttime;//任务结束时间
        uint32 endtime; //任务结束时间.只有结束后才可以领取奖励
        uint32 expiredtime;  // 任务过期时间,过期后没有领取的可以退钱.
        uint256 maxParticipants;
        uint256 completedCount;
        TaskStatus status;
        
        // Task specific parameters
        bytes20 targetHash;      // For RECAST, REPLY, and LIKE
        string[] requiredWords;  // For REPLY and NEW_CAST
        uint256 minLength;       // For REPLY and NEW_CAST
        uint256 score;  //用户的分数.  0-1000000 https://docs.neynar.com/docs/address-user-score-contract
    }

    struct TaskProof {
        bytes32 public_key;
        bytes32 signature_r;
        bytes32 signature_s;
        bytes  message;
    }

    // Storage
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => mapping(address => bool)) public userClaimedTasks; // taskId => useraddress => completed
    uint256 public taskIdCounter;

    // Events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        TaskType taskType,
        uint256 reward,
        address rewardToken,
        uint256 endtime,  
        uint256 maxParticipants,
        TaskStatus status,
        bytes20 targetHash,
        string[] requiredWords,
        uint256 minLength,
        uint256 score
    );

    event TaskStatusChanged(
        uint256 indexed taskId,
        TaskStatus status
    );

    event RewardPaid(
        uint256 indexed taskId,
        address indexed recipient,
        uint256 amount,
        address token
    );

    event TaskExpired(
        uint256 indexed taskId,
        address indexed creator,
        uint256 returnedRewards
    );

    // Errors
    error TaskNotFound();
    error TaskNotExpired();
    error TaskIsFullStaffed();
    error UserAlreadyClaimed();
    error InvalidProof();
    error InvalidReward();
    error InvalidEndtime();
    error WaitForEnd();
    error TaskIsExpired();
    error InvalidParticipants();
    error InvaildTaskStatus();
    error InsufficientReward();
    error InvalidTokenAddress();
    error InvalidScore();
    error InvaildTaskRequirements();
    error TargetHashMismatch();
    error RequiredWordsMismatch();
    error MinLengthMismatch();
    error InvalidTaskType();
    error NotEnoughScore();
    error NotFoundFID();
    error AddressDontMatchFid();
    error InvaildMessageTime(); //错误的帖子时间.

    constructor(address _farcasterVerifyAddress) {
        // getscore = IVerificationsV4Reader(_verificationsAddress);
        farcasterVerify = IFarcasterVerify(_farcasterVerifyAddress);
    }

    function createTask(
        TaskType taskType,
        uint256 reward,
        address rewardToken,
        uint32 starttime,
        uint32 endtime,
        uint256 maxParticipants,
        bytes20 targetHash,
        string[] memory requiredWords,
        uint256 minLength,
        uint256 score
    ) external payable returns (uint256) {
        if (endtime <= block.timestamp) revert InvalidEndtime();
        if (maxParticipants == 0) revert InvalidParticipants();
        if (rewardToken == address(0)) revert InvalidTokenAddress();
        if (reward == 0) revert InvalidReward();
        if (score > 1000000) revert InvalidScore();
        if (taskType == TaskType.NEW_CAST && targetHash != bytes20(0)) revert InvaildTaskRequirements();
        if (taskType != TaskType.NEW_CAST && targetHash == bytes20(0)) revert InvaildTaskRequirements();

        uint256 perUserAmount = reward / maxParticipants;

        // Handle reward transfer
        IERC20(rewardToken).transferFrom(msg.sender, address(this), reward);

        uint256 taskId = taskIdCounter++;
        tasks[taskId] = Task({
            creator: msg.sender,
            taskType: taskType,
            reward: reward,
            perUserAmount: perUserAmount,
            rewardToken: rewardToken,
            starttime:starttime,
            endtime: endtime,
            expiredtime: endtime+30*60*60*24,
            maxParticipants: maxParticipants,
            completedCount: 0,
            status: TaskStatus.ACTIVE,
            targetHash: targetHash,
            requiredWords: requiredWords,
            minLength: minLength,
            score: score
        });

        emit TaskCreated(taskId, msg.sender, taskType, reward, rewardToken, endtime, maxParticipants, TaskStatus.ACTIVE, targetHash, requiredWords, minLength,score);
        return taskId;
    }

    function submitProof(
        uint256 taskId,
        address user,
        TaskProof calldata proof
    ) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.creator == address(0)) revert TaskNotFound();
        if (block.timestamp < task.endtime) revert WaitForEnd();
        if (block.timestamp > task.expiredtime) revert TaskIsExpired();
        if (userClaimedTasks[taskId][user]) revert UserAlreadyClaimed();
        if (task.completedCount >= task.maxParticipants) revert TaskIsFullStaffed();
        if (task.status != TaskStatus.ACTIVE) revert InvaildTaskStatus();

        if (task.score> 0){
            uint256 userScore = getuserscore.getScoreWithEvent(user);
            console.log("userScore:",userScore);
            if (userScore < task.score) revert NotEnoughScore();
        }
        uint256 userFid = getuserfid.getFidWithEvent(user);
        if (userFid == 0) revert NotFoundFID();

        _verifyProof(task, proof,userFid);
        

        // Mark task as completed for this user
        userClaimedTasks[taskId][user] = true;
        task.completedCount++;

        // Update task status if max participants reached
        if (task.completedCount >= task.maxParticipants) {
            task.status = TaskStatus.COMPLETED;
            emit TaskStatusChanged(taskId, task.status);
        }

        // Pay reward to user
        IERC20(task.rewardToken).transfer(user, task.perUserAmount);
        emit RewardPaid(taskId, user, task.perUserAmount, task.rewardToken);
    }

    function _verifyProof(Task memory task, TaskProof calldata proof,uint256 userFid) internal returns (bool) {

        MessageData memory message_data;
        if (task.taskType == TaskType.RECAST || task.taskType == TaskType.LIKE) {
            message_data =  farcasterVerify.verifyReactionAddMessage(proof.public_key, proof.signature_r, proof.signature_s, proof.message);
        } else{
            message_data =  farcasterVerify.verifyCastAddMessage(proof.public_key, proof.signature_r, proof.signature_s, proof.message);
        }

        //检查用户和 fid 地址是否一致
        uint256 proofFid =uint256(message_data.fid);
        console.log("proofFid:",proofFid);
        console.log("userFid:",userFid);
        if (proofFid != userFid) revert AddressDontMatchFid();
        
        //帖子的发布时间
        uint32 messageTime = message_data.timestamp	+BASETIME;
        if (messageTime < task.starttime || messageTime > task.endtime) revert InvaildMessageTime();



        if (task.taskType == TaskType.RECAST) {
            if (!_verifyRecast(message_data, task)) revert InvalidProof();
        } else if (task.taskType == TaskType.REPLY) {
            if (!_verifyReply(message_data, task)) revert InvalidProof();
        } else if (task.taskType == TaskType.NEW_CAST) {
            if (!_verifyNewCast(message_data, task)) revert InvalidProof();
        } else if (task.taskType == TaskType.LIKE) {
            if (!_verifyLike(message_data, task)) revert InvalidProof();
        }
        return true;
    }

    // 
    function _verifyRecast(MessageData memory message_data, Task memory task) internal pure returns (bool) {
        // 验证消息类型是否为 转发帖子
        if (message_data.type_ != MessageType.MESSAGE_TYPE_REACTION_ADD)revert InvalidTaskType();
        if (message_data.reaction_body.type_ != ReactionType.REACTION_TYPE_RECAST) revert InvalidTaskType();

        // 验证目标帖子 
        bytes memory hash = message_data.reaction_body.target_cast_id.hash_;
        require(hash.length == 20, "Invalid hash length");
        bytes20 recastTargetHash;
        assembly {
            recastTargetHash := mload(add(hash, 32))
        }
        if (recastTargetHash != task.targetHash) revert TargetHashMismatch();
        return true;
    }
    
    function _verifyLike(MessageData memory message_data, Task memory task) internal pure returns (bool) {
        // 验证消息类型是否为点赞
        if (message_data.type_ != MessageType.MESSAGE_TYPE_REACTION_ADD) revert InvalidTaskType();
        if (message_data.reaction_body.type_ != ReactionType.REACTION_TYPE_LIKE) revert InvalidTaskType();

        // 验证目标帖子
        bytes memory hash = message_data.reaction_body.target_cast_id.hash_;
        require(hash.length == 20, "Invalid hash length");
        bytes20 castTargetHash;
        assembly {
            castTargetHash := mload(add(hash, 32))
        }
        if (castTargetHash != task.targetHash) revert TargetHashMismatch();

        return true;
    }

    function _gethash(MessageData memory message_data) internal pure returns (bytes20 replyTargetHash) {
        bytes memory hash;
        if (bytes(message_data.cast_add_body.parent_url).length == 0) {
            hash = message_data.cast_add_body.parent_cast_id.hash_;
        }else{
            //in channel
            hash = message_data.cast_add_body.embeds[0].cast_id.hash_;
        }
        require(hash.length == 20, "Invalid hash length");
        assembly {
            replyTargetHash := mload(add(hash, 32))
        }
        return replyTargetHash;
    }
    function _verifyReply(MessageData memory message_data, Task memory task) internal pure returns (bool) {
        // 验证消息类型是否为回复
        if (message_data.type_ != MessageType.MESSAGE_TYPE_CAST_ADD) revert InvalidTaskType();
        
        bytes20 replyTargetHash = _gethash(message_data);
        if (replyTargetHash != task.targetHash) revert TargetHashMismatch();

        // 验证文本长度
        if (bytes(message_data.cast_add_body.text).length < task.minLength) revert MinLengthMismatch();

        // 验证必需词
        for (uint i = 0; i < task.requiredWords.length; i++) {
            if (!_containsWord(message_data.cast_add_body.text, task.requiredWords[i])) {
                revert RequiredWordsMismatch();
            }
        }

        return true;
    }

    function _verifyNewCast(MessageData memory message_data, Task memory task) internal pure returns (bool) {
        // 验证消息类型是否为新帖子
        if (message_data.type_ != MessageType.MESSAGE_TYPE_CAST_ADD) revert InvalidTaskType();
        
        // 验证是否是新帖子（不是回复）
        bytes memory hash = message_data.cast_add_body.parent_cast_id.hash_;
        if (hash.length != 0) revert InvalidTaskType();

        // 验证文本长度
        if (bytes(message_data.cast_add_body.text).length < task.minLength) revert MinLengthMismatch();

        // 验证必需词
        for (uint i = 0; i < task.requiredWords.length; i++) {
            if (!_containsWord(message_data.cast_add_body.text, task.requiredWords[i])) {
                revert RequiredWordsMismatch();
            }
        }

        return true;
    }

    // 辅助函数：检查文本是否包含特定词
    function _containsWord(string memory text, string memory word) internal pure returns (bool) {
        bytes memory textBytes = bytes(text);
        bytes memory wordBytes = bytes(word);
        
        if (wordBytes.length > textBytes.length) return false;
        
        for (uint i = 0; i <= textBytes.length - wordBytes.length; i++) {
            bool found = true;
            for (uint j = 0; j < wordBytes.length; j++) {
                if (textBytes[i + j] != wordBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    // Admin functions
    function withdrawUnusedRewards(uint256 taskId) external  {
        Task storage task = tasks[taskId];
        if (task.creator == address(0)) revert TaskNotFound();
        if (block.timestamp < task.expiredtime) revert TaskNotExpired();
        if(task.status != TaskStatus.ACTIVE) revert InvaildTaskStatus();

        if(task.completedCount >= task.maxParticipants)revert InsufficientReward();
        uint256 unusedRewards = task.perUserAmount * (task.maxParticipants - task.completedCount);
        task.status = TaskStatus.EXPIRED;
        emit TaskStatusChanged(taskId, task.status);
        IERC20(task.rewardToken).transfer(task.creator, unusedRewards);
        emit TaskExpired(taskId, task.creator, unusedRewards);
        
    }

    // View functions
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function hasCompleted(uint256 taskId, address user) external view returns (bool) {
        return userClaimedTasks[taskId][user];
    }
}