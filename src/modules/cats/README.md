# 猫猫养成计划 配合 AI

通过交互来让猫猫成长，并且通过 AI 来让猫猫有更多的互动和反馈。

## 1. 设计猫猫的生命周期阶段与成长模型

- 生命周期阶段划分
  - 幼猫期 （0-6 个月）
  - 青少年期 （6-12 个月）
  - 成年期 （1-7 岁）
  - 老年期 （7-15 岁）
  - 死亡期 （15 岁以上）
- 成长模型
  每只猫出生时，随机生成一组影响成长的参数，如：
  - 最大寿命（随机范围内， 可以通过一些行为少量添加）
  - 成长速度（影响体重、体型变化速度）
  <!-- - 基础属性（生命值、攻击、防御、敏捷等，参考宠物档次理论） -->
  - 性格特征（影响行为和成长路径，参考个性化成长模型）
- 成长属性与状态
  设计一套基础属性（如生命值、饥饿、快乐、清洁等）和成长指标（体重、体型、技能等），这些属性会随时间和操作变化。

## 2. 成长算法与状态更新设计

- 时间驱动的成长计算
  采用定时任务或懒更新机制（用户交互时计算成长差异），根据当前时间与上次更新时间差，结合成长速度和生命周期参数，计算成长进度和状态变化[“宠物每天成长”回答]。

- 成长事件与阶段切换
  当成长指标达到某个阈值时，自动切换生命周期阶段，触发对应的属性调整和行为变化。

- 随机事件与个性化调整
  引入随机事件（如生病、心情波动等）和用户互动影响，结合用户模型调整成长轨迹，使每只猫的成长更独特。

## 3. 数据结构与存储设计

- 猫猫实体数据

  - 唯一ID
  - 出生时间
  - 生命周期参数（最大寿命、成长速度、性格等）
  - 当前阶段与属性状态（体重、生命值、快乐度等）
  - 上次更新时间戳
  - 成长历史与事件记录
  - 上次更新时间戳

- 成长历史与事件记录
  记录成长过程中的关键事件和状态变化，便于回溯和展示。

## 4. 用户交互与反馈设计

- 根据成长状态变化，动态调整猫猫的外观、行为和情绪反馈，提升沉浸感。
- 设计营养、训练、社交等多样化互动，影响成长参数和状态。

简要示例架构流程

- 初始化猫猫数据：随机生成生命周期参数和初始属性。
- 定时或触发更新：根据时间差计算成长进度，更新属性和阶段。
- 阶段切换判断：达到阈值时切换生命周期阶段，调整属性。
- 用户交互影响：用户喂养、训练等操作影响成长状态。
- 保存状态：更新数据库，记录成长历史。

## 5. 成长执行时机

- 定时任务：每天凌晨 00:00 执行成长计算
  - 或者根据用户登录或者访问时，执行成长计算
- 用户交互：用户喂养、训练等操作时，立即计算成长差异
- 随机事件：根据概率触发随机事件，影响成长状态
