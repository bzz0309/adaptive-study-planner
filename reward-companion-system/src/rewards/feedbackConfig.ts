import type { RewardLineType } from "./rewardTypes";

export type FeedbackRewardId =
  | "highlight_all_correct"
  | "highlight_quiz_all_correct"
  | "highlight_consecutive_all_correct"
  | "breakthrough_wrong_question"
  | "breakthrough_three_wrong_questions"
  | "breakthrough_knowledge_mastered"
  | "breakthrough_delayed_variation_twice";

export type FeedbackConfigItem = {
  id: FeedbackRewardId;
  lineType: Exclude<RewardLineType, "streak_reward">;
  title: string;
  body: string;
  shortTitle?: string;
  shortBody?: string;
};

export const feedbackConfig: Record<FeedbackRewardId, FeedbackConfigItem> = {
  highlight_all_correct: {
    id: "highlight_all_correct",
    lineType: "highlight_feedback",
    title: "今日高光",
    body: "今天的题目，被你稳稳拿下了。",
    shortTitle: "全对通过",
    shortBody: "今天这一组，很稳。",
  },
  highlight_quiz_all_correct: {
    id: "highlight_quiz_all_correct",
    lineType: "highlight_feedback",
    title: "今日高光",
    body: "这次小测，被你稳稳拿下了。",
    shortTitle: "全对通过",
    shortBody: "今天这一组，很稳。",
  },
  highlight_consecutive_all_correct: {
    id: "highlight_consecutive_all_correct",
    lineType: "highlight_feedback",
    title: "今日高光",
    body: "连续全对的手感，已经被你慢慢找到了。",
    shortTitle: "全对通过",
    shortBody: "今天这一组，很稳。",
  },
  breakthrough_wrong_question: {
    id: "breakthrough_wrong_question",
    lineType: "breakthrough_feedback",
    title: "突破卡点",
    body: "这道错题不是被跳过了，是被你慢慢拿下了。",
    shortTitle: "卡点通过",
    shortBody: "这次，真的会了。",
  },
  breakthrough_three_wrong_questions: {
    id: "breakthrough_three_wrong_questions",
    lineType: "breakthrough_feedback",
    title: "突破卡点",
    body: "连续三道错题被解开，卡住的地方正在松动。",
    shortTitle: "卡点通过",
    shortBody: "这次，真的会了。",
  },
  breakthrough_knowledge_mastered: {
    id: "breakthrough_knowledge_mastered",
    lineType: "breakthrough_feedback",
    title: "掌握确认",
    body: "这个知识点，已经从错题队列毕业了。",
  },
  breakthrough_delayed_variation_twice: {
    id: "breakthrough_delayed_variation_twice",
    lineType: "breakthrough_feedback",
    title: "掌握确认",
    body: "延迟变式也能连续答对，这个卡点已经被你真正接住了。",
  },
};

export const highlightFeedbackIds = [
  "highlight_all_correct",
  "highlight_quiz_all_correct",
  "highlight_consecutive_all_correct",
] as const satisfies readonly FeedbackRewardId[];

export const breakthroughFeedbackIds = [
  "breakthrough_wrong_question",
  "breakthrough_three_wrong_questions",
  "breakthrough_knowledge_mastered",
  "breakthrough_delayed_variation_twice",
] as const satisfies readonly FeedbackRewardId[];
