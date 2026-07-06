import { existsSync, readFileSync } from "node:fs";
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

if (errors.length) {
  console.error(`Real material bank validation failed: ${errors.length} issue(s)`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const questionCount = bank.reduce((total, set) => total + (set.questions?.length || 0), 0);
console.log(`Real material bank validation passed: ${bank.length} set(s), ${questionCount} question(s)`);
