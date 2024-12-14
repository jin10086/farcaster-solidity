# Farcaster Task Reward Platform - 前端设计文档

## 1. 整体架构

### 1.1 技术栈
- React/Next.js - 前端框架
- TailwindCSS - 样式框架
- Wagmi/Viem - Web3 集成
- RainbowKit - 钱包连接
- SWR - 数据获取和缓存
- Framer Motion - 动画效果

### 1.2 设计原则
- 简洁直观：清晰的视觉层次和操作流程
- 响应式：完整支持移动端和桌面端
- 即时反馈：所有操作都有明确的状态反馈
- 引导式：新用户友好的功能引导
- Web3 原生：无缝集成区块链功能

## 2. 页面结构

### 2.1 首页（任务广场）
#### 布局设计
- 顶部导航栏
  * Logo
  * 任务分类导航
  * 钱包连接按钮
  * 个人中心入口

- 主要内容区
  * 任务筛选器
    - 任务类型（转发、回复、发帖、点赞）
    - 任务状态（进行中、已结束、即将开始）
    - 奖励范围
    - 时间排序
  
  * 任务卡片网格
    - 任务类型图标
    - 奖励金额
    - 参与人数/上限
    - 剩余时间
    - 完成进度条
    - 快速参与按钮

- 右侧边栏
  * 热门任务推荐
  * 创建任务快捷入口
  * 活动公告

### 2.2 任务创建流程
#### 2.2.1 任务类型选择
- **转发/回复/点赞任务**
  * Farcaster 帖子链接输入框
  * 帖子预览面板
    - 原始帖子内容
    - 作者信息
    - 发布时间
    - 互动数据（点赞、转发、回复数）
  * 自动提取帖子 Hash
  * 链接有效性验证

- **新帖任务**
  * 直接进入任务要求设置

#### 2.2.2 Farcaster API 集成
- **帖子数据获取**
  * 通过 Neynar API 获取帖子详情
  * 支持的链接格式：
    - Warpcast 链接 (https://warpcast.com/...)
    - Farcaster 协议链接
  * 错误处理：
    - 无效链接提示
    - 帖子不存在处理
    - API 请求失败重试

#### 2.2.3 步骤式表单
1. **基础信息**
   - 任务类型选择
   - 任务标题
   - 任务描述
   - 封面图片（可选）

2. **奖励设置**
   - 代币选择
   - 总奖励金额
   - 每人奖励金额
   - Gas 费估算

3. **时间设置**
   - 开始时间
   - 结束时间
   - 过期时间
   - 时区选择

4. **参与条件**
   - 最低社交分数
   - 最大参与人数
   - 其他资格要求

5. **任务要求**
   - 目标帖子选择器（转发/回复/点赞任务）
   - 关键词设置（回复/发帖任务）
   - 最小内容长度（回复/发帖任务）

6. **预览确认**
   - 任务预览
   - 费用预览
   - 发布确认

### 2.3 任务详情页
#### 2.3.1 原始帖子展示
- **帖子嵌入组件**
  * 原始帖子完整展示
  * 实时互动数据
  * 一键跳转到 Warpcast

- **任务关联信息**
  * 任务类型标识
  * 与原帖的关联说明
  * 完成条件提示

#### 2.3.2 任务状态追踪
- **参与状态检查**
  * 实时检查用户是否已完成相应操作
    - 转发状态
    - 回复状态
    - 点赞状态
  * 自动验证完成条件

#### 2.3.3 操作引导
- **任务完成指引**
  * 跳转到 Warpcast 的操作按钮
  * 操作步骤提示
  * 完成后返回指引

#### 信息展示
- 任务基本信息
  * 标题和描述
  * 创建者信息
  * 任务类型和要求
  * 奖励信息
  * 时间信息
  * 参与条件

#### 功能区
- 参与状态
  * 资格检查
  * 任务指引
  * 提交证明
  * 领取奖励

- 社交功能
  * 分享按钮
  * 收藏功能
  * 关注创建者

### 2.4 个人中心
#### 我的任务
- 已创建任务
  * 任务状态管理
  * 参与者列表
  * 奖励发放记录
  * 数据统计

- 已参与任务
  * 进行中任务
  * 已完成任务
  * 奖励记录
  * 任务推荐

## 3. 交互设计

### 3.1 操作反馈
- **加载状态**
  * 骨架屏加载
  * 进度指示器
  * 加载动画

- **交易状态**
  * 等待确认
  * 处理中动画
  * 成功/失败提示
  * 交易详情链接

- **错误处理**
  * 友好错误提示
  * 解决方案建议
  * 重试机制

### 3.2 用户引导
- **新手引导**
  * 功能介绍
  * 操作指引
  * 最佳实践提示

- **智能提示**
  * 资格预检
  * 完成建议
  * 奖励提醒

## 4. 数据展示

### 4.1 统计面板
- **任务统计**
  * 完成率
  * 参与人数
  * 奖励发放
  * 时间分布

- **用户统计**
  * 参与次数
  * 成功率
  * 奖励总额
  * 活跃度

### 4.2 图表可视化
- 任务趋势图
- 奖励分布图
- 用户活跃度图
- 完成情况统计

## 5. 移动端适配

### 5.1 响应式设计
- **布局调整**
  * 自适应网格
  * 堆叠式导航
  * 触屏优化
  * 简化操作流程

- **核心功能**
  * 快速参与
  * 简单创建
  * 便捷查看
  * 及时通知

## 6. 性能优化

### 6.1 加载优化
- 组件懒加载
- 图片优化
- 数据缓存
- 预加载策略

### 6.2 交互优化
- 防抖/节流
- 批量处理
- 本地状态管理
- 离线支持

## 7. 安全设计

### 7.1 钱包集成
- 多钱包支持
- 安全连接流程
- 交易确认机制
- 余额显示

### 7.2 权限控制
- 身份验证
- 操作授权
- 敏感操作确认
- 安全提示

## 8. 后续规划

### 8.1 功能扩展
- 任务模板系统
- 社交分享增强
- 数据分析工具
- 用户声誉系统

### 8.2 体验优化
- 性能监控
- 用户反馈系统
- A/B测试
- 个性化推荐