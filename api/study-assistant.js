const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const TOPIK_SOURCES = [
  {
    title: "TOPIK 官方网站",
    url: "https://www.topik.go.kr/",
    type: "官方入口",
    note: "用于核对考试公告、等级说明和公开样题入口。"
  },
  {
    title: "国立国际教育院 NIIED · TOPIK 主管机构",
    url: "https://www.niied.go.kr/",
    type: "官方机构",
    note: "用于确认 TOPIK 主管机构与考试定位。"
  },
  {
    title: "公开样题 / 用户自有材料",
    url: "",
    type: "校准材料",
    note: "用于校准题型、难度和错题复盘；日常练习生成原创同型题。"
  },
  {
    title: "TOPIK II 训练点生成规则",
    url: "",
    type: "训练点参考",
    note: "用考试模块和能力训练点生成原创练习；训练点不是官方分类。"
  }
];

const IELTS_SOURCES = [
  {
    title: "IELTS 官方考试类型与结构",
    url: "https://ielts.org/take-a-test/test-types",
    type: "官方入口",
    note: "用于核对 Academic / General Training 的考试结构。"
  },
  {
    title: "IELTS 官方样题与备考资源",
    url: "https://ielts.org/take-a-test/preparation-resources",
    type: "公开样题",
    note: "用于校准题型和评分方向。"
  },
  {
    title: "用户自有材料 / 错题记录",
    url: "",
    type: "校准材料",
    note: "用于定位弱项并生成原创同型练习。"
  }
];

function send(res, status, payload) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const parseText = (text = "") => {
    const raw = String(text || "").trim();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch {}
    try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } catch {}
    return {};
  };
  if (Buffer.isBuffer(req.body)) return parseText(req.body.toString("utf8"));
  if (typeof req.body === "string") return parseText(req.body);
  if (typeof req.on !== "function") return {};
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", resolve);
    req.on("error", reject);
  });
  return parseText(Buffer.concat(chunks).toString("utf8"));
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
  return [
    {
      title: "用户提供的学习资料",
      url: "",
      type: "用户材料",
      note: "用于确认学习范围和练习方向。"
    },
    {
      title: "公开考试说明 / 课程说明",
      url: "",
      type: "题型参考",
      note: "用于生成原创同型练习，不替代官方材料。"
    }
  ];
}

function normalizeSource(source = {}, index = 0) {
  if (typeof source === "string") {
    return {
      title: source,
      url: "",
      type: index === 0 ? "官方入口" : "题型参考",
      note: "用于校准题型方向，生成原创同型练习。"
    };
  }
  return {
    title: compact(source.title, "题型参考来源"),
    url: compact(source.url),
    type: compact(source.type, index === 0 ? "官方入口" : "题型参考"),
    note: compact(source.note || source.reason || source.detail, "用于校准题型方向，生成原创同型练习。")
  };
}

function splitQuestionStem(item = {}) {
  const rawStem = String(item.stem || item.question || "").trim();
  const explicitInstruction = String(item.instruction || item.prompt || item.questionPrompt || "").trim();
  const explicitPassage = String(item.passage || item.sourceText || item.readingText || "").trim();
  if (explicitInstruction || explicitPassage) {
    return { instruction: explicitInstruction || rawStem, passage: explicitPassage };
  }
  const parts = rawStem.split(/\n\s*\n+/).map(part => part.trim()).filter(Boolean);
  if (parts.length > 1 && /읽고|글|내용|빈칸|중심|태도/.test(parts[0])) {
    return { instruction: parts[0], passage: parts.slice(1).join("\n\n") };
  }
  return { instruction: rawStem, passage: "" };
}

function normalizeQuestion(item = {}) {
  const options = Array.isArray(item.options) ? item.options.map(option => compact(option)).filter(Boolean).slice(0, 4) : [];
  const answer = Number(item.answer);
  const audioText = compact(item.audioText || item.audio || item.transcript);
  const content = splitQuestionStem(item);
  return {
    questionId: compact(item.questionId || item.id || ""),
    materialQuestionId: compact(item.materialQuestionId || ""),
    materialSetId: compact(item.materialSetId || ""),
    stem: compact(content.instruction),
    instruction: compact(content.instruction),
    instructionZh: compact(item.instructionZh || item.promptZh || item.questionPromptZh || ""),
    passage: compact(content.passage),
    passageZh: compact(item.passageZh || item.passageChinese || item.sourceTextZh || ""),
    stemZh: compact(item.stemZh || item.questionZh || item.stemChinese || ""),
    options,
    optionTranslations: Array.isArray(item.optionTranslations || item.optionsZh)
      ? (item.optionTranslations || item.optionsZh).map(option => compact(option)).slice(0, 4)
      : [],
    answer: Number.isInteger(answer) ? answer : -1,
    explanation: compact(item.explanation || item.reason),
    explanationZh: compact(item.explanationZh || item.explanationChinese || item.reasonZh || ""),
    answerZh: compact(item.answerZh || item.correctAnswerZh || ""),
    source: compact(item.source || item.type || "Generated exam-type practice"),
    sourceType: compact(item.sourceType || ""),
    sourceDetail: compact(item.sourceDetail || ""),
    sourceTitle: compact(item.sourceTitle || ""),
    materialSetTitle: compact(item.materialSetTitle || ""),
    materialImage: compact(item.materialImage || item.image || ""),
    skillLabel: compact(item.skillLabel || ""),
    trainingPoint: compact(item.trainingPoint || ""),
    skill: compact(item.skill || item.questionType || ""),
    audioText,
    transcript: compact(item.transcript || audioText),
    transcriptZh: compact(item.transcriptZh || item.transcriptChinese || item.audioTextZh || ""),
    reviewStatus: "pending"
  };
}

const MATERIAL_PRACTICE_BANK = [
  {
    id: "topik-i-reading-signs-v1",
    sourceType: "user-material",
    exam: "TOPIK",
    level: "I",
    category: "reading",
    title: "TOPIK I 阅读：标识与公告理解",
    skillLabel: "标识与公告理解",
    trainingPoint: "从广告、公告和便条中核对时间、对象、条件和活动信息",
    sourceTitle: "用户资料《完全掌握 TOPIK I 初级阅读》",
    sourceDetail: "标识/公告阅读样本 · 5题",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-i-reading-signs-v1-q100",
        materialImage: "assets/materials/topik1-reading/question/question-100.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读招聘广告，选择与内容不一致的一项。",
        options: ["커피전문점에서 아르바이트 학생을 구합니다.", "고등학생도 일할 수 있습니다.", "일주일에 삼일 일합니다.", "남녀 모두 일할 수 있습니다."],
        optionTranslations: ["咖啡专卖店正在招聘兼职学生。", "高中生也可以工作。", "一周工作三天。", "男女都可以工作。"],
        answer: 1,
        answerZh: "高中生也可以工作。",
        explanation: "조건은 남녀 대학생이므로 고등학생도 일할 수 있다는 말은 맞지 않습니다.",
        explanationZh: "广告条件写的是“男女大学生”，所以“高中生也可以工作”与原文不一致。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.84 · 标识阅读"
      },
      {
        materialQuestionId: "topik-i-reading-signs-v1-q101",
        materialImage: "assets/materials/topik1-reading/question/question-101.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读音乐会海报，选择与内容不一致的一项。",
        options: ["서울 벚꽃 음악회는 3일 동안 열립니다.", "서울 벚꽃 음악회는 하루에 두 번씩 열립니다.", "서울 벚꽃 음악회는 4월에 열립니다.", "서울 벚꽃 음악회는 누구나 참여할 수 있습니다."],
        optionTranslations: ["首尔樱花音乐会举办3天。", "首尔樱花音乐会每天举行两场。", "首尔樱花音乐会在4月举行。", "首尔樱花音乐会任何人都可以参加。"],
        answer: 1,
        answerZh: "首尔樱花音乐会每天举行两场。",
        explanation: "날짜별 공연 횟수가 다르므로 하루에 두 번씩 열린다는 말은 맞지 않습니다.",
        explanationZh: "海报中三天的场次不同，并不是每天都有两场，所以该选项不符合内容。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.85 · 标识阅读"
      },
      {
        materialQuestionId: "topik-i-reading-signs-v1-q102",
        materialImage: "assets/materials/topik1-reading/question/question-102.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读促销信息，选择与内容不一致的一项。",
        options: ["수박을 시청 앞에서 팝니다.", "수박을 싸게 팝니다.", "수박을 먹어 볼 수 있습니다.", "5월 11일에는 열리지 않습니다."],
        optionTranslations: ["在市政府前卖西瓜。", "西瓜卖得便宜。", "可以试吃西瓜。", "5月11日不举办。"],
        answer: 3,
        answerZh: "5月11日不举办。",
        explanation: "기간은 5월 10일부터 3일 동안이므로 5월 11일에도 행사가 열립니다.",
        explanationZh: "活动从5月10日起连续3天，所以5月11日也会举办，该选项不符合内容。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.86 · 标识阅读"
      },
      {
        materialQuestionId: "topik-i-reading-signs-v1-q103",
        materialImage: "assets/materials/topik1-reading/question/question-103.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读免费韩文教室公告，选择与内容不一致的一项。",
        options: ["한글 수업은 10월부터 있습니다.", "9월 20일까지 신청해야 합니다.", "외국인도 참여할 수 있습니다.", "이 수업은 무료입니다."],
        optionTranslations: ["韩文课从10月开始。", "需要在9月20日前申请。", "外国人也可以参加。", "这门课是免费的。"],
        answer: 2,
        answerZh: "外国人也可以参加。",
        explanation: "대상은 한글을 배우고 싶은 성인 남녀이며, 외국인이라고 쓰여 있지 않습니다.",
        explanationZh: "公告对象是“想学习韩文的成年男女”，没有写外国人也可以参加，所以该选项不符合内容。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.87 · 标识阅读"
      },
      {
        materialQuestionId: "topik-i-reading-signs-v1-q104",
        materialImage: "assets/materials/topik1-reading/question/question-104.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读便条内容，选择与内容不一致的一项。",
        options: ["제인 씨는 오늘 학교에 안 왔습니다.", "제인 씨는 어제 학교에 왔습니다.", "밍밍 씨는 제인 씨를 걱정합니다.", "내일은 시험이 있습니다."],
        optionTranslations: ["珍妮今天没有来学校。", "珍妮昨天来了学校。", "明明担心珍妮。", "明天有考试。"],
        answer: 1,
        answerZh: "珍妮昨天来了学校。",
        explanation: "메모에는 이틀 동안 학교에 안 왔다고 되어 있습니다.",
        explanationZh: "便条问“为什么这两天没有来学校”，所以“昨天来了学校”与内容不一致。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.88 · 标识阅读"
      }
    ]
  }
];

