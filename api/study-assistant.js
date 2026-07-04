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

function normalizeQuestion(item = {}) {
  const options = Array.isArray(item.options) ? item.options.map(option => compact(option)).filter(Boolean).slice(0, 4) : [];
  const answer = Number(item.answer);
  const audioText = compact(item.audioText || item.audio || item.transcript);
  return {
    stem: compact(item.stem || item.question),
    options,
    optionTranslations: Array.isArray(item.optionTranslations || item.optionsZh)
      ? (item.optionTranslations || item.optionsZh).map(option => compact(option)).slice(0, 4)
      : [],
    answer: Number.isInteger(answer) ? answer : -1,
    explanation: compact(item.explanation || item.reason),
    explanationZh: compact(item.explanationZh || item.explanationChinese || item.reasonZh || ""),
    answerZh: compact(item.answerZh || item.correctAnswerZh || ""),
    source: compact(item.source || item.type || "Generated exam-type practice"),
    skill: compact(item.skill || item.questionType || ""),
    audioText,
    transcript: compact(item.transcript || audioText),
    transcriptZh: compact(item.transcriptZh || item.transcriptChinese || item.audioTextZh || ""),
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
  if (/listening/.test(questionType) && !question.audioText) issues.push("听力题缺少可播放脚本");
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

  if (exam === "TOPIK" && level === "II" && category === "listening") {
    const listeningScript = "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.";
    const listeningScriptZh = "男：秀珍，我今天可能去不了社团会议了。突然打工时间变了。女：是吗？那请你明天上午之前把意见用短信发给我吧。我会在会议上替你说。男：谢谢。我会整理好关于海报设计的意见发过去。";
    return {
      questions: [
        {
          audioText: listeningScript,
          transcript: listeningScript,
          transcriptZh: listeningScriptZh,
          stem: "남자가 오늘 동아리 회의에 못 가는 이유는 무엇입니까?",
          options: ["포스터를 아직 만들지 못해서", "아르바이트 시간이 바뀌어서", "의견을 정리하지 못해서", "내일 오전에 약속이 있어서"],
          optionTranslations: ["因为还没做完海报", "因为打工时间变了", "因为还没整理好意见", "因为明天上午有约"],
          answer: 1,
          explanation: "남자는 갑자기 아르바이트 시간이 바뀌어서 오늘 동아리 회의에 못 간다고 말했습니다.",
          explanationZh: "男生说自己突然打工时间变了，所以今天不能去社团会议。",
          answerZh: "因为打工时间变了",
          source: "TOPIK II listening reason type"
        },
        {
          audioText: listeningScript,
          transcript: listeningScript,
          transcriptZh: listeningScriptZh,
          stem: "여자는 남자에게 무엇을 하라고 했습니까?",
          options: ["회의에 늦게 오라고 했습니다", "포스터를 바로 만들라고 했습니다", "의견을 문자로 보내라고 했습니다", "아르바이트 시간을 바꾸라고 했습니다"],
          optionTranslations: ["让他晚点来会议", "让他马上做海报", "让他把意见用短信发过去", "让他改打工时间"],
          answer: 2,
          explanation: "여자는 내일 오전까지 의견을 문자로 보내 달라고 했습니다.",
          explanationZh: "女生让男生在明天上午之前把意见用短信发给她。",
          answerZh: "让他把意见用短信发过去",
          source: "TOPIK II listening action type"
        },
        {
          audioText: listeningScript,
          transcript: listeningScript,
          transcriptZh: listeningScriptZh,
          stem: "남자는 무엇에 대한 의견을 보내겠다고 했습니까?",
          options: ["회의 시간", "포스터 디자인", "동아리 장소", "아르바이트 일정"],
          optionTranslations: ["会议时间", "海报设计", "社团地点", "打工日程"],
          answer: 1,
          explanation: "남자는 포스터 디자인에 대한 의견을 정리해서 보내겠다고 했습니다.",
          explanationZh: "男生说会整理关于海报设计的意见并发过去。",
          answerZh: "海报设计",
          source: "TOPIK II listening detail type"
        },
        {
          audioText: listeningScript,
          transcript: listeningScript,
          transcriptZh: listeningScriptZh,
          stem: "대화 내용과 같은 것을 고르십시오.",
          options: ["남자는 회의에서 발표할 것입니다", "여자는 남자의 의견을 대신 말할 것입니다", "회의는 내일 오전에 열립니다", "포스터는 이미 완성되었습니다"],
          optionTranslations: ["男生会在会议上发表", "女生会代替男生转达意见", "会议会在明天上午举行", "海报已经完成了"],
          answer: 1,
          explanation: "여자는 회의에서 남자의 의견을 대신 말해 주겠다고 했습니다.",
          explanationZh: "女生说会在会议上替男生转达他的意见。",
          answerZh: "女生会代替男生转达意见",
          source: "TOPIK II listening matching type"
        },
        {
          audioText: listeningScript,
          transcript: listeningScript,
          transcriptZh: listeningScriptZh,
          stem: "이 대화에서 남자의 말하기 목적은 무엇입니까?",
          options: ["회의에 못 가는 상황을 설명하려고", "포스터 디자인을 칭찬하려고", "아르바이트를 소개하려고", "회의 장소를 확인하려고"],
          optionTranslations: ["为了说明不能去会议的情况", "为了称赞海报设计", "为了介绍打工", "为了确认会议地点"],
          answer: 0,
          explanation: "남자는 아르바이트 시간이 바뀌어 회의에 못 간다는 상황을 설명하고 있습니다.",
          explanationZh: "男生是在说明因为打工时间变动，所以不能参加会议。",
          answerZh: "为了说明不能去会议的情况",
          source: "TOPIK II listening purpose type"
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

function dailyStudyStarts(settings = {}, blocksPerDay = 1, blockMinutes = 45) {
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
  const gap = settings.intensity === "高强度" ? 15 : 20;
  const candidates = [];
  const windowSlots = sourceWindows.map(window => {
    const slots = [];
    for (let start = window.start; start + blockMinutes <= window.end; start += blockMinutes + gap) {
      if (!overlapsProtectedBreak(start, start + blockMinutes)) slots.push(start);
    }
    return slots;
  });
  const longest = Math.max(...windowSlots.map(slots => slots.length), 0);
  for (let round = 0; round < longest; round += 1) {
    windowSlots.forEach(slots => {
      if (Number.isFinite(slots[round])) candidates.push(slots[round]);
    });
  }
  for (let start = availableStart; start + blockMinutes <= availableEnd; start += blockMinutes + gap) {
    if (!overlapsProtectedBreak(start, start + blockMinutes)) candidates.push(start);
  }
  const starts = [];
  [...new Set(candidates)].forEach(start => {
    const overlaps = starts.some(existing => Math.abs(existing - start) < blockMinutes + 5);
    if (!overlaps && starts.length < blocksPerDay) starts.push(start);
  });
  return starts.sort((a, b) => a - b);
}

function fallbackPlan(settings = {}) {
  const days = settings.studyDays?.length ? settings.studyDays : ["mon", "tue", "wed", "thu", "fri"];
  const weakMap = { "听力": "listening", "阅读": "reading", "词汇": "vocab", "语法": "vocab", "写作": "writing", "口语": "speaking" };
  const weakCategories = [...new Set((settings.weak || []).map(item => weakMap[item]).filter(Boolean))];
  const baseCategories = settings.exam === "TOPIK" && settings.level === "II"
    ? ["listening", "writing", "reading", "vocab", "consolidation"]
    : settings.exam === "IELTS"
      ? ["listening", "reading", "writing", "speaking", "consolidation"]
      : ["listening", "reading", "vocab", "consolidation"];
  const categories = [...new Set([...weakCategories, ...baseCategories, ...(settings.intensity === "高强度" ? ["mock"] : [])])];
  const copy = productTaskCopy(settings);
  const targetMinutes = dailyTargetMinutes(settings);
  const blockMinutes = blockSizeForIntensity(settings);
  const blocksPerDay = Math.max(1, Math.ceil(targetMinutes / blockMinutes));
  const categoryCounts = {};
  const tasks = days.flatMap((day, dayIndex) => dailyStudyStarts(settings, blocksPerDay, blockMinutes).map((start, index) => {
    let category = categories[(dayIndex + index) % categories.length];
    if (day === "sat" && index === blocksPerDay - 1 && categories.includes("mock")) category = "mock";
    if (day === "sun" && index === blocksPerDay - 1) category = "consolidation";
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
    "Return strict JSON only with this shape: {\"questions\":[{\"stem\":\"...\",\"options\":[\"...\"],\"optionTranslations\":[\"...\"],\"answer\":0,\"answerZh\":\"...\",\"explanation\":\"...\",\"explanationZh\":\"...\",\"source\":\"...\",\"audioText\":\"...\",\"transcript\":\"...\",\"transcriptZh\":\"...\"}],\"sources\":[\"...\"]}.",
    "Each question must have 4 options and a zero-based numeric answer.",
    "For listening questions, put the dialogue or monologue in audioText and transcript, and keep stem as only the question. Do not place the full listening script inside stem.",
    "For Korean listening questions, include transcriptZh, answerZh, explanationZh, and optionTranslations in Simplified Chinese for review after answering.",
    "For non-listening questions, audioText and transcript may be empty.",
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
    summary: `${getExamLabel(settings)} 将用官方入口、公开样题或用户自有材料校准考试模块与难度；日常练习按训练点生成原创同型题，不把训练标签写成官方分类。`,
    sources: sourceList(settings).map(normalizeSource)
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
    const body = await parseBody(req);
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
