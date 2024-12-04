# Farcaster Task Reward System

## 项目概述

这是一个基于Farcaster社交网络的任务奖励系统。用户可以创建各种类型的社交任务，并为完成任务的参与者提供代币奖励。系统支持多种任务类型，包括转发、回复、发帖和点赞等社交互动。

## 核心功能

### 任务创建
- 支持创建不同类型的社交任务
- 可设置任务开始时间、结束时间和过期时间
- 可指定代币奖励金额和每人奖励额度
- 可设置最大参与人数
- 可设置参与者最低分数要求
- 可针对特定帖子设置任务要求

### 任务验证
- 支持链上验证Farcaster消息签名
- 验证用户的Farcaster身份（FID）
- 验证用户的社交分数
- 验证消息发布时间是否在任务有效期内
- 验证任务特定要求（如指定帖子、关键词等）

### 奖励发放
- 自动发放代币奖励
- 支持任意ERC20代币作为奖励
- 按每人奖励额度发放
- 防止重复领取

## 任务类型

系统支持以下四种任务类型：

1. **转发任务 (RECAST)**
   - 可指定需要转发的特定帖子
   - 验证转发操作的真实性

2. **回复任务 (REPLY)**
   - 可指定需要回复的特定帖子
   - 支持设置回复内容的最小长度
   - 支持设置必须包含的关键词

3. **发帖任务 (NEW_CAST)**
   - 支持设置帖子内容的最小长度
   - 支持设置必须包含的关键词

4. **点赞任务 (LIKE)**
   - 可指定需要点赞的特定帖子
   - 验证点赞操作的真实性

## 参与条件

1. **用户资格**
   - 必须拥有Farcaster身份（FID）
   - 社交分数必须达到任务要求
   - 地址必须与Farcaster身份匹配

2. **时间限制**
   - 任务有明确的开始和结束时间
   - 社交操作必须在任务有效期内完成
   - 奖励只能在任务结束后领取
   - 未领取的奖励在过期时间后可由创建者收回

## 安全特性

1. **防重入保护**
   - 使用OpenZeppelin的ReentrancyGuard
   - 防止重复领取奖励

2. **验证机制**
   - 链上验证Farcaster消息签名
   - 验证用户身份和权限
   - 验证任务完成条件

3. **资金安全**
   - 创建任务时锁定奖励代币
   - 任务过期后未使用的奖励可收回
   - 精确计算每人奖励额度

## 接口说明

### 主要接口

1. **创建任务**
```solidity
function createTask(
    TaskType taskType,          // 任务类型
    uint256 reward,            // 总奖励金额
    address rewardToken,       // 奖励代币地址
    uint32 starttime,         // 开始时间
    uint32 endtime,           // 结束时间
    uint256 maxParticipants,  // 最大参与人数
    bytes20 targetHash,       // 目标帖子哈希
    string[] requiredWords,   // 必需关键词
    uint256 minLength,        // 最小长度
    uint256 score            // 要求的最低分数
) external returns (uint256)
```

2. **提交任务证明**
```solidity
function submitProof(
    uint256 taskId,           // 任务ID
    address user,             // 用户地址
    TaskProof calldata proof  // 任务完成证明
) external
```

3. **提取未使用奖励**
```solidity
function withdrawUnusedRewards(
    uint256 taskId            // 任务ID
) external
```

### 事件

1. **TaskCreated**: 任务创建时触发
2. **TaskStatusChanged**: 任务状态变更时触发
3. **RewardPaid**: 奖励发放时触发
4. **TaskExpired**: 任务过期时触发

## 错误处理

系统定义了多种错误类型以处理各种异常情况：

- `TaskNotFound`: 任务不存在
- `TaskNotExpired`: 任务未过期
- `TaskIsFullStaffed`: 参与人数已满
- `UserAlreadyClaimed`: 用户已领取奖励
- `InvalidProof`: 无效的证明
- `WaitForEnd`: 任务尚未结束
- `NotEnoughScore`: 用户分数不足
- `NotFoundFID`: 未找到用户FID
- `AddressDontMatchFid`: 地址与FID不匹配
- `InvaildMessageTime`: 消息时间无效

## 使用示例

1. **创建转发任务**
```solidity
await taskReward.createTask(
    0, // TaskType.RECAST
    oneETH, // 1 ETH奖励
    tokenAddress,
    startTime,
    endTime,
    10, // 最多10人参与
    targetHash, // 指定帖子
    [], // 无关键词要求
    0,  // 无长度要求
    500000 // 要求50%的社交分数
);
```

2. **提交任务证明**
```solidity
await taskReward.submitProof(
    taskId,
    userAddress,
    {
        public_key: proof.public_key,
        signature_r: proof.signature_r,
        signature_s: proof.signature_s,
        message: proof.message
    }
);
```

## 注意事项

1. 确保任务创建时提供足够的奖励代币
2. 任务结束时间必须晚于开始时间
3. 社交操作必须在任务有效期内完成
4. 用户必须满足最低分数要求
5. 确保用户地址与Farcaster身份匹配