function stableHashText(value = "") {
  return Array.from(String(value)).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 0);
}

function materialRequestText(settings = {}) {
  const request = settings.practiceRequest || {};
  return [
    request.title,
    request.task?.title,
    request.task?.note,
    request.category
  ].filter(Boolean).join(" ");
}

function materialQuestionText(question = {}) {
  return [
    question.materialQuestionId,
    question.instruction,
    question.stem,
    question.stemZh,
    question.passage,
    question.passageZh,
    question.transcript,
    question.transcriptZh,
    question.explanation,
    question.explanationZh,
    question.source
  ].filter(Boolean).join(" ");
}

function materialPriorityScore(question = {}, settings = {}) {
  const requestText = materialRequestText(settings);
  const questionText = materialQuestionText(question);
  const rules = [
    {
      request: /数字|时间|日期|价格|数量|几点|几月|多少|number|time|date|price/i,
      question: /数字|时间|日期|价格|数量|월|일|시|분|원|가격|시간|날짜|얼마|몇/i
    },
    {
      request: /否定|时态|过去|未来|将来|tense|negative/i,
      question: /否定|时态|过去|未来|将来|안\s|못|않|았|었|겠|예정/i
    },
    {
      request: /下一步|行动|请求|建议|做什么|action|next/i,
      question: /下一步|行动|请求|建议|做什么|주세요|부탁|요청|보내|가다|오다/i
    },
    {
      request: /原因|理由|为什么|reason|why/i,
      question: /原因|理由|为什么|왜|때문|이유/i
    },
    {
      request: /图|图表|看图|picture|graph/i,
      question: /图|图表|看图|그림|그래프|사진/i
    },
    {
      request: /复述|听后|原文|retell|summary/i,
      question: /复述|听后|原文|transcript|다시|요약/i
    }
  ];
  return rules.reduce((score, rule) => {
    if (!rule.request.test(requestText)) return score;
    return score + (rule.question.test(questionText) ? 10 : 0);
  }, 0);
}

