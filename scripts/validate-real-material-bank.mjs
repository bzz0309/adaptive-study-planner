import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const bankPath = resolve(root, "data/real-material-question-bank.sample.json");
const bank = JSON.parse(readFileSync(bankPath, "utf8"));
const errors = [];
const seenQuestionIds = new Set();

function requireText(value, label) {
  return typeof value === "string" && value.trim() ? "" : `${label} is required`;
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(Array.isArray(bank), "Question bank must be an array");

bank.forEach((set, setIndex) => {
  const setLabel = set.id || `set[${setIndex}]`;
  ["id", "sourceType", "sourceTitle", "exam", "level", "category", "title", "skillLabel", "trainingPoint"].forEach(key => {
    const error = requireText(set[key], `${setLabel}.${key}`);
    if (error) errors.push(error);
  });
  check(Array.isArray(set.questions) && set.questions.length > 0, `${setLabel}.questions must not be empty`);

  (set.questions || []).forEach((question, questionIndex) => {
    const label = `${setLabel}.questions[${questionIndex}]`;
    ["materialQuestionId", "materialImage", "stem", "stemZh", "passageZh", "answerZh", "explanationZh", "source"].forEach(key => {
      const error = requireText(question[key], `${label}.${key}`);
      if (error) errors.push(error);
    });

    if (question.materialQuestionId) {
      check(!seenQuestionIds.has(question.materialQuestionId), `${label}.materialQuestionId is duplicated`);
      seenQuestionIds.add(question.materialQuestionId);
    }

    check(Array.isArray(question.options) && question.options.length === 4, `${label}.options must contain 4 options`);
    check(Array.isArray(question.optionTranslations) && question.optionTranslations.length === 4, `${label}.optionTranslations must contain 4 translations`);
    check(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `${label}.answer must be a 0-based option index`);

    const imagePath = String(question.materialImage || "");
    check(imagePath.includes("/question/"), `${label}.materialImage must point to a question image`);
    check(!imagePath.includes("/block-cn/"), `${label}.materialImage must not point to block-cn explanation image`);
    check(existsSync(resolve(root, imagePath)), `${label}.materialImage file does not exist: ${imagePath}`);
  });
});

const runtimePath = resolve(root, "app.js");
const runtimeSource = readFileSync(runtimePath, "utf8");
const expectedTopik102Assets = [
  ["topik-ii-listening-102-q001", "assets/materials/topik102-listening/question/q001.png", "assets/materials/topik102-listening/audio/2-01.mp3"],
  ["topik-ii-listening-102-q002", "assets/materials/topik102-listening/question/q002.png", "assets/materials/topik102-listening/audio/2-02.mp3"],
  ["topik-ii-listening-102-q003", "assets/materials/topik102-listening/question/q003.png", "assets/materials/topik102-listening/audio/2-03.mp3"],
  ...Array.from({ length: 47 }, (_, index) => {
    const questionNumber = index + 4;
    const padded = String(questionNumber).padStart(3, "0");
    const audioNumber = String(questionNumber).padStart(2, "0");
    return [
      `topik-ii-listening-102-q${padded}`,
      `assets/materials/topik102-listening/question/q${padded}.png`,
      `assets/materials/topik102-listening/audio/2-${audioNumber}.mp3`
    ];
  })
];

expectedTopik102Assets.forEach(([id, imagePath, audioPath]) => {
  check(runtimeSource.includes(`materialQuestionId: "${id}"`), `Runtime is missing 102nd listening question: ${id}`);
  check(runtimeSource.includes(`materialImage: "${imagePath}"`), `Runtime is missing 102nd listening image path: ${imagePath}`);
  check(runtimeSource.includes(`audioSrc: "${audioPath}"`), `Runtime is missing 102nd listening audio path: ${audioPath}`);
  check(existsSync(resolve(root, imagePath)), `102nd listening image file does not exist: ${imagePath}`);
  check(existsSync(resolve(root, audioPath)), `102nd listening audio file does not exist: ${audioPath}`);
});

const listeningAudioHashes = expectedTopik102Assets.map(([, , audioPath]) => {
  return createHash("sha256").update(readFileSync(resolve(root, audioPath))).digest("hex");
});
check(
  new Set(listeningAudioHashes).size === listeningAudioHashes.length,
  "102nd listening per-question audio files must be distinct"
);

check(
  runtimeSource.includes('matchTerms: ["看图听关键词", "看图与图表理解"]'),
  "102nd listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听力 · 判断下一步行动"]'),
  "102nd dialogue/action listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听内容一致"]'),
  "102nd content-match listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听后复述"]'),
  "102nd main-idea listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听说话人意图"]'),
  "102nd speaker-intent listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听职业与身份"]'),
  "102nd speaker-role listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听说话人态度"]'),
  "102nd speaker-attitude listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听主题与内容"]'),
  "102nd topic listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听说明方式"]'),
  "102nd speaking-method listening set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["听对话前文推断"]'),
  "102nd prior-context listening set must expose explicit task match terms"
);

const expectedTopik102ReadingAssets = Array.from({ length: 8 }, (_, index) => {
  const padded = String(index + 5).padStart(3, "0");
  return [
    `topik-ii-reading-102-q${padded}`,
    `assets/materials/topik102-reading/question/q${padded}.png`
  ];
});

expectedTopik102ReadingAssets.forEach(([id, imagePath]) => {
  check(runtimeSource.includes(`materialQuestionId: "${id}"`), `Runtime is missing 102nd reading question: ${id}`);
  check(runtimeSource.includes(`materialImage: "${imagePath}"`), `Runtime is missing 102nd reading image path: ${imagePath}`);
  check(existsSync(resolve(root, imagePath)), `102nd reading image file does not exist: ${imagePath}`);
});
check(
  runtimeSource.includes('matchTerms: ["通知公告阅读", "促销广告阅读", "图表信息读取"]'),
  "102nd reading set must expose explicit task match terms"
);
check(
  runtimeSource.includes('matchTerms: ["通知公告阅读", "图表信息读取", "题干关键词定位", "限时阅读"]'),
  "102nd content-check reading set must expose explicit task match terms"
);
check(
  runtimeSource.includes("const taskText = materialContextText(context);") &&
    runtimeSource.includes("matchTerms.some(term => taskText.includes(String(term)))"),
  "Runtime must route real material by the task training point"
);

if (errors.length) {
  console.error(`Real material bank validation failed: ${errors.length} issue(s)`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const questionCount = bank.reduce((total, set) => total + (set.questions?.length || 0), 0);
console.log(`Real material bank validation passed: ${bank.length} set(s), ${questionCount} question(s)`);
console.log(`TOPIK 102 runtime assets passed: ${expectedTopik102Assets.length} listening question(s), ${expectedTopik102ReadingAssets.length} reading question(s)`);
