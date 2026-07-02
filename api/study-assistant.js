const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const TOPIK_SOURCES = [
  "TOPIK official public sample questions and test information",
  "National Institute for International Education TOPIK guide",
  "Publicly available TOPIK I / TOPIK II question-type descriptions"
];

const IELTS_SOURCES = [
  "IELTS official sample questions and test format",
  "British Council / IELTS public preparation materials",
  "Public IELTS Academic and General Training task descriptions"
];

function send(res, status, payload) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

function compact(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function getExamLabel(settings = {}) {
  if (settings.exam === "TOPIK") return `TOPIK ${settings.level || "I"}${settings.targetGrade ? ` target grade ${settings.targetGrade}` : ""}`;
  if (settings.exam === "IELTS") return `IELTS ${settings.level === "II" ? "General Training" : "Academic"}`;
  return compact(settings.customExamName || settings.studyContent, "custom study goal");
}

function sourceList(settings = {}) {
  if (settings.exam === "IELTS") return IELTS_SOURCES;
  if (settings.exam === "TOPIK") return TOPIK_SOURCES;
  return ["User-provided study content", "Public source descriptions for the selected study goal"];
}

function normalizeQuestion(item = {}) {
  const options = Array.isArray(item.options) ? item.options.map(option => compact(option)).filter(Boolean).slice(0, 4) : [];
  const answer = Number(item.answer);
  return {
    stem: compact(item.stem || item.question),
    options,
    answer: Number.isInteger(answer) ? answer : -1,
    explanation: compact(item.explanation || item.reason),
    source: compact(item.source || item.type || "Generated exam-type practice"),
    skill: compact(item.skill || item.questionType || ""),
    reviewStatus: "pending"
  };
}

function hasDuplicateOptions(options = []) {
  return new Set(options.map(option => option.toLowerCase())).size !== options.length;
}

function requestedQuestionCount(settings = {}) {
  const count = Number(settings.practiceRequest?.requestedQuestionCount || 5);
  if ([5, 10, 15, 20].includes(count)) return count;
  return Math.min(20, Math.max(5, count || 5));
}

function inferQuestionType(question = {}, settings = {}) {
  const text = `${question.stem} ${question.explanation} ${question.source}`.toLowerCase();
  const category = settings.practiceRequest?.category;
  if (settings.exam === "IELTS") {
    if (category === "listening") return "ielts_listening";
    if (category === "reading") return "ielts_reading";
    if (category === "writing") return "ielts_writing";
    if (category === "speaking") return "ielts_speaking";
    if (/listening|audio|speaker|form completion/.test(text)) return "ielts_listening";
    if (/reading|passage|paragraph|synonym|detail/.test(text)) return "ielts_reading";
    if (/writing|task 1|task 2|thesis|letter/.test(text)) return "ielts_writing";
    if (/speaking|cue card|part 2|fluency/.test(text)) return "ielts_speaking";
    return "ielts_general";
  }
  if (settings.exam === "TOPIK" && settings.level === "II") {
    if (category === "listening") return "topik2_listening";
    if (category === "reading") return "topik2_reading";
    if (category === "writing") return "topik2_writing";
    if (category === "vocab" || category === "grammar") return "topik2_grammar";
    if (/듣기|listening|화자|의도|말투|audio/.test(text)) return "topik2_listening";
    if (/문법|grammar|어미|지만|으니까|도록|거나/.test(text)) return "topik2_grammar";
    if (/쓰기|writing|그래프|자료|개요/.test(text)) return "topik2_writing";
    if (/읽기|reading|중심|글|문장|빈칸|연결|장문/.test(text)) return "topik2_reading";
    return "topik2_general";
  }
  if (settings.exam === "TOPIK") return "topik1_foundation";
  return "general_practice";
}

function reviewQuestion(item = {}, settings = {}) {
  const question = normalizeQuestion(item);
  const issues = [];
  if (!question.stem || question.stem.length < 8) issues.push("题干过短或为空");
  if (question.options.length !== 4) issues.push("选项必须为4个");
  if (hasDuplicateOptions(question.options)) issues.push("选项重复");
  if (question.answer < 0 || question.answer >= question.options.length) issues.push("答案索引无效");
  if (!question.explanation || question.explanation.length < 12) issues.push("解析过短");
  if (!question.source || question.source.length < 4) issues.push("题型来源不清楚");
  if (question.options.some(option => option.length > 90)) issues.push("选项过长，不适合当前选择题UI");
  if (/all of the above|none of the above|以上皆是|以上都不是/i.test(question.options.join(" "))) issues.push("选项不够稳定");

  const questionType = inferQuestionType(question, settings);
  const passed = issues.length === 0;
  return {
    ...question,
    questionType,
    reviewStatus: passed ? "passed" : "rejected",
    reviewIssues: issues
  };
}

function reviewPracticeSet(practice = {}, settings = {}, source = "generated") {
  const targetCount = requestedQuestionCount(settings);
  const fallback = fallbackPractice(settings);
  const reviewed = (practice.questions || []).map(question => reviewQuestion(question, settings));
  const passed = reviewed.filter(question => question.reviewStatus === "passed");
  const fallbackReviewed = fallback.questions.map(question => ({
    ...reviewQuestion(question, settings),
    reviewStatus: "fallback_passed",
    reviewIssues: []
  }));
  const merged = source === "fallback" ? fallbackReviewed.slice(0, targetCount) : [...passed, ...fallbackReviewed].slice(0, targetCount);
  return {
    ...fallback,
    ...practice,
    questions: merged,
    quality: {
      totalGenerated: reviewed.length,
      requested: targetCount,
      passed: passed.length,
      rejected: reviewed.length - passed.length,
      fallbackUsed: source === "fallback" || merged.some(question => question.reviewStatus === "fallback_passed")
    },
    sources: practice.sources?.length ? practice.sources : fallback.sources
  };
}

function fallbackPractice(settings = {}) {
  const request = settings.practiceRequest || {};
  const exam = settings.exam || request.exam || "TOPIK";
  const level = settings.level || request.level || "I";
  const category = request.category || "vocab";
  const taskTitle = compact(request.taskTitle, "系统练习");
  const examLabel = getExamLabel({ ...settings, exam, level, targetGrade: request.targetGrade || settings.targetGrade });

  if (exam === "IELTS") {
    return {
      questions: [
        {
          stem: "In an IELTS Reading task, which action best helps answer a detail question efficiently?",
          options: ["Read every paragraph aloud", "Match keywords and likely synonyms before scanning", "Translate the full passage first", "Skip the question if the word is unfamiliar"],
          answer: 1,
          explanation: "IELTS Reading detail questions usually rely on keyword location and synonym recognition, not full translation.",
          source: "IELTS public reading task format"
        },
        {
          stem: "For IELTS Listening form completion, what should you predict before the audio starts?",
          options: ["The speaker's accent only", "The grammar and type of missing word", "The exact final answer", "The score band"],
          answer: 1,
          explanation: "Predicting whether the gap needs a name, number, noun, or adjective makes listening more targeted.",
          source: "IELTS public listening task format"
        },
        {
          stem: "Which Task 2 thesis is the clearest?",
          options: ["This topic is very important.", "I will discuss many things.", "I partly agree because the policy helps access but may reduce quality.", "People have different ideas."],
          answer: 2,
          explanation: "A strong thesis states a position and previews the reasoning.",
          source: "IELTS public writing task format"
        },
        {
          stem: "In Speaking Part 2, what is the best way to use preparation time?",
          options: ["Write full sentences", "List 3-4 prompts and one example", "Memorize a model answer", "Ignore the cue card"],
          answer: 1,
          explanation: "Short prompts help maintain fluency while still covering the cue card.",
          source: "IELTS public speaking task format"
        },
        {
          stem: "Which habit most directly improves IELTS score tracking?",
          options: ["Only count study hours", "Record task type, score, error reason, and next action", "Repeat the same easy question set", "Avoid reviewing mistakes"],
          answer: 1,
          explanation: "The system needs task results and error reasons to adjust tomorrow's focus.",
          source: "Study planner diagnostic rule"
        }
      ],
      title: `${examLabel} · ${taskTitle}`,
      sources: sourceList({ exam })
    };
  }

  if (exam === "TOPIK" && level === "II") {
    const writingQuestion = category === "writing"
      ? {
          stem: "TOPIK II 写作准备中，哪一个句子最适合作为图表题的概括开头？",
          options: ["이 그래프는 아무 내용입니다.", "이 자료는 기간에 따른 변화 양상을 보여 준다.", "저는 이 문제가 어렵다고 생각합니다.", "그래서 친구를 만났습니다."],
          answer: 1,
          explanation: "图表写作开头应先客观说明资料展示的变化或比较对象。",
          source: "TOPIK II public writing task type"
        }
      : {
          stem: "TOPIK II 阅读中，遇到长句时第一步应该先看什么？",
          options: ["所有生词", "谓语和连接语尾", "答案选项的长度", "标点数量"],
          answer: 1,
          explanation: "TOPIK II 长句理解常依赖谓语、连接语尾和前后逻辑关系。",
          source: "TOPIK II public reading question type"
        };
    return {
      questions: [
        {
          stem: "다음 문장에서 빈칸에 알맞은 것을 고르십시오. 시간이 없었___ 숙제를 끝냈어요.",
          options: ["지만", "으니까", "거나", "도록"],
          answer: 0,
          explanation: "前后是让步关系：虽然没有时间，但还是完成了作业，用 -지만。",
          source: "TOPIK II grammar connector type"
        },
        {
          stem: "다음 중 글의 중심 생각을 찾을 때 가장 먼저 확인할 부분은 무엇입니까?",
          options: ["첫 문장과 마지막 문장", "모르는 단어의 개수", "문장의 글자 수", "보기의 번호"],
          answer: 0,
          explanation: "TOPIK 阅读主旨题常通过首尾句和重复关键词定位中心。",
          source: "TOPIK II reading main-idea type"
        },
        writingQuestion,
        {
          stem: "듣기에서 화자의 의도를 묻는 문제를 풀 때 가장 중요한 단서는 무엇입니까?",
          options: ["배경 음악", "마지막 행동 제안과 말투", "문장의 길이", "낯선 단어 하나"],
          answer: 1,
          explanation: "意图题通常看说话人的建议、请求、态度和最后的行动方向。",
          source: "TOPIK II listening intent type"
        },
        {
          stem: "오답을 복습할 때 가장 좋은 기록 방식은 무엇입니까?",
          options: ["정답만 외운다", "틀린 이유와 판단 근거를 함께 적는다", "문제를 바로 삭제한다", "해설을 읽지 않는다"],
          answer: 1,
          explanation: "系统需要错因和判断依据，才能生成下一轮同类变式题。",
          source: "Study planner error review rule"
        }
      ],
      title: `${examLabel} · ${taskTitle}`,
      sources: sourceList({ exam })
    };
  }

  return {
    questions: [
      { stem: "저___ 학생입니다.", options: ["는", "가", "를", "에"], answer: 0, explanation: "句子是在介绍“我”这个主题，用 저는。", source: "TOPIK I grammar foundation type" },
      { stem: "누가 왔어요? 민수___ 왔어요.", options: ["는", "가", "를", "도"], answer: 1, explanation: "回答“谁来了”，强调主语，用 민수가。", source: "TOPIK I particle type" },
      { stem: "이 책___ 아주 재미있어요.", options: ["을", "이", "에", "와"], answer: 1, explanation: "“这本书”是形容词 재미있다 的主语，用 이。", source: "TOPIK I sentence structure type" },
      { stem: "저___ 커피를 좋아해요.", options: ["는", "가", "를", "에서"], answer: 0, explanation: "谈论“我”的喜好，以“我”为主题，用 저는。", source: "TOPIK I topic particle type" },
      { stem: "오늘 날씨___ 좋아요.", options: ["를", "가", "에게", "부터"], answer: 1, explanation: "날씨 是 좋아요 的主语，用 가。", source: "TOPIK I adjective subject type" }
    ],
    title: `${examLabel} · ${taskTitle}`,
    sources: sourceList({ exam })
  };
}

function fallbackPlan(settings = {}) {
  const days = settings.studyDays?.length ? settings.studyDays : ["mon", "tue", "wed", "thu", "fri"];
  const categories = settings.exam === "TOPIK" && settings.level === "II"
    ? ["listening", "writing", "reading", "review"]
    : settings.exam === "IELTS"
      ? ["listening", "reading", "writing", "speaking", "review"]
      : ["reading", "vocab", "review"];
  const tasks = days.flatMap((day, dayIndex) => categories.slice(0, 2).map((category, index) => ({
    day,
    start: index ? "19:30" : "11:00",
    end: index ? "20:10" : "11:40",
    category,
    title: `${getExamLabel(settings)} ${category} 练习`,
    note: "按当前目标生成同型训练，完成后由系统记录正确率。",
    standards: ["完成本组系统题", "记录正确率", "错题写入复习队列", "完成后可补一句反思"]
  })));
  return {
    tasks: tasks.slice(0, 14),
    tomorrowFocus: "先完成一组按考试目标生成的同型题，再根据错题安排明日复习。"
  };
}

function buildPracticePrompt(settings = {}) {
  const request = settings.practiceRequest || {};
  const count = requestedQuestionCount(settings);
  return [
    "You are a careful exam practice generator for a study planner.",
    "Generate original practice questions that follow public official sample-question types and user-provided context.",
    "Do not reproduce a copyrighted full exam paper or claim unverifiable sources.",
    "Return strict JSON only with this shape: {\"questions\":[{\"stem\":\"...\",\"options\":[\"...\"],\"answer\":0,\"explanation\":\"...\",\"source\":\"...\"}],\"sources\":[\"...\"]}.",
    "Each question must have 4 options and a zero-based numeric answer.",
    `Exam: ${getExamLabel(settings)}.`,
    `Category: ${request.category || "mixed"}.`,
    `Task: ${request.taskTitle || "practice"}.`,
    `Task note: ${request.taskNote || ""}.`,
    `Weak areas: ${(settings.weak || request.weak || []).join(", ") || "unknown"}.`,
    `Standards: ${(request.standards || []).join(" / ") || "complete the set and review errors"}.`,
    `Generate exactly ${count} questions.`
  ].join("\n");
}

function parseModelJson(text = "") {
  const cleaned = String(text).trim().replace(/^```json\s*|\s*```$/g, "");
  return JSON.parse(cleaned);
}

function openAiBaseUrl() {
  return String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
}

async function callOpenAiCompatiblePractice(settings = {}) {
  const response = await fetch(`${openAiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Return strict JSON only. Do not include markdown." },
        { role: "user", content: buildPracticePrompt(settings) }
      ],
      temperature: 0.4
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  return parsed;
}

async function callOpenAiResponsesPractice(settings = {}) {
  const response = await fetch(`${openAiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: buildPracticePrompt(settings),
      temperature: 0.4
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap(item => item.content || []).map(item => item.text || "").join("\n") || "";
  const parsed = parseModelJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  return parsed;
}

async function callOpenAiPractice(settings = {}) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (process.env.OPENAI_BASE_URL) return callOpenAiCompatiblePractice(settings);
  return callOpenAiResponsesPractice(settings);
}

async function handlePractice(settings = {}) {
  const aiPractice = await callOpenAiPractice(settings).catch(() => null);
  return reviewPracticeSet(aiPractice || fallbackPractice(settings), settings, aiPractice ? "generated" : "fallback");
}

async function handlePlan(settings = {}) {
  return fallbackPlan(settings);
}

async function handleResearch(settings = {}) {
  return {
    summary: `${getExamLabel(settings)} will use public sample-question types, user materials, and weak-area priorities as planning inputs.`,
    sources: sourceList(settings).map((title, index) => ({ title, url: "", note: index === 0 ? "Primary reference category" : "Reference category" }))
  };
}

async function handleVision() {
  return {
    items: [
      {
        section: "语法",
        title: "场所助词 에 / 에서",
        focus: "区分存在地点和动作发生地点",
        cause: "看到地点名词后直接选 에，未判断后面动词性质"
      }
    ]
  };
}

module.exports = async function studyAssistant(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const body = parseBody(req);
    const action = body.action || "practice";
    const settings = body.settings || {};
    if (action === "practice") return send(res, 200, await handlePractice(settings));
    if (action === "plan") return send(res, 200, await handlePlan(settings));
    if (action === "research") return send(res, 200, await handleResearch(settings));
    if (action === "vision") return send(res, 200, await handleVision(settings));
    return send(res, 400, { error: "Unsupported action" });
  } catch (error) {
    return send(res, 500, { error: "Study assistant failed", detail: error.message });
  }
};