function orderedMaterialQuestionsForSettings(questions = [], settings = {}) {
  const uniqueQuestions = [];
  const seen = new Set();
  questions.forEach(question => {
    const key = question.materialQuestionId || question.questionId || question.materialImage || question.stem;
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueQuestions.push(question);
  });
  if (uniqueQuestions.length <= 1) return uniqueQuestions;
  const rotation = stableHashText(materialRequestText(settings)) % uniqueQuestions.length;
  return uniqueQuestions
    .map((question, index) => ({
      question,
      index,
      score: materialPriorityScore(question, settings)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return ((a.index + rotation) % uniqueQuestions.length) - ((b.index + rotation) % uniqueQuestions.length);
    })
    .map(item => item.question);
}

function materialPractice(settings = {}) {
  const request = settings.practiceRequest || {};
  const match = MATERIAL_PRACTICE_BANK.find(item =>
    item.exam === (settings.exam || request.exam) &&
    item.level === (settings.level || request.level) &&
    item.category === request.category
  );
  if (!match) return null;
  const count = requestedQuestionCount(settings);
  const questions = orderedMaterialQuestionsForSettings(match.questions, settings);
  return {
    title: match.title,
    questions: questions.slice(0, count).map(question => ({
      ...question,
      materialSetId: match.id,
      materialSetTitle: match.title,
      sourceType: match.sourceType,
      sourceTitle: match.sourceTitle,
      sourceDetail: match.sourceDetail,
      skillLabel: match.skillLabel,
      trainingPoint: match.trainingPoint,
      questionType: question.questionType || match.skillLabel
    })),
    sources: [{ title: match.sourceTitle, type: "用户资料", note: "作为真实题库样板题来源。" }]
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
  const text = `${question.stem} ${question.passage || ""} ${question.explanation} ${question.source}`.toLowerCase();
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
  if (settings.exam === "TOPIK") {
    const topikPrefix = settings.level === "II" ? "topik2" : "topik1";
    if (category === "listening") return `${topikPrefix}_listening`;
    if (category === "reading") return `${topikPrefix}_reading`;
    if (category === "writing") return `${topikPrefix}_writing`;
    if (category === "vocab" || category === "grammar") return `${topikPrefix}_grammar`;
    if (/듣기|listening|화자|의도|말투|audio/.test(text)) return `${topikPrefix}_listening`;
    if (/문법|grammar|어미|지만|으니까|도록|거나/.test(text)) return `${topikPrefix}_grammar`;
    if (/쓰기|writing|그래프|자료|개요/.test(text)) return `${topikPrefix}_writing`;
    if (/읽기|reading|중심|글|문장|빈칸|연결|장문/.test(text)) return `${topikPrefix}_reading`;
    return `${topikPrefix}_general`;
  }
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
  if (/listening/.test(questionType)) {
    const optionsText = question.options.join("");
    if (!question.audioText || question.audioText.length < 18) issues.push("听力题缺少完整可播放脚本");
    if (/[_＿]{2,}|（\s*）|\(\s*\)|빈칸|알맞은 것/i.test(question.stem)) issues.push("听力题不能是语法填空");
    if (question.options.every(option => /^[가-힣]{1,3}$/.test(option.trim()))) issues.push("听力题选项过短，像助词或语法题");
    if (/^[는이가을를에도만은]+$/.test(optionsText)) issues.push("听力题不能用助词选项");
  }
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
  const count = requestedQuestionCount(settings);
  const taskTitle = compact(request.taskTitle, "系统练习");
  const examLabel = getExamLabel({ ...settings, exam, level, targetGrade: request.targetGrade || settings.targetGrade });

  if (exam === "TOPIK" && level === "I" && category === "listening") {
    const withAudio = (audioText, transcriptZh, question) => ({
      audioText,
      transcript: audioText,
      transcriptZh,
      questionType: "topik1_listening",
      ...question,
    });
    return {
      questions: [
        withAudio("여자: 준호 씨, 오늘 한국어 수업에 와요? 남자: 네, 두 시에 교실에 가요. 여자: 조금 일찍 오세요. 남자: 네, 알겠습니다.", "女：俊浩，你今天来上韩语课吗？男：是的，我两点去教室。女：请稍微早点来。男：好的，知道了。", {
          stem: "남자는 몇 시에 교실에 갑니까?",
          stemZh: "男生几点去教室？",
          options: ["한 시", "두 시", "세 시", "네 시"],
          optionTranslations: ["一点", "两点", "三点", "四点"],
          answer: 1,
          answerZh: "两点",
          explanation: "남자는 두 시에 교실에 간다고 했습니다.",
          explanationZh: "男生说两点去教室，所以答案是“两点”。",
          source: "TOPIK I 听力：时间信息",
        }),
        withAudio("남자: 수미 씨, 지금 어디에 가요? 여자: 우체국에 가요. 편지를 보내려고 해요. 남자: 우체국은 은행 옆에 있어요. 여자: 네, 고마워요.", "男：秀美，你现在去哪里？女：我去邮局，想寄信。男：邮局在银行旁边。女：好的，谢谢。", {
          stem: "여자는 어디에 갑니까?",
          stemZh: "女生去哪里？",
          options: ["은행", "우체국", "도서관", "병원"],
          optionTranslations: ["银行", "邮局", "图书馆", "医院"],
          answer: 1,
          answerZh: "邮局",
          explanation: "여자는 편지를 보내려고 우체국에 간다고 했습니다.",
          explanationZh: "女生说为了寄信要去邮局，所以答案是“邮局”。",
          source: "TOPIK I 听力：地点信息",
        }),
        withAudio("여자: 밖에 비가 많이 와요. 우산을 가져가세요. 남자: 우산이 어디에 있어요? 여자: 문 옆에 있어요. 남자: 네, 가져갈게요.", "女：外面雨下得很大，请带伞。男：伞在哪里？女：在门旁边。男：好的，我会带上。", {
          stem: "여자는 남자에게 무엇을 가져가라고 했습니까?",
          stemZh: "女生让男生带什么？",
          options: ["우산", "가방", "책", "모자"],
          optionTranslations: ["雨伞", "包", "书", "帽子"],
          answer: 0,
          answerZh: "雨伞",
          explanation: "여자는 비가 오니까 우산을 가져가라고 했습니다.",
          explanationZh: "女生因为下雨让男生带伞，所以答案是“雨伞”。",
          source: "TOPIK I 听力：物品信息",
        }),
        withAudio("남자: 학교에 어떻게 가요? 여자: 저는 버스를 타고 가요. 집 앞에서 12번 버스를 타면 돼요. 남자: 시간이 얼마나 걸려요? 여자: 십 분쯤 걸려요.", "男：你怎么去学校？女：我坐公交车去。在家门口坐12路公交车就可以。男：要花多长时间？女：大约十分钟。", {
          stem: "여자는 학교에 어떻게 갑니까?",
          stemZh: "女生怎么去学校？",
          options: ["걸어서", "버스로", "지하철로", "택시로"],
          optionTranslations: ["步行", "坐公交车", "坐地铁", "坐出租车"],
          answer: 1,
          answerZh: "坐公交车",
          explanation: "여자는 버스를 타고 학교에 간다고 했습니다.",
          explanationZh: "女生说自己坐公交车去学校，所以答案是“坐公交车”。",
          source: "TOPIK I 听力：交通方式",
        }),
        withAudio("여자: 한식당입니다. 무엇을 도와드릴까요? 남자: 오늘 저녁 일곱 시에 세 명 자리를 예약하고 싶어요. 여자: 네, 창가 자리로 준비하겠습니다. 남자: 감사합니다.", "女：这里是韩餐厅，有什么可以帮您？男：我想预约今晚七点的三人座。女：好的，会为您准备靠窗的位置。男：谢谢。", {
          stem: "대화 내용과 같은 것을 고르십시오.",
          stemZh: "请选择与对话内容一致的一项。",
          options: ["남자는 세 명 자리를 예약합니다", "남자는 점심에 식당에 갑니다", "창가 자리는 없습니다", "예약 시간은 여덟 시입니다"],
          optionTranslations: ["男生预约三人座", "男生中午去餐厅", "没有靠窗的位置", "预约时间是八点"],
          answer: 0,
          answerZh: "男生预约三人座",
          explanation: "남자는 오늘 저녁 일곱 시에 세 명 자리를 예약했습니다.",
          explanationZh: "男生预约了今晚七点的三人座，所以第一项与对话一致。",
          source: "TOPIK I 听力：内容一致",
        }),
      ].slice(0, count),
      sources: [`${examLabel} listening beginner dialogue fallback`, "TOPIK I listening structure reference", taskTitle].filter(Boolean),
    };
  }

  if (exam === "TOPIK" && level === "II" && category === "listening") {
    const listeningScript = "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.";
    const listeningScriptZh = "男：秀珍，我今天可能去不了社团会议了。突然打工时间变了。女：是吗？那请你明天上午之前把意见用短信发给我吧。我会在会议上替你说。男：谢谢。我会整理好关于海报设计的意见发过去。";
    const withAudio = (audioText, transcriptZh, question) => ({
      audioText,
      transcript: audioText,
      transcriptZh,
      questionType: "topik2_listening",
      ...question,
    });
    return {
      questions: [
        withAudio(listeningScript, listeningScriptZh, {
          stem: "남자가 오늘 동아리 회의에 못 가는 이유는 무엇입니까?",
          stemZh: "男生今天不能参加社团会议的原因是什么？",
          options: ["포스터를 아직 만들지 못해서", "아르바이트 시간이 바뀌어서", "의견을 정리하지 못해서", "내일 오전에 약속이 있어서"],
          optionTranslations: ["因为还没做完海报", "因为打工时间变了", "因为还没整理好意见", "因为明天上午有约"],
          answer: 1,
          explanation: "남자는 갑자기 아르바이트 시간이 바뀌어서 오늘 동아리 회의에 못 간다고 말했습니다.",
          explanationZh: "男生说自己突然打工时间变了，所以今天不能去社团会议。",
          answerZh: "因为打工时间变了",
          source: "TOPIK II listening reason type"
        }),
        withAudio("여자: 지훈 씨, 오늘 스터디는 어디에서 해요? 남자: 원래 도서관에서 하려고 했는데 자리가 없어서 학생회관 2층에서 해요. 여자: 알겠어요. 여섯 시까지 갈게요.", "女：志勋，今天学习小组在哪里进行？男：原来想在图书馆进行，但因为没有座位，改在学生会馆二楼。女：知道了，我会在六点前到。", {
          stem: "오늘 스터디는 어디에서 합니까?",
          stemZh: "今天的学习小组在哪里进行？",
          options: ["도서관", "학생회관 2층", "강의실", "식당"],
          optionTranslations: ["图书馆", "学生会馆二楼", "教室", "食堂"],
          answer: 1,
          explanation: "남자는 도서관에 자리가 없어서 학생회관 2층에서 스터디를 한다고 했습니다.",
          explanationZh: "男生说图书馆没有座位，所以学习小组改在学生会馆二楼。",
          answerZh: "学生会馆二楼",
          source: "TOPIK II listening place type"
        }),
        withAudio("남자: 민지 씨, 발표 연습은 다 했어요? 여자: 아직 못 했어요. 오늘 세 시에 204호에서 같이 연습할래요? 남자: 좋아요. 제가 발표 자료를 가져갈게요.", "男：敏智，发表练习都做完了吗？女：还没有。今天三点在204教室一起练习好吗？男：好，我会带发表资料过去。", {
          stem: "두 사람은 어디에서 발표 연습을 합니까?",
          stemZh: "两个人在哪里进行发表练习？",
          options: ["204호", "도서관", "학생회관", "회의실"],
          optionTranslations: ["204教室", "图书馆", "学生会馆", "会议室"],
          answer: 0,
          explanation: "여자는 오늘 세 시에 204호에서 같이 연습하자고 했습니다.",
          explanationZh: "女生提议今天三点在204教室一起练习。",
          answerZh: "204教室",
          source: "TOPIK II listening place detail type"
        }),
        withAudio("남자: 예약한 김민수인데요. 창가 자리를 부탁드렸어요. 여자: 네, 네 분 자리로 준비했습니다. 일곱 시까지 오시면 됩니다. 남자: 감사합니다. 조금 일찍 가겠습니다.", "男：我是预约过的金民秀。我之前要求了靠窗的位置。女：好的，已经准备了四人座。七点前过来就可以。男：谢谢，我会稍微早点到。", {
          stem: "대화 내용과 같은 것을 고르십시오.",
          stemZh: "请选择与对话内容一致的一项。",
          options: ["남자는 식당 자리를 예약했습니다", "두 사람만 식사할 것입니다", "남자는 일곱 시 이후에 갑니다", "창가 자리는 준비할 수 없습니다"],
          optionTranslations: ["男生预约了餐厅座位", "只有两个人用餐", "男生七点以后到", "无法准备靠窗座位"],
          answer: 0,
          explanation: "남자는 예약한 사람이라고 말했고 창가 자리도 부탁했다고 했습니다.",
          explanationZh: "男生说明自己已经预约，并确认了靠窗的四人座。",
          answerZh: "男生预约了餐厅座位",
          source: "TOPIK II listening matching type"
        }),
        withAudio("여자: 실례합니다. 조금 전에 지하철에서 검은색 지갑을 잃어버렸어요. 역무원: 어느 칸에 타셨어요? 여자: 세 번째 칸이었고, 지갑 안에 학생증이 있어요.", "女：不好意思，我刚才在地铁里丢了一个黑色钱包。站务员：您坐的是哪一节车厢？女：第三节，钱包里有学生证。", {
          stem: "여자가 역무원에게 말하는 목적은 무엇입니까?",
          stemZh: "女生对站务员说这些话的目的是什么？",
          options: ["지갑을 잃어버렸다고 신고하려고", "지하철 시간을 확인하려고", "학생증을 새로 만들려고", "세 번째 칸을 예약하려고"],
          optionTranslations: ["为了报告钱包丢失", "为了确认地铁时间", "为了补办学生证", "为了预约第三节车厢"],
          answer: 0,
          explanation: "여자는 지하철에서 잃어버린 검은색 지갑을 찾기 위해 역무원에게 말하고 있습니다.",
          explanationZh: "女生是在向站务员报告自己在地铁上丢失了黑色钱包。",
          answerZh: "为了报告钱包丢失",
          source: "TOPIK II listening purpose type"
        })
      ],
      title: `${examLabel} · ${taskTitle}`,
      sources: sourceList({ exam })
    };
  }

  if (exam === "TOPIK" && level === "II" && category === "reading") {
    return {
      questions: [
        {
          stem: "다음을 읽고 글의 중심 생각을 고르십시오.\n\n최근에는 도서관에 직접 가지 않고도 전자책을 빌릴 수 있다. 이용자는 원하는 시간에 책을 읽을 수 있고, 도서관은 공간 부족 문제를 줄일 수 있다. 그러나 전자책 이용이 어려운 사람을 위한 안내도 함께 마련해야 한다.",
          instructionZh: "阅读原文，选择最能概括文章中心思想的一项。",
          passageZh: "最近，即使不亲自去图书馆，也可以借阅电子书。使用者可以在想要的时间读书，图书馆也能缓解空间不足的问题。不过，也应当为不熟悉电子书服务的人提供相应指导。",
          stemZh: "阅读短文，选择中心思想。短文介绍电子书借阅的便利和图书馆空间优势，同时指出应为不熟悉电子服务的人提供帮助。",
          options: ["전자책 서비스의 장점과 보완점", "도서관 건물을 크게 짓는 방법", "종이책을 모두 없애야 하는 이유", "책을 빨리 읽는 새로운 기술"],
          optionTranslations: ["电子书服务的优点与需要完善之处", "扩建图书馆建筑的方法", "应该取消所有纸质书的理由", "快速阅读的新技术"],
          answer: 0,
          answerZh: "电子书服务的优点与需要完善之处",
          explanation: "글은 전자책의 편리함과 공간 절약 효과를 말한 뒤 이용 안내가 필요하다는 보완점도 제시합니다.",
          explanationZh: "文章先说明电子书便利、节省空间，最后补充需要帮助不熟悉电子服务的人，因此主旨是优点与完善方向。",
          source: "TOPIK II 阅读主旨题型"
        },
        {
          stem: "다음을 읽고 내용과 같은 것을 고르십시오.\n\n시민 강좌 신청 안내\n신청 기간: 8월 1일-8월 10일\n수업: 매주 수요일 오후 7시\n신청 방법: 홈페이지 접수\n재료비는 수강생이 별도로 부담합니다.",
          instructionZh: "阅读原文，选择与通知内容一致的一项。",
          passageZh: "市民课程报名通知：报名时间为8月1日至8月10日；课程每周三晚上7点进行；通过网站报名；材料费由学员另外承担。",
          stemZh: "阅读市民课程通知，选择与内容一致的一项。申请时间为8月1日至10日，每周三晚上7点上课，网上报名，材料费另付。",
          options: ["수업은 매주 수요일 저녁에 있습니다.", "신청은 전화로만 할 수 있습니다.", "재료비는 수강료에 포함되어 있습니다.", "8월 10일부터 신청할 수 있습니다."],
          optionTranslations: ["课程每周三晚上进行。", "只能通过电话报名。", "材料费包含在学费中。", "从8月10日起可以报名。"],
          answer: 0,
          answerZh: "课程每周三晚上进行。",
          explanation: "안내문에 수업 시간이 매주 수요일 오후 7시라고 쓰여 있습니다.",
          explanationZh: "通知明确写着每周三晚上7点上课，其余选项与报名方式、材料费或日期不符。",
          source: "TOPIK II 阅读公告细节题型"
        },
        {
          stem: "다음을 읽고 필자의 태도로 맞는 것을 고르십시오.\n\n회의 시간을 줄이기 위해서는 참석자 수만 줄이는 것보다 회의 전에 목적과 자료를 공유하는 것이 중요하다. 준비된 참석자는 핵심 문제에 바로 의견을 낼 수 있기 때문이다.",
          instructionZh: "阅读原文，选择最符合作者态度的一项。",
          passageZh: "为了缩短会议时间，比起单纯减少参会人数，更重要的是在会前共享会议目的和资料。因为做好准备的参会者可以直接就核心问题发表意见。",
          stemZh: "阅读短文，选择符合作者态度的一项。作者认为缩短会议不能只减少人数，更重要的是提前共享目的和资料。",
          options: ["회의 전 준비가 효율을 높인다고 본다.", "회의에는 가능한 많은 사람이 필요하다고 본다.", "회의 자료는 끝난 뒤 공유해야 한다고 본다.", "회의 시간을 늘려야 의견이 많아진다고 본다."],
          optionTranslations: ["认为会前准备能提高效率。", "认为会议应尽量多人参加。", "认为资料应在会后共享。", "认为延长会议才能增加意见。"],
          answer: 0,
          answerZh: "认为会前准备能提高效率。",
          explanation: "필자는 목적과 자료를 미리 공유하면 핵심 문제를 바로 논의할 수 있다고 긍정적으로 평가합니다.",
          explanationZh: "作者明确肯定会前共享目的和资料，理由是参与者可以直接讨论核心问题。",
          source: "TOPIK II 阅读态度判断题型"
        },
        {
          stem: "다음을 읽고 빈칸에 들어갈 내용으로 가장 알맞은 것을 고르십시오.\n\n새로운 습관을 만들 때 처음부터 큰 목표를 세우면 쉽게 지칠 수 있다. 그래서 전문가들은 행동을 아주 작게 시작하라고 권한다. 예를 들어 매일 한 시간 운동하는 대신 먼저 운동복을 입고 5분만 걷는 것이다. 이렇게 하면 ______.",
          instructionZh: "阅读原文，选择最适合填入空白处的一项。",
          passageZh: "培养新习惯时，如果一开始就设定很大的目标，很容易感到疲惫。因此专家建议从非常小的行动开始。例如，不是一开始就每天运动一小时，而是先穿上运动服，只走5分钟。这样就能______。",
          stemZh: "阅读短文，选择最适合填入结尾的内容。文章建议建立新习惯时从很小的行动开始。",
          options: ["행동을 시작하는 부담을 줄일 수 있다", "목표를 자주 바꾸는 것이 더 중요하다", "운동 시간을 정확히 한 시간으로 정해야 한다", "처음부터 어려운 계획을 선택할 수 있다"],
          optionTranslations: ["可以降低开始行动的负担", "更重要的是经常更换目标", "必须把运动时间准确设为一小时", "可以从一开始选择困难计划"],
          answer: 0,
          answerZh: "可以降低开始行动的负担",
          explanation: "앞 문장들은 작은 행동으로 시작하면 쉽게 지치지 않는다고 설명하므로 시작 부담을 줄인다는 결론이 자연스럽습니다.",
          explanationZh: "前文一直说明小行动能避免一开始就疲惫，所以最自然的结论是降低开始行动的负担。",
          source: "TOPIK II 阅读逻辑填空题型"
        },
        {
          stem: "다음을 읽고 내용과 다른 것을 고르십시오.\n\n회사에서는 다음 달부터 일회용 컵 사용을 줄이기 위해 개인 컵을 가져온 직원에게 음료 할인 쿠폰을 제공한다. 컵 세척 공간도 각 층에 설치할 예정이다. 참여는 의무가 아니지만 회사는 많은 직원이 함께하기를 기대하고 있다.",
          instructionZh: "阅读原文，选择与文章内容不一致的一项。",
          passageZh: "公司从下个月起，为减少一次性杯子的使用，将向自带杯子的员工提供饮料优惠券，并计划在每层设置洗杯区域。参与并非强制，但公司希望有更多员工共同参加。",
          stemZh: "阅读短文，选择与内容不一致的一项。公司下月开始鼓励员工自带杯子，提供饮料优惠券并设置清洗区，但不强制参加。",
          options: ["제도는 다음 달부터 시작됩니다.", "개인 컵을 가져오면 할인 쿠폰을 받을 수 있습니다.", "모든 직원은 반드시 참여해야 합니다.", "각 층에 컵을 씻는 공간이 생길 예정입니다."],
          optionTranslations: ["制度从下个月开始。", "自带杯子可以获得优惠券。", "所有员工都必须参加。", "每层计划设置洗杯区域。"],
          answer: 2,
          answerZh: "所有员工都必须参加。",
          explanation: "글에는 참여가 의무가 아니라고 했으므로 모든 직원이 반드시 참여해야 한다는 내용은 맞지 않습니다.",
          explanationZh: "原文明确说参加不是强制的，因此“所有员工都必须参加”与内容不一致。",
          source: "TOPIK II 阅读内容一致题型"
        }
      ],
      title: `${examLabel} · ${taskTitle}`,
      sources: sourceList({ exam })
    };
  }

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
          audioText: "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.",
          transcript: "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.",
          transcriptZh: "男：秀珍，我今天可能去不了社团会议了。突然打工时间变了。女：是吗？那请你明天上午之前把意见用短信发给我吧。我会在会议上替你说。男：谢谢。我会整理好关于海报设计的意见发过去。",
          stem: "남자가 오늘 동아리 회의에 못 가는 이유는 무엇입니까?",
          options: ["포스터를 아직 만들지 못해서", "아르바이트 시간이 바뀌어서", "의견을 정리하지 못해서", "내일 오전에 약속이 있어서"],
          optionTranslations: ["因为还没做完海报", "因为打工时间变了", "因为还没整理好意见", "因为明天上午有约"],
          answer: 1,
          explanation: "남자는 갑자기 아르바이트 시간이 바뀌어서 오늘 동아리 회의에 못 간다고 말했습니다.",
          explanationZh: "男生说自己突然打工时间变了，所以今天不能去社团会议。",
          answerZh: "因为打工时间变了",
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

  if (exam === "TOPIK" && category === "reading") {
    return {
      questions: [
        {
          stem: "다음을 읽고 맞는 것을 고르십시오.\n\n서울문화센터 한국어 교실\n기간: 5월 6일 ~ 6월 27일\n시간: 화·목 오후 7시~9시\n장소: 서울문화센터 3층\n신청: 4월 30일까지 센터 사무실에서",
          stemZh: "阅读公告信息：首尔文化中心韩语教室从5月6日到6月27日，每周二、周四晚上7点到9点，在首尔文化中心3楼上课，报名截止到4月30日。",
          options: ["한국어 수업은 주말에 있습니다.", "수업은 저녁에 두 시간 합니다.", "신청은 5월 6일까지 할 수 있습니다.", "수업 장소는 서울문화센터 1층입니다."],
          optionTranslations: ["韩语课在周末上。", "课程在晚上上两个小时。", "可以在5月6日前报名。", "上课地点在首尔文化中心1楼。"],
          answer: 1,
          answerZh: "课程在晚上上两个小时。",
          explanationZh: "公告写着上课时间是周二、周四晚上7点到9点，所以一次课是晚上两个小时。",
          source: "TOPIK I reading notice type"
        },
        {
          stem: "다음을 읽고 맞는 것을 고르십시오.\n\n책 할인 행사\n기간: 6월 1일 ~ 6월 10일\n장소: 한빛서점\n내용: 소설 20%, 어린이 책 30% 할인\n문의: 02-123-4567",
          stemZh: "阅读广告信息：韩빛书店6月1日到6月10日有图书打折活动，小说优惠20%，儿童书优惠30%。",
          options: ["행사는 한 달 동안 합니다.", "어린이 책은 30% 할인합니다.", "장소는 도서관입니다.", "소설은 할인하지 않습니다."],
          optionTranslations: ["活动持续一个月。", "儿童书优惠30%。", "地点在图书馆。", "小说不打折。"],
          answer: 1,
          answerZh: "儿童书优惠30%。",
          explanationZh: "广告中写着 어린이 책 30% 할인，意思是儿童书优惠30%。",
          source: "TOPIK I reading advertisement type"
        },
        {
          stem: "다음을 읽고 맞는 것을 고르십시오.\n\n민수 씨, 오늘 회의는 오후 3시에 시작합니다. 회의실이 2층에서 4층으로 바뀌었습니다. 늦지 마세요.",
          stemZh: "阅读便条信息：今天会议下午3点开始，会议室从2楼改到4楼。",
          options: ["회의는 오전에 시작합니다.", "회의실은 4층입니다.", "민수 씨는 오늘 수업이 있습니다.", "회의는 2층에서 합니다."],
          optionTranslations: ["会议上午开始。", "会议室在4楼。", "民秀今天有课。", "会议在2楼开。"],
          answer: 1,
          answerZh: "会议室在4楼。",
          explanationZh: "便条里写着会议室从2楼改到了4楼，所以正确选项是会议室在4楼。",
          source: "TOPIK I reading memo type"
        },
        {
          stem: "다음을 읽고 맞는 것을 고르십시오.\n\n박물관 안내\n여는 시간: 오전 10시\n닫는 시간: 오후 6시\n쉬는 날: 월요일\n입장료: 어른 5,000원, 학생 3,000원",
          stemZh: "阅读场馆信息：博物馆上午10点开门，下午6点关门，周一休息，成人票5000韩元，学生票3000韩元。",
          options: ["박물관은 월요일에 쉽니다.", "학생 입장료는 5,000원입니다.", "박물관은 오전 9시에 엽니다.", "어른은 무료로 들어갑니다."],
          optionTranslations: ["博物馆周一休息。", "学生票是5000韩元。", "博物馆上午9点开门。", "成人免费入场。"],
          answer: 0,
          answerZh: "博物馆周一休息。",
          explanationZh: " 안내문里写着 쉬는 날: 월요일，意思是休息日是周一。",
          source: "TOPIK I reading facility information type"
        },
        {
          stem: "다음을 읽고 맞는 것을 고르십시오.\n\n요리 교실 참가자 모집\n대상: 한국 음식을 배우고 싶은 사람\n날짜: 7월 5일 토요일\n시간: 오후 2시~4시\n준비물: 앞치마",
          stemZh: "阅读招募信息：烹饪课招募想学习韩国料理的人，时间是7月5日星期六下午2点到4点，需要带围裙。",
          options: ["요리 교실은 일요일에 합니다.", "참가자는 앞치마를 가져가야 합니다.", "수업은 오전에 있습니다.", "한국 음식을 먹고 싶은 사람만 참가할 수 있습니다."],
          optionTranslations: ["烹饪课在周日。", "参加者需要带围裙。", "课程在上午。", "只有想吃韩国料理的人可以参加。"],
          answer: 1,
          answerZh: "参加者需要带围裙。",
          explanationZh: "招募信息的准备物写着 앞치마，所以参加者需要带围裙。",
          source: "TOPIK I reading recruitment notice type"
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

function clockToMinutes(value, fallback) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return fallback;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(total) {
  const normalized = Math.max(0, total);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function dailyTargetMinutes(settings = {}) {
  if (settings.intensity === "轻量") return 45;
  if (settings.intensity === "中等") return 90;
  if (settings.intensity === "高强度") return 240;
  const min = Number(settings.minHours || 1);
  const max = Number(settings.maxHours || min);
  return Math.round(((min + max) / 2) * 60 / 5) * 5;
}

function blockSizeForIntensity(settings = {}) {
  if (settings.intensity === "高强度") return 60;
  if (settings.intensity === "中等") return 45;
  return 40;
}

const PROTECTED_BREAKS = [
  { start: 12 * 60, end: 13 * 60 + 30 },
  { start: 18 * 60, end: 19 * 60 }
];

function overlapsProtectedBreak(start, end) {
  return PROTECTED_BREAKS.some(rest => start < rest.end && end > rest.start);
}

function splitWindowAroundBreaks(window, blockMinutes) {
  let segments = [{ start: window.start, end: window.end }];
  PROTECTED_BREAKS.forEach(rest => {
    segments = segments.flatMap(segment => {
      if (segment.end <= rest.start || segment.start >= rest.end) return [segment];
      return [
        { start: segment.start, end: Math.min(segment.end, rest.start) },
        { start: Math.max(segment.start, rest.end), end: segment.end }
      ];
    });
  });
  return segments.filter(segment => segment.end - segment.start >= blockMinutes);
}

function distributedStudyStarts(candidates = [], blocksPerDay = 1, blockMinutes = 45, dayOffset = 0) {
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  if (!unique.length) return [];
  const selected = [];
  const ratios = [0, 0.22, 0.45, 0.68, 0.9, 0.32, 0.78];
  const minimumDistance = blockMinutes + 10;
  for (let index = 0; index < blocksPerDay; index += 1) {
    const binStart = Math.floor(index * unique.length / blocksPerDay);
    const binEnd = Math.max(binStart, Math.floor((index + 1) * unique.length / blocksPerDay) - 1);
    const ratio = ratios[(dayOffset + index) % ratios.length];
    const preferredIndex = Math.round(binStart + (binEnd - binStart) * ratio);
    const ranked = unique
      .map((start, candidateIndex) => ({ start, candidateIndex }))
      .filter(item => item.candidateIndex >= binStart && item.candidateIndex <= binEnd)
      .sort((first, second) => Math.abs(first.candidateIndex - preferredIndex) - Math.abs(second.candidateIndex - preferredIndex));
    const match = ranked.find(item => selected.every(existing => Math.abs(existing - item.start) >= minimumDistance));
    if (match) selected.push(match.start);
  }
  if (selected.length < blocksPerDay) {
    unique.forEach(start => {
      if (selected.length >= blocksPerDay) return;
      if (selected.every(existing => Math.abs(existing - start) >= minimumDistance)) selected.push(start);
    });
  }
  return selected.sort((a, b) => a - b).slice(0, blocksPerDay);
}

function dailyStudyStarts(settings = {}, blocksPerDay = 1, blockMinutes = 45, dayOffset = 0) {
  const availableStart = clockToMinutes(settings.availableStart, 8 * 60);
  const availableEnd = clockToMinutes(settings.availableEnd, 22 * 60);
  const selected = settings.times?.length ? settings.times : ["下午", "晚上"];
  const ranges = {
    "上午": [8 * 60, 12 * 60],
    "下午": [13 * 60, 17 * 60 + 30],
    "晚上": [18 * 60, 22 * 60],
    "不固定": [availableStart, availableEnd]
  };
  const windows = selected.map(label => ranges[label]).filter(Boolean).map(([start, end]) => ({
    start: Math.max(start, availableStart),
    end: Math.min(end, availableEnd)
  })).filter(window => window.end - window.start >= blockMinutes);
  const sourceWindows = (windows.length ? windows : [{ start: availableStart, end: availableEnd }])
    .flatMap(window => splitWindowAroundBreaks(window, blockMinutes));
  const candidates = [];
  sourceWindows.forEach(window => {
    for (let start = window.start; start + blockMinutes <= window.end; start += 5) {
      if (!overlapsProtectedBreak(start, start + blockMinutes)) candidates.push(start);
    }
  });
  if (candidates.length < blocksPerDay) {
    for (let start = availableStart; start + blockMinutes <= availableEnd; start += 5) {
      if (!overlapsProtectedBreak(start, start + blockMinutes)) candidates.push(start);
    }
  }
  return distributedStudyStarts(candidates, blocksPerDay, blockMinutes, dayOffset);
}

function selectedPlanCategories(settings = {}, fallbackCategories = []) {
  const weakMap = { "听力": "listening", "阅读": "reading", "词汇": "vocab", "语法": "vocab", "写作": "writing", "口语": "speaking" };
  const selected = [...new Set((settings.weak || []).map(item => weakMap[item]).filter(Boolean))];
  return selected.length ? selected : fallbackCategories;
}

function selectedPlanScope(categories = []) {
  const labelMap = { listening: "听力", reading: "阅读", vocab: "词汇语法", writing: "写作", speaking: "口语" };
  const labels = [...new Set(categories.map(category => labelMap[category]).filter(Boolean))];
  return labels.join("和") || "本周内容";
}

function fallbackPlan(settings = {}) {
  const days = settings.studyDays?.length ? settings.studyDays : ["mon", "tue", "wed", "thu", "fri"];
  const baseCategories = settings.exam === "TOPIK" && settings.level === "II"
    ? ["listening", "writing", "reading", "vocab"]
    : settings.exam === "IELTS"
      ? ["listening", "reading", "writing", "speaking"]
      : ["listening", "reading", "vocab"];
  const selectedCategories = selectedPlanCategories(settings, baseCategories);
  // A new plan has no evidence for consolidation or mock work yet. Keep the
  // generated schedule inside the modules the learner explicitly selected;
  // real results can add review priority later.
  const measuredWeakCategory = settings.planningProfile?.weakCategory;
  const categories = measuredWeakCategory && selectedCategories.includes(measuredWeakCategory)
    ? [measuredWeakCategory, ...selectedCategories]
    : [...selectedCategories];
  const copy = productTaskCopy(settings);
  const scope = selectedPlanScope(selectedCategories);
  copy.consolidation = [
    taskCopy("巩固练习：阶段综合检验", `用本周${scope}做一组综合题`, ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"]),
    taskCopy("巩固练习：错因预防", "先看常见误区，再完成一组同型题", ["完成本组系统练习", "系统统计正确率", "整理薄弱点", "完成后可补一句反思"]),
    taskCopy("巩固练习：延迟检验", "不看笔记完成一组同型题", ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"])
  ];
  copy.mock = [
    taskCopy("阶段模拟：限时综合练习", `围绕本周${scope}完成限时练习`, ["按时间完成本组综合练习", "系统统计正确率", "归类全部错题", "完成后可补一句反思"])
  ];
  const targetMinutes = dailyTargetMinutes(settings);
  const blockMinutes = blockSizeForIntensity(settings);
  const blocksPerDay = Math.max(1, Math.ceil(targetMinutes / blockMinutes));
  const categoryCounts = {};
  const tasks = days.flatMap((day, dayIndex) => dailyStudyStarts(settings, blocksPerDay, blockMinutes, dayIndex).map((start, index) => {
    const category = categories[(dayIndex + index) % categories.length];
    const categoryIndex = categoryCounts[category] || 0;
    categoryCounts[category] = categoryIndex + 1;
    const item = copy[category]?.[categoryIndex % copy[category].length] || copy.consolidation?.[0] || copy.review[0];
    return {
      day,
      start: minutesToClock(start),
      end: minutesToClock(start + blockMinutes),
      category,
      title: item.title,
      note: item.note,
      standards: item.standards
    };
  }));
  return {
    tasks,
    tomorrowFocus: "先完成一组按考试目标生成的同型题，再根据错题安排明日复习。"
  };
}

function productTaskCopy(settings = {}) {
  const topikLevel = settings.level === "II" ? "TOPIK II" : "TOPIK I";
  const target = settings.targetGrade ? `目标${settings.targetGrade}级` : "目标等级";
  if (settings.exam === "IELTS") {
    return {
      listening: [
        taskCopy("IELTS 听力：日常对话定位", "练表格填空、数字信息和同义替换", ["完成本组听力题", "系统统计正确率", "错题进入复习队列", "完成后可补一句反思"]),
        taskCopy("IELTS 听力：地图与路线题", "练方位词、路线变化和地标定位", ["完成本组地图题", "系统记录错题", "复盘干扰信息", "完成后可补一句反思"])
      ],
      reading: [
        taskCopy("IELTS 阅读：判断题定位", "练 True / False / Not Given 的依据判断", ["完成本组阅读题", "标记答案依据", "系统记录正确率", "错题进入复习队列"]),
        taskCopy("IELTS 阅读：段落信息匹配", "练主旨句、关键词和同义改写", ["完成限时阅读", "系统统计正确率", "错题归类", "完成后可补一句反思"])
      ],
      writing: [
        taskCopy("IELTS 写作：Task 1 结构", "练概括、比较和数据表达", ["完成结构练习", "检查主题句和连接", "记录可复用表达", "完成后可补一句反思"]),
        taskCopy("IELTS 写作：Task 2 提纲", "练观点、理由、例证和让步", ["完成提纲练习", "检查论点完整度", "记录薄弱表达", "完成后可补一句反思"])
      ],
      speaking: [
        taskCopy("IELTS 口语：Part 1 快答", "练日常话题的自然回答", ["完成本组口语题", "记录卡顿点", "复盘表达替换", "完成后可补一句反思"]),
        taskCopy("IELTS 口语：Part 2 陈述", "练1分钟准备和2分钟展开", ["完成陈述练习", "系统记录本组表现", "整理可复用表达", "完成后可补一句反思"])
      ],
      consolidation: [
        taskCopy("IELTS 巩固练习：阶段检验", "用本周内容完成一组综合题", ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"])
      ],
      review: [
        taskCopy("错题复盘：到期题重做", "按错因重新完成一组变式题", ["完成到期错题", "系统统计正确率", "仍错题继续复习", "完成后可补一句反思"])
      ]
    };
  }
  if (settings.exam === "TOPIK" && settings.level === "II") {
    return {
      listening: [
        taskCopy(`${topikLevel} 听力：短对话理解`, `围绕${target}先听人物、场所和正在发生的事`, ["完成本组听力同型题", "系统统计正确率", "错题进入复习队列", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 听力：说话意图判断`, `围绕${target}练“为什么这样说、想表达什么”`, ["完成本组听力同型题", "系统记录错题", "复盘意图线索", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 听力：原因理由定位`, `围绕${target}练“为什么不能去/为什么这样做”`, ["完成本组听力同型题", "系统记录错题", "复盘理由词", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 听力：下一步行动判断`, `围绕${target}练“接下来要做什么”和请求表达`, ["完成本组听力同型题", "系统统计正确率", "标出动作动词", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 听力：信息一致判断`, `围绕${target}核对时间、地点、对象和数量`, ["完成本组听力同型题", "系统记录错题", "复盘干扰信息", "完成后可补一句反思"])
      ],
      writing: [
        taskCopy(`${topikLevel} 写作：句子补全`, `围绕${target}练对话和句子空格，对应TOPIK写作51题`, ["完成本组写作基础题", "系统记录完成情况", "整理可复用句式", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 写作：短文逻辑补全`, `围绕${target}练前后文逻辑，对应TOPIK写作52题`, ["完成本组写作基础题", "检查前后逻辑是否连贯", "整理可复用句式", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 写作：图表说明`, `围绕${target}练趋势、比较和总结，对应TOPIK写作53题`, ["完成本组图表说明题", "检查表达是否客观", "整理可复用句式", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 写作：议论文结构`, `围绕${target}练观点、理由和例子，对应TOPIK写作54题`, ["完成本组议论文结构题", "检查逻辑连接", "记录薄弱表达", "完成后可补一句反思"])
      ],
      reading: [
        taskCopy(`${topikLevel} 阅读：实用文信息读取`, `围绕${target}练公告、广告里的日期、地点、对象和目的`, ["完成本组阅读同型题", "系统统计正确率", "标出答案依据", "错题进入复习队列"]),
        taskCopy(`${topikLevel} 阅读：句子顺序整理`, `围绕${target}练连接词、指代和前后逻辑`, ["完成本组阅读同型题", "系统记录错题", "复述判断路径", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 阅读：中心内容理解`, `围绕${target}练中心句、重复词和段落目的`, ["完成本组阅读同型题", "系统统计正确率", "标出答案依据", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 阅读：细节同义改写`, `围绕${target}练题干关键词和原文换说`, ["完成本组阅读同型题", "系统记录错题", "整理同义表达", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 阅读：长文段落关系`, `围绕${target}练转折、举例和总结句`, ["完成本组阅读同型题", "系统统计正确率", "复述段落关系", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 阅读：题干信息定位`, `围绕${target}练快速定位题干关键词`, ["完成限时阅读题", "系统记录错题", "标出定位依据", "完成后可补一句反思"])
      ],
      vocab: [
        taskCopy(`${topikLevel} 词汇语法：助词语尾基础`, `围绕${target}练助词、连接语尾和高频表达`, ["完成本组词汇语法题", "系统统计正确率", "错题进入复习队列", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 词汇语法：近义表达辨析`, `围绕${target}练意思相近词和固定搭配`, ["完成本组词汇语法题", "系统记录错题", "整理易混表达", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 词汇语法：语境填空`, `围绕${target}练句子结构、固定搭配和语境判断`, ["完成本组词汇语法题", "系统记录错题", "整理易混表达", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 词汇语法：连接表达`, `围绕${target}练原因、转折、条件和顺序`, ["完成本组词汇语法题", "系统统计正确率", "整理连接表达", "完成后可补一句反思"])
      ],
      mock: [
        taskCopy(`${topikLevel} 阶段模拟：限时综合练习`, `围绕${target}串联听力、写作、阅读和词汇语法`, ["按时间完成本组综合练习", "系统统计正确率", "归类全部错题", "完成后可补一句反思"])
      ],
      consolidation: [
        taskCopy(`${topikLevel} 巩固练习：阶段综合检验`, `围绕${target}做一组综合同型题`, ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 巩固练习：错因预防`, `先看常见误区，再完成一组同型题`, ["完成本组系统练习", "系统统计正确率", "整理薄弱点", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 巩固练习：混合题型`, `把听力、阅读和词汇语法串联练习`, ["完成本组系统练习", "系统统计正确率", "错题进入错题集", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 巩固练习：限时综合`, `按考试节奏完成一组混合题`, ["完成本组系统练习", "系统统计正确率", "整理薄弱点", "完成后可补一句反思"]),
        taskCopy(`${topikLevel} 巩固练习：知识回忆`, `不看笔记复述本周判断路径`, ["完成本组系统练习", "系统统计正确率", "记录卡点", "完成后可补一句反思"])
      ],
      review: [
        taskCopy("错题复盘：同类变式题", "根据最近错题重做一组同型练习", ["完成到期错题", "系统统计正确率", "仍错题继续复习", "完成后可补一句反思"])
      ]
    };
  }
  return {
    listening: [
      taskCopy("听人物和地点", `围绕${target}练短对话里的人物、地点和正在发生的事`, ["完成本组听力题", "系统统计正确率", "错题进入复习队列", "完成后可补一句反思"]),
      taskCopy("听下一步行动", `围绕${target}练“接下来做什么”和请求表达`, ["完成本组听力题", "系统记录错题", "复盘动作词", "完成后可补一句反思"]),
      taskCopy("听原因和理由", `围绕${target}练不能去、改变计划和原因说明`, ["完成本组听力题", "系统统计正确率", "标出理由线索", "完成后可补一句反思"]),
      taskCopy("听数字和时间", `围绕${target}练日期、价格、时间和数量`, ["完成本组听力题", "系统记录错题", "复盘数字信息", "完成后可补一句反思"]),
      taskCopy("听内容一致", `围绕${target}核对选项是否和原文一致`, ["完成本组听力题", "系统统计正确率", "记录干扰项", "完成后可补一句反思"])
    ],
    reading: [
      taskCopy("公告信息读取", `围绕${target}练日期、地点、对象和目的`, ["完成本组阅读题", "系统统计正确率", "标出答案依据", "错题进入复习队列"]),
      taskCopy("广告信息读取", `围绕${target}练价格、时间、活动和条件`, ["完成本组阅读题", "系统记录错题", "标出答案依据", "完成后可补一句反思"]),
      taskCopy("短文大意理解", `围绕${target}练中心句和重复关键词`, ["完成本组阅读题", "系统统计正确率", "用一句话概括大意", "完成后可补一句反思"]),
      taskCopy("题干关键词定位", `围绕${target}练先看题干再回原文找依据`, ["完成本组阅读题", "系统记录错题", "标出定位词", "完成后可补一句反思"]),
      taskCopy("图表信息读取", `围绕${target}练表格、时间表和简单说明`, ["完成本组阅读题", "系统统计正确率", "复盘信息对应关系", "完成后可补一句反思"])
    ],
    vocab: [
      taskCopy("生活场景词汇", `围绕${target}练学校、交通、购物和日常活动`, ["完成本组词汇语法题", "系统统计正确率", "错题进入复习队列", "完成后可补一句反思"]),
      taskCopy("基础助词辨析", `围绕${target}练 은/는、이/가、을/를 的句中作用`, ["完成本组词汇语法题", "系统记录错题", "整理判断规则", "完成后可补一句反思"]),
      taskCopy("动词形容词变形", `围绕${target}练现在、过去、将来和敬语形式`, ["完成本组词汇语法题", "系统统计正确率", "记录易错变形", "完成后可补一句反思"]),
      taskCopy("连接语尾基础", `围绕${target}练原因、转折、顺序和条件表达`, ["完成本组词汇语法题", "系统记录错题", "整理连接表达", "完成后可补一句反思"]),
      taskCopy("语境填空", `围绕${target}练根据句意选择合适词语或语尾`, ["完成本组词汇语法题", "系统统计正确率", "整理易混表达", "完成后可补一句反思"])
    ],
    mock: [
      taskCopy("限时综合练习", `围绕${target}串联听力、阅读和词汇语法`, ["按时间完成本组综合练习", "系统统计正确率", "归类全部错题", "完成后可补一句反思"])
    ],
    consolidation: [
      taskCopy("错因预防练习", `先看常见误区，再完成一组同型题`, ["完成本组系统练习", "系统统计正确率", "整理薄弱点", "完成后可补一句反思"]),
      taskCopy("延迟巩固练习", `不看笔记完成一组同型题`, ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"]),
      taskCopy("混合题型串联", `把听力、阅读和词汇语法穿插练`, ["完成本组系统练习", "系统统计正确率", "整理薄弱点", "完成后可补一句反思"]),
      taskCopy("本日知识回忆", `不看笔记复述本周判断路径`, ["完成本组系统练习", "系统统计正确率", "记录卡点", "完成后可补一句反思"])
    ],
    review: [
      taskCopy("错题复盘：基础题重做", "按错因重新完成一组变式题", ["完成到期错题", "系统统计正确率", "仍错题继续复习", "完成后可补一句反思"])
    ]
  };
}

function taskCopy(title, note, standards) {
  return { title, note, standards };
}

function buildPracticePrompt(settings = {}) {
  const request = settings.practiceRequest || {};
  const count = requestedQuestionCount(settings);
  return [
    "You are a careful exam practice generator for a study planner.",
    "Generate original practice questions that follow public official sample-question types and user-provided context.",
    "Do not reproduce a copyrighted full exam paper or claim unverifiable sources.",
    "Return strict JSON only with this shape: {\"questions\":[{\"stem\":\"short question or instruction\",\"instruction\":\"reading instruction when applicable\",\"instructionZh\":\"Chinese instruction only\",\"passage\":\"reading passage when applicable\",\"passageZh\":\"Chinese passage translation when applicable\",\"stemZh\":\"Chinese question meaning\",\"options\":[\"...\"],\"optionTranslations\":[\"...\"],\"answer\":0,\"answerZh\":\"...\",\"explanation\":\"...\",\"explanationZh\":\"...\",\"source\":\"...\",\"audioText\":\"...\",\"transcript\":\"...\",\"transcriptZh\":\"...\"}],\"sources\":[\"...\"]}.",
    "Each question must have 4 options and a zero-based numeric answer.",
    "The question type must match Category and Task. If Category is reading, generate reading comprehension based on a notice, advertisement, memo, short passage, chart, or information block; do not generate grammar particle fill-in questions.",
    "If Category is vocab or grammar, grammar and vocabulary questions are allowed. If Category is listening, generate listening questions only.",
    "For listening questions, put the dialogue or monologue in audioText and transcript, and keep stem as only the question. Do not place the full listening script inside stem.",
    "Listening questions must test meaning, next action, reason, place, time, speaker intention, or content match. Never generate blank-fill, particle, or grammar completion questions for listening.",
    "Listening options must be meaningful answer choices, not one-syllable particles or grammar endings.",
    "For every Korean question, include stemZh, answerZh, explanationZh, and optionTranslations in Simplified Chinese. explanationZh should explain the question content and why the correct option matches it; do not write English explanations.",
    "For reading questions, never concatenate the instruction and passage into stem. Put the short instruction in instruction/stem and the full Korean text in passage, with only its translation in passageZh.",
    "For non-listening questions, audioText and transcript may be empty.",
    `Exam: ${getExamLabel(settings)}.`,
    `Category: ${request.category || "mixed"}.`,
    `Task: ${request.taskTitle || "practice"}.`,
    `Task note: ${request.taskNote || ""}.`,
    `Weak areas: ${(settings.weak || request.weak || []).join(", ") || "unknown"}.`,
    `Standards: ${(request.standards || []).join(" / ") || "complete the set and review errors"}.`,
    request.batchTotal ? `This is batch ${request.batchIndex + 1} of ${request.batchTotal}. Use different passages, situations, answer positions, and evidence from the other batches.` : "",
    `Generate exactly ${count} questions.`
  ].filter(Boolean).join("\n");
}

function parseModelJson(text = "") {
  const cleaned = String(text).trim().replace(/^```json\s*|\s*```$/g, "");
  return JSON.parse(cleaned);
}

function openAiBaseUrl() {
  const customBaseUrl = process.env.OPENAI_ALLOW_CUSTOM_BASE_URL === "true"
    ? process.env.OPENAI_BASE_URL
    : "";
  return String(customBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function practiceProviderTimeoutMs() {
  const configured = Number(process.env.PRACTICE_PROVIDER_TIMEOUT_MS || 12000);
  return Math.min(12000, Math.max(6000, Number.isFinite(configured) ? configured : 12000));
}

async function fetchPracticeProvider(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), practiceProviderTimeoutMs());
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAiCompatiblePractice(settings = {}) {
  const response = await fetchPracticeProvider(`${openAiBaseUrl()}/chat/completions`, {
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
  if (!response.ok) throw new Error(`openai_http_${response.status}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  return parsed;
}

async function callQwenPractice(settings = {}) {
  const baseUrl = String(process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
  const response = await fetchPracticeProvider(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QWEN_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.QWEN_MODEL || "qwen-plus",
      messages: [
        { role: "system", content: "Return strict JSON only. Do not include markdown." },
        { role: "user", content: buildPracticePrompt(settings) }
      ],
      temperature: 0.4,
      enable_thinking: false
    })
  });
  if (!response.ok) throw new Error(`qwen_http_${response.status}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  return parsed;
}

async function callOpenAiResponsesPractice(settings = {}) {
  const response = await fetchPracticeProvider(`${openAiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildPracticePrompt(settings),
      temperature: 0.4
    })
  });
  if (!response.ok) throw new Error(`openai_http_${response.status}`);
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap(item => item.content || []).map(item => item.text || "").join("\n") || "";
  const parsed = parseModelJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  return parsed;
}

async function callOpenAiPracticeOnce(settings = {}) {
  const provider = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  if (provider === "qwen") {
    return process.env.QWEN_API_KEY ? callQwenPractice(settings) : null;
  }
  if (!process.env.OPENAI_API_KEY) return null;
  if (process.env.OPENAI_ALLOW_CUSTOM_BASE_URL === "true" && process.env.OPENAI_BASE_URL) {
    return callOpenAiCompatiblePractice(settings);
  }
  return callOpenAiResponsesPractice(settings);
}

async function callOpenAiPractice(settings = {}) {
  const count = requestedQuestionCount(settings);
  if (count <= 5) return callOpenAiPracticeOnce(settings);
  const batchSizes = Array.from({ length: Math.ceil(count / 5) }, (_, index) => Math.min(5, count - index * 5));
  const results = await Promise.allSettled(batchSizes.map((batchSize, batchIndex) => callOpenAiPracticeOnce({
    ...settings,
    practiceRequest: {
      ...(settings.practiceRequest || {}),
      requestedQuestionCount: batchSize,
      batchIndex,
      batchTotal: batchSizes.length
    }
  })));
  const completed = results
    .filter(result => result.status === "fulfilled" && Array.isArray(result.value?.questions) && result.value.questions.length)
    .map(result => result.value);
  if (!completed.length) {
    const firstError = results.find(result => result.status === "rejected")?.reason;
    if (firstError) throw firstError;
    return null;
  }
  return {
    questions: completed.flatMap(result => result.questions).slice(0, count),
    sources: [...new Set(completed.flatMap(result => result.sources || []))]
  };
}

async function handlePractice(settings = {}) {
  const material = materialPractice(settings);
  if (material) return reviewPracticeSet(material, settings, "material");
  let providerIssue = "";
  const aiPractice = await callOpenAiPractice(settings).catch(error => {
    providerIssue = error?.name === "AbortError"
      ? "provider_timeout"
      : (/^(?:openai|qwen)_http_\d+$/.test(error?.message || "") ? error.message : "provider_response_invalid");
    return null;
  });
  const reviewed = reviewPracticeSet(aiPractice || fallbackPractice(settings), settings, aiPractice ? "generated" : "fallback");
  return {
    ...reviewed,
    quality: { ...reviewed.quality, providerIssue }
  };
}

async function handlePlan(settings = {}) {
  return fallbackPlan(settings);
}

async function handleResearch(settings = {}) {
  return {
    summary: `${getExamLabel(settings)} 将用官方入口、公开样题或用户自有材料校准考试模块与难度；日常练习按训练点生成原创同型题，不把训练标签写成官方分类。`,
    sources: sourceList(settings).map(normalizeSource)
  };
}

function validateImportImages(images = []) {
  if (!Array.isArray(images) || !images.length || images.length > 3) throw new Error("vision_images_invalid");
  let totalLength = 0;
  return images.map((entry, index) => {
    const dataUrl = String(entry?.dataUrl || "");
    if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error("vision_image_invalid");
    }
    if (dataUrl.length > 1_800_000) throw new Error("vision_image_too_large");
    totalLength += dataUrl.length;
    if (totalLength > 4_500_000) throw new Error("vision_images_too_large");
    return { name: compact(entry?.name, `image-${index + 1}`), dataUrl };
  });
}

function errorImportVisionPrompt() {
  return [
    "You extract wrong questions from learner-owned study photos for a TOPIK study review tool.",
    "Return strict JSON only with this schema:",
    '{"items":[{"section":"听力|阅读|写作|词汇 / 语法|其他","category":"listening|reading|writing|vocab|other","title":"short Chinese title","question":"exact visible question or instruction","options":["option A","option B","option C","option D"],"userAnswer":"visible learner answer or empty","correctAnswer":"visible correct answer or empty","selectedIndex":-1,"correctIndex":-1,"explanation":"only if visibly provided","focus":"specific skill tested","reasoning":"specific correct reasoning","action":"specific next-time action","confidence":"high|low","needsConfirmation":true}],"summary":"short Chinese summary"}',
    "Extract only questions visibly present in the images. Do not invent hidden text, answers, explanations, audio, or options.",
    "Keep Korean text exactly as printed. Use zero-based indexes only when the marked answer can be matched to an extracted option; otherwise use -1.",
    "Set needsConfirmation=true whenever the question, learner answer, correct answer, or markings are unclear. Confidence must be low in that case.",
    "If multiple photos show the same question, return it once. Return at most 30 items.",
    "The reasoning and action must refer to the current question. If evidence is insufficient, leave them empty instead of writing generic advice."
  ].join("\n");
}

function normalizeImportVisionItem(item = {}) {
  const options = Array.isArray(item.options) ? item.options.map(option => compact(option)).filter(Boolean).slice(0, 6) : [];
  const selectedIndex = Number(item.selectedIndex);
  const correctIndex = Number(item.correctIndex);
  const question = compact(item.question || item.stem || item.instruction);
  const userAnswer = compact(item.userAnswer);
  const correctAnswer = compact(item.correctAnswer);
  const uncertain = item.needsConfirmation === true || item.confidence === "low" || !question || !userAnswer || !correctAnswer;
  const allowedCategories = new Set(["listening", "reading", "writing", "vocab", "other"]);
  return {
    section: compact(item.section, "其他").slice(0, 24),
    category: allowedCategories.has(item.category) ? item.category : "other",
    title: compact(item.title || question, "待确认错题").slice(0, 80),
    question: question.slice(0, 1200),
    options,
    userAnswer: userAnswer.slice(0, 300),
    correctAnswer: correctAnswer.slice(0, 300),
    selectedIndex: Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < options.length ? selectedIndex : -1,
    correctIndex: Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < options.length ? correctIndex : -1,
    explanation: compact(item.explanation).slice(0, 600),
    focus: compact(item.focus).slice(0, 300),
    reasoning: compact(item.reasoning).slice(0, 600),
    action: compact(item.action).slice(0, 400),
    confidence: uncertain ? "low" : "high",
    needsConfirmation: uncertain
  };
}

async function requestErrorImportVision({ baseUrl, apiKey, model, images }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return strict JSON only. Do not include markdown." },
          {
            role: "user",
            content: [
              { type: "text", text: errorImportVisionPrompt() },
              ...images.map(image => ({ type: "image_url", image_url: { url: image.dataUrl } }))
            ]
          }
        ],
        temperature: 0
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`vision_provider_http_${response.status}`);
    const payload = await response.json();
    const parsed = parseModelJson(payload.choices?.[0]?.message?.content || "");
    const items = Array.isArray(parsed.items) ? parsed.items.map(normalizeImportVisionItem).filter(item => item.question) : [];
    if (!items.length) throw new Error("vision_no_questions");
    return {
      items: items.slice(0, 30),
      summary: compact(parsed.summary, `识别到${items.length}道题，请确认作答标记后再导入。`),
      source: "online"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleVision(settings = {}) {
  const images = validateImportImages(settings.images);
  const provider = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  if (provider !== "openai" || !process.env.OPENAI_API_KEY) throw new Error("vision_provider_unavailable");
  return requestErrorImportVision({
    baseUrl: openAiBaseUrl(),
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_HANDWRITING_MODEL || "gpt-4o",
    images
  });
}

function validateHandwritingImage(image = "") {
  const value = String(image || "");
  if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new Error("handwriting_image_invalid");
  }
  if (value.length > 1_500_000) throw new Error("handwriting_image_too_large");
  return value;
}

function handwritingPrompt() {
  return [
    "Recognize only the handwritten Korean Hangul in this image.",
    "Ignore printed interface text, borders, guide lines, icons, and buttons.",
    "Reconstruct complete precomposed Hangul syllable blocks such as 태; never return separated compatibility jamo such as ㅌㅐ or ㅔㅎ.",
    "Return strict JSON only: {\"candidates\":[\"first\",\"second\",\"third\"]}.",
    "The first candidate must be the most likely exact transcription.",
    "Return 1 to 3 short Korean candidates. Do not translate or explain."
  ].join("\n");
}

function normalizeHandwritingCandidates(payload = {}) {
  const values = Array.isArray(payload.candidates) ? payload.candidates : [];
  return [...new Set(values
    .map(value => compact(value).replace(/[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\s]/g, "").trim())
    .filter(value => /[\uac00-\ud7af]/.test(value)))].slice(0, 3);
}

async function requestHandwritingRecognition({ baseUrl, apiKey, model, image }) {
  const response = await fetchPracticeProvider(`${String(baseUrl).replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return strict JSON only. Do not include markdown." },
        {
          role: "user",
          content: [
            { type: "text", text: handwritingPrompt() },
            { type: "image_url", image_url: { url: image } }
          ]
        }
      ],
      temperature: 0
    })
  });
  if (!response.ok) throw new Error(`handwriting_provider_http_${response.status}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "";
  return normalizeHandwritingCandidates(parseModelJson(text));
}

async function handleHandwriting(settings = {}) {
  const image = validateHandwritingImage(settings.image);
  const provider = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
  const providers = [];
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    const models = [...new Set([
      process.env.OPENAI_HANDWRITING_MODEL,
      process.env.OPENAI_VISION_MODEL,
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini"
    ].filter(Boolean))];
    models.forEach(model => providers.push({
      baseUrl: openAiBaseUrl(),
      apiKey: process.env.OPENAI_API_KEY,
      model
    }));
  }
  if (provider === "qwen" && process.env.QWEN_API_KEY) providers.push({
    baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.QWEN_API_KEY,
    model: process.env.QWEN_VISION_MODEL || "qwen-vl-plus"
  });
  if (!providers.length) throw new Error("handwriting_provider_unavailable");

  for (const provider of providers) {
    try {
      const candidates = await requestHandwritingRecognition({ ...provider, image });
      if (candidates.length) return { candidates, source: "online" };
    } catch (error) {
      console.error("Handwriting provider failed:", provider.model, error.message);
    }
  }
  throw new Error("handwriting_recognition_failed");
}

export default async function studyAssistant(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const body = await parseBody(req);
    const action = body.action || "practice";
    const settings = body.settings || {};
    if (action === "practice") return send(res, 200, await handlePractice(settings));
    if (action === "plan") return send(res, 200, await handlePlan(settings));
    if (action === "research") return send(res, 200, await handleResearch(settings));
    if (action === "vision") return send(res, 200, await handleVision(settings));
    if (action === "handwriting") return send(res, 200, await handleHandwriting(settings));
    return send(res, 400, { error: "Unsupported action" });
  } catch (error) {
    return send(res, 500, { error: "Study assistant failed", detail: error.message });
  }
};
