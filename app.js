const categoryMeta = {
  listening: { label: "听力", className: "listening" },
  reading: { label: "阅读", className: "reading" },
  vocab: { label: "词汇 / 语法", className: "vocab" },
  writing: { label: "写作", className: "writing" },
  speaking: { label: "口语", className: "speaking" },
  mock: { label: "模拟测验", className: "mock" },
  consolidation: { label: "巩固练习", className: "review" },
  review: { label: "错题复盘", className: "review" }
};

const baseDays = [
  { key: "mon", en: "MON", name: "周一" },
  { key: "tue", en: "TUE", name: "周二" },
  { key: "wed", en: "WED", name: "周三" },
  { key: "thu", en: "THU", name: "周四" },
  { key: "fri", en: "FRI", name: "周五" },
  { key: "sat", en: "SAT", name: "周六" },
  { key: "sun", en: "SUN", name: "周日" }
];

function dateLabel(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function sameDate(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function buildCurrentWeekDays(referenceDate = new Date()) {
  const [year, month, dayOfMonth] = beijingDateKey(referenceDate).split("-").map(Number);
  const today = new Date(year, month - 1, dayOfMonth);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  return baseDays.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { ...day, date: dateLabel(date), fullDate: date, featured: sameDate(date, today) };
  });
}

let days = buildCurrentWeekDays();

const defaultTasks = [
  { id: 1, day: "mon", start: "11:00", end: "11:40", category: "listening", title: "短对话诊断", note: "辨认场所、人物与行动", status: "completed", standards: ["首遍不暂停完成15题", "正确率达到80%", "错题复听并写下漏听关键词", "次日重做错题"] },
  { id: 2, day: "mon", start: "19:30", end: "20:10", category: "vocab", title: "生活场景高频词", note: "交通、购物、时间", status: "completed", standards: ["学习30个高频词", "完成韩中辨认和例句填空", "当天正确率达到90%", "次日无提示回忆率达到85%"] },
  { id: 3, day: "tue", start: "11:00", end: "11:45", category: "reading", title: "助词与句子结构", note: "은/는、이/가、을/를", status: "progress", standards: ["25分钟内完成20题", "正确率达到80%", "错题标注为词汇、语法或理解错误", "在句子中圈出判断依据"] },
  { id: 4, day: "tue", start: "20:00", end: "20:35", category: "consolidation", title: "否定表达巩固练习", note: "안、못、-지 않다", status: "planned", standards: ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"] },
  { id: 5, day: "wed", start: "11:00", end: "11:45", category: "listening", title: "场景对话训练", note: "商店、餐厅、医院", status: "planned", standards: ["首遍不暂停完成15题", "每题记录场所关键词", "错题至少复听2遍", "正确率达到80%"] },
  { id: 6, day: "wed", start: "19:30", end: "20:10", category: "reading", title: "短文信息定位", note: "公告、广告、便条", status: "planned", standards: ["30分钟完成4篇短文共16题", "标出每题答案依据", "正确率达到80%", "每篇用一句中文概括主旨"] },
  { id: 7, day: "thu", start: "11:00", end: "11:40", category: "vocab", title: "动词与形容词变形", note: "现在、过去、将来", status: "planned", standards: ["完成24道变形题", "限时25分钟", "正确率达到85%", "错题各造一个新句子"] },
  { id: 8, day: "thu", start: "20:00", end: "20:35", category: "consolidation", title: "词汇隔日回忆", note: "不看词表主动回忆", status: "planned", standards: ["无提示回忆周一30词", "系统统计正确率", "薄弱词放入新语境", "完成后可补一句反思"] },
  { id: 9, day: "fri", start: "11:00", end: "11:45", category: "listening", title: "说话意图判断", note: "为什么这样说、想表达什么", status: "planned", standards: ["完成15题，首遍不暂停", "写下决定答案的动词", "正确率达到80%", "错题完成近义变式"] },
  { id: 10, day: "fri", start: "19:30", end: "20:15", category: "reading", title: "句子排序与衔接", note: "连接词、指代关系", status: "planned", standards: ["35分钟完成15题", "圈出连接词和指代词", "正确率达到80%", "错题复述排序依据"] },
  { id: 11, day: "sat", start: "14:00", end: "15:40", category: "mock", title: "半套限时模拟", note: "听力15题＋阅读20题", status: "planned", standards: ["全程不中断、不查词", "按规定时间完成35题", "分别记录听力和阅读正确率", "归类全部错题"] },
  { id: 12, day: "sat", start: "20:00", end: "20:35", category: "consolidation", title: "阶段综合检验", note: "只处理最高频两类薄弱点", status: "planned", standards: ["完成本组综合练习", "系统统计正确率", "整理薄弱点", "安排下周强化任务"] },
  { id: 13, day: "sun", start: "11:00", end: "11:40", category: "consolidation", title: "本周知识二次检验", note: "延迟变式题", status: "planned", standards: ["完成10道延迟变式题", "系统统计正确率", "口头解释判断顺序", "仍错知识点标记需重学"] },
  { id: 14, day: "sun", start: "20:00", end: "20:25", category: "vocab", title: "轻量复习与下周预习", note: "只看未掌握内容", status: "planned", standards: ["复习未掌握词汇", "预览下周3个语法点", "写下一个最需要解决的问题", "25分钟到时停止"] }
];

let tasks = JSON.parse(localStorage.getItem("topikPrototypeTasks") || "null") || defaultTasks;

const studyTemplates = {
  listening: [
    ["听人物和地点", "短对话里先抓谁、在哪里、正在做什么"], ["听下一步行动", "练“接下来做什么”和请求表达"], ["听原因和理由", "抓 못 가요、바뀌었어요 等理由线索"], ["听数字和时间", "练日期、价格、时间和数量"], ["听内容一致", "核对选项是否和原文相同"], ["听否定和时态", "听清 안、못、过去和将来"], ["看图听关键词", "先看图中差异，再听对应词"], ["听后复述", "复听、影子跟读、用中文说出大意"]
  ],
  reading: [
    ["公告信息读取", "练日期、地点、对象和目的"], ["广告信息读取", "练价格、时间、活动和条件"], ["短文大意理解", "找重复关键词和中心句"], ["题干关键词定位", "先看题干，再回原文找依据"], ["图表信息读取", "读表格、时间表和简单说明"], ["句子连接判断", "看前后句的因果、转折和顺序"], ["限时阅读", "控制速度，同时标出答案依据"]
  ],
  vocab: [
    ["生活场景词汇", "学校、交通、购物和日常活动"], ["基础助词辨析", "은/는、이/가、을/를 的句中作用"], ["动词形容词变形", "现在、过去、将来和敬语形式"], ["连接语尾基础", "原因、转折、顺序和条件表达"], ["固定搭配训练", "动词、名词和常见表达搭配"], ["语境填空", "根据句意选择合适词语或语尾"], ["易混词辨析", "把意思相近的词放进句子里区分"]
  ],
  grammar: [
    ["核心助词辨析", "은/는、이/가、을/를"], ["连接语尾训练", "原因、转折与顺序"], ["动词形容词变形", "时态、敬语与不规则变化"], ["语法变式练习", "先找谓语，再判断结构"]
  ],
  writing: [
    ["句子补全", "对应TOPIK写作51题，练对话和句子空格"], ["短文逻辑补全", "对应TOPIK写作52题，练前后文逻辑"], ["图表说明", "对应TOPIK写作53题，练趋势、比较和总结"], ["议论文结构", "对应TOPIK写作54题，练观点、理由和例证"]
  ],
  review: [
    ["到期错题复盘", "完成1、3、7、14天复习"], ["延迟变式检验", "正确作答并讲明思路"], ["本日知识回忆", "不看笔记复述判断路径"]
  ],
  consolidation: [
    ["阶段综合检验", "用本周内容做一组综合题"], ["错因预防练习", "先看常见误区，再做同型题"], ["延迟巩固练习", "不看笔记完成一组同型题"], ["混合题型串联", "听力、阅读和词汇语法穿插"], ["限时综合检验", "按考试节奏完成一组题"], ["本日知识回忆", "不看笔记复述判断路径"]
  ],
  mock: [["阶段限时模拟", "按正式题型完成并归类错因"]]
};

const ieltsTemplates = {
  listening: [
    ["Listening Section 1", "表格填空与日常对话定位"], ["Listening 地图题", "方位词、路线与地标"], ["Listening 选择题", "识别同义替换和干扰项"], ["Listening 精听复盘", "听写、核对与影子跟读"]
  ],
  reading: [
    ["Reading 判断题", "True / False / Not Given"], ["Reading 段落匹配", "主旨句与信息定位"], ["Reading 填空题", "词性预测和原文同义替换"], ["Reading 限时训练", "20分钟完成一篇文章"]
  ],
  writing: [
    ["Writing Task 1", "信息概括、比较与数据表达"], ["Writing Task 2 提纲", "观点、理由、例证与让步"], ["Writing 段落改写", "主题句与逻辑衔接"], ["Writing 自查", "任务回应、连贯、词汇和语法"]
  ],
  speaking: [
    ["Speaking Part 1", "日常话题快速回答"], ["Speaking Part 2", "1分钟准备与2分钟陈述"], ["Speaking Part 3", "观点展开、比较与原因"], ["口语录音复盘", "流利度、词汇和语法自查"]
  ],
  consolidation: studyTemplates.consolidation,
  review: studyTemplates.review,
  mock: [["IELTS 分项模拟", "按考试时限完成并记录四项表现"]]
};

const ieltsGeneralWriting = [
  ["General Writing Task 1", "书信目的、语气与三项要点"], ["Writing Task 2 提纲", "观点、理由、例证与让步"], ["书信语气改写", "正式、半正式与非正式表达"], ["Writing 自查", "任务回应、连贯、词汇和语法"]
];

const genericTemplates = {
  listening: [["听力理解训练", "定位关键信息并完成练习"], ["听力复听巩固", "复听并记录漏听原因"]],
  reading: [["核心资料阅读", "提炼概念、结构与重点"], ["章节题目训练", "限时完成并标注依据"]],
  vocab: [["核心术语学习", "主动回忆并建立知识卡片"], ["知识点应用", "用例题检验理解"]],
  grammar: [["规则与结构学习", "理解规则并完成变式练习"], ["易错点辨析", "比较相近概念和适用条件"]],
  writing: [["书面输出练习", "按要求完成并自查修改"], ["答题框架训练", "组织观点、依据和结论"]],
  speaking: [["口头表达练习", "录音、复听并重新表达"], ["观点陈述训练", "结论、理由和例子"]],
  consolidation: studyTemplates.consolidation,
  review: studyTemplates.review,
  mock: [["综合模拟练习", "按目标要求完成并归类错因"]]
};

const completionStandards = {
  listening: ["首遍不暂停完成训练", "正确率达到80%", "错题复听并记录漏听词", "次日重做错题"],
  reading: ["在规定时间内完成", "正确率达到80%", "标出答案依据", "错题归类并复述思路"],
  vocab: ["完成主动回忆和语境题", "正确率达到85%", "错词各造一个句子", "次日无提示复习"],
  writing: ["按题目要求限时完成", "检查结构、语法和连接", "修改至少一轮", "记录可复用表达"],
  speaking: ["按规定时间完成录音", "回答切题并展开理由", "复听标记停顿和重复", "重新录制一次"],
  consolidation: ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "完成后可补一句反思"],
  review: ["完成全部到期错题", "完成延迟变式题", "正确率达到90%", "能口头说明判断路径"],
  mock: ["全程不中断、不查词", "按规定时间完成", "记录各部分正确率", "归类全部错题"]
};

const weakTokenMap = { "听力": "listening", "阅读": "reading", "词汇": "vocab", "语法": "grammar", "写作": "writing", "口语": "speaking" };
const planSchemaVersion = "13";

function selectedStudyTokens(settings = {}, fallbackTokens = []) {
  const selected = [...new Set((settings.weak || []).map(item => weakTokenMap[item]).filter(Boolean))];
  return selected.length ? selected : fallbackTokens;
}

function normalizeStudyCategory(token) {
  return token === "grammar" ? "vocab" : token;
}

function defaultStudyTokens(settings = {}) {
  if (settings.exam === "IELTS") return ["listening", "reading", "writing", "speaking"];
  if (settings.exam === "OTHER") return ["reading", "vocab", "writing"];
  if (settings.level === "II") return ["listening", "reading", "writing"];
  return ["listening", "reading"];
}

function scopedConsolidationTemplates(tokens = []) {
  const labels = tokens
    .filter(token => !["consolidation", "mock", "review"].includes(token))
    .map(token => categoryMeta[normalizeStudyCategory(token)]?.label || "")
    .filter(Boolean);
  const scope = [...new Set(labels)].join("和") || "本周内容";
  return [
    ["阶段综合检验", `用本周${scope}做一组综合题`],
    ["错因预防练习", "先看常见误区，再做同型题"],
    ["延迟巩固练习", "不看笔记完成一组同型题"],
    ["限时综合检验", "按学习节奏完成一组题"],
    ["本日知识回忆", "不看笔记复述判断路径"]
  ];
}

function minutesToClock(total) {
  const normalized = Math.max(0, total);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function clockToMinutes(value, fallback) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return fallback;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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

const protectedBreaks = [
  { start: 12 * 60, end: 13 * 60 + 30 },
  { start: 18 * 60, end: 19 * 60 }
];

function overlapsProtectedBreak(start, end) {
  return protectedBreaks.some(rest => start < rest.end && end > rest.start);
}

function splitWindowAroundBreaks(window, blockMinutes) {
  let segments = [{ start: window.start, end: window.end }];
  protectedBreaks.forEach(rest => {
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

function preferredStudyWindows(settings = {}, blockMinutes = 45) {
  const selected = settings.times?.length ? settings.times : ["下午", "晚上"];
  const availableStart = clockToMinutes(settings.availableStart, 8 * 60);
  const availableEnd = clockToMinutes(settings.availableEnd, 22 * 60);
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
  const source = windows.length ? windows : [{ start: availableStart, end: availableEnd }];
  return source.flatMap(window => splitWindowAroundBreaks(window, blockMinutes));
}

function dailyStudyStarts(settings = {}, blocksPerDay = 1, blockMinutes = 45) {
  const availableStart = clockToMinutes(settings.availableStart, 8 * 60);
  const availableEnd = clockToMinutes(settings.availableEnd, 22 * 60);
  const windows = preferredStudyWindows(settings, blockMinutes);
  const gap = settings.intensity === "高强度" ? 15 : 20;
  const candidates = [];
  const windowSlots = windows.map(window => {
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
  const unique = [...new Set(candidates)];
  const starts = [];
  unique.forEach(start => {
    const overlaps = starts.some(existing => Math.abs(existing - start) < blockMinutes + 5);
    if (!overlaps && starts.length < blocksPerDay) starts.push(start);
  });
  return starts.sort((a, b) => a - b);
}

function updateTargetGradeOptions(level = "I", selectedGrade = "") {
  const grades = level === "II" ? ["3", "4", "5", "6"] : ["1", "2"];
  const fallback = level === "II" ? "4" : "2";
  const selected = grades.includes(String(selectedGrade)) ? String(selectedGrade) : fallback;
  $("#targetGradeOptions").innerHTML = grades.map(grade => `<label><input type="radio" name="targetGrade" value="${grade}" ${grade === selected ? "checked" : ""} /><span>${grade}级</span></label>`).join("");
  $("#targetGradeHelp").textContent = level === "II"
    ? "报考 TOPIK II，成绩达到对应分数后评为3级、4级、5级或6级。"
    : "报考 TOPIK I，成绩达到对应分数后评为1级或2级。";
}

function updateExamOptions(exam, level = "I") {
  const isIELTS = exam === "IELTS";
  const isOther = exam === "OTHER";
  const isTopikII = !isIELTS && level === "II";
  $("#levelFieldset").classList.toggle("hidden", isOther);
  $("#targetGradeFieldset").classList.toggle("hidden", exam !== "TOPIK");
  $("#customExamFields").classList.toggle("hidden", !isOther);
  $("#levelLegend").textContent = isIELTS ? "雅思类别" : "考试类型";
  $("#levelOneTitle").textContent = isIELTS ? "学术类" : "TOPIK I";
  $("#levelOneNote").textContent = isIELTS ? "Academic" : "初级试卷 · 听力与阅读";
  $("#levelTwoTitle").textContent = isIELTS ? "培训类" : "TOPIK II";
  $("#levelTwoNote").textContent = isIELTS ? "General Training" : "中高级试卷 · 听力、写作与阅读";
  if (exam === "TOPIK") updateTargetGradeOptions(level, $('input[name="targetGrade"]:checked')?.value);
  $("#vocabWeakOption").classList.toggle("hidden", isIELTS && !isOther);
  $("#grammarWeakOption").classList.toggle("hidden", isIELTS && !isOther);
  $("#writingWeakOption").classList.toggle("hidden", !(isIELTS || isTopikII || isOther));
  $("#speakingWeakOption").classList.toggle("hidden", !(isIELTS || isOther));
  if (isOther) {
    $("#weakHelp").textContent = "请选择适合这个考试或学习项目的能力项；补充范围可写教材章节、老师要求或特殊目标。";
  } else if (isIELTS) {
    $('#vocabWeakOption input').checked = false;
    $('#grammarWeakOption input').checked = false;
    $("#weakHelp").textContent = "雅思按听力、阅读、写作、口语四项安排；学术类与培训类的阅读、写作任务不同。";
  } else {
    $('#speakingWeakOption input').checked = false;
    if (!isTopikII) $('#writingWeakOption input').checked = false;
    $("#weakHelp").textContent = isTopikII
      ? "TOPIK II 包含听力、写作和阅读；词汇、语法作为三部分的基础能力。"
      : "TOPIK I 正式题型为听力和阅读；词汇、语法作为基础能力强化。";
  }
}

function applyExamBrand(exam, level, targetGrade = "") {
  const isIELTS = exam === "IELTS";
  const isOther = exam === "OTHER";
  const customName = $("#customExamName")?.value.trim() || "自定义学习";
  $("#brandMark").textContent = isIELTS ? "英" : (isOther ? "自" : "한");
  $("#profileAvatar").textContent = isIELTS ? "A" : (isOther ? "学" : "유");
  $("#plannerTitle").textContent = isIELTS ? "雅思备考周计划" : (isOther ? `${customName}周计划` : "韩语备考周计划");
  const selectedTarget = targetGrade || $('input[name="targetGrade"]:checked')?.value || (level === "II" ? "4" : "2");
  $("#examEyebrow").textContent = isIELTS
    ? `IELTS ${level === "II" ? "培训类" : "学术类"}`
    : (isOther ? customName : `TOPIK ${level} · 目标 ${selectedTarget}级`);
  document.title = isIELTS ? "IELTS 学习计划" : (isOther ? `${customName}学习计划` : "TOPIK 学习计划");
}

function generatePlanFromSettings(settings) {
  const exam = settings.exam || "TOPIK";
  const level = settings.level || "I";
  const targetMinutes = dailyTargetMinutes(settings);
  const blockMinutes = blockSizeForIntensity(settings);
  const blocksPerDay = Math.max(1, Math.ceil(targetMinutes / blockMinutes));
  const coreTokens = defaultStudyTokens({ exam, level });
  const weakTokens = selectedStudyTokens(settings, coreTokens);
  const templateSource = exam === "IELTS" ? ieltsTemplates : (exam === "OTHER" ? genericTemplates : studyTemplates);
  const rotation = [...new Set([...weakTokens, "consolidation", ...(settings.intensity === "高强度" ? ["mock"] : [])])];
  const foundationOffset = { "入门": 0, "一般": 1, "较好": 2, "不确定": 0 }[settings.foundation] || 0;
  let sequence = 0;
  const categoryCounts = {};
  const generated = [];

  const selectedDayKeys = settings.studyDays?.length ? new Set(settings.studyDays) : new Set(days.map(day => day.key));
  days.filter(day => selectedDayKeys.has(day.key)).forEach((day, dayIndex) => {
    const starts = dailyStudyStarts(settings, blocksPerDay, blockMinutes);
    starts.forEach((start, blockIndex) => {
      let token = rotation[(dayIndex * blocksPerDay + blockIndex) % rotation.length];
      if (day.key === "sat" && blockIndex === blocksPerDay - 1 && rotation.includes("mock")) token = "mock";
      if (day.key === "sun" && blockIndex === blocksPerDay - 1 && rotation.includes("consolidation")) token = "consolidation";
      const category = normalizeStudyCategory(token);
      const templates = exam === "IELTS" && level === "II" && token === "writing"
        ? ieltsGeneralWriting
        : token === "consolidation"
          ? scopedConsolidationTemplates(weakTokens)
          : (templateSource[token] || studyTemplates[token]);
      const categoryIndex = categoryCounts[category] || 0;
      categoryCounts[category] = categoryIndex + 1;
      const template = templates[(categoryIndex + foundationOffset) % templates.length];
      generated.push({
        id: 1000 + sequence,
        day: day.key,
        start: minutesToClock(start),
        end: minutesToClock(start + blockMinutes),
        category,
        displayIndex: categoryIndex,
        title: template[0],
        note: `${settings.studyContent ? `${settings.studyContent.slice(0, 22)} · ` : ""}${template[1]}${weakTokens.map(normalizeStudyCategory).includes(category) ? " · 薄弱项加练" : ""}`,
        status: "planned",
        standards: completionStandards[category] || completionStandards.vocab
      });
      sequence += 1;
    });
  });
  return generated;
}
let importFiles = [];
const importFileLimit = 3;
let recognizedImportItems = [];
let learningMaterialFiles = [];
const learningMaterialLimit = 10;
const samplePreview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#f3efe5"/><rect x="50" y="45" width="540" height="390" rx="12" fill="white" stroke="#d6d0c4"/><text x="82" y="105" font-family="sans-serif" font-size="26" font-weight="700" fill="#24313d">TOPIK I · 词汇语法</text><text x="82" y="165" font-family="sans-serif" font-size="22" fill="#45515b">저는 학교 (  ) 공부해요.</text><text x="98" y="220" font-family="sans-serif" font-size="20" fill="#45515b">① 에　 ② 에서　 ③ 부터　 ④ 에게</text><circle cx="236" cy="213" r="34" fill="none" stroke="#d65c54" stroke-width="5"/><path d="M385 280l22 22 48-58" fill="none" stroke="#3e8c61" stroke-width="8" stroke-linecap="round"/><text x="82" y="350" font-family="sans-serif" font-size="18" fill="#7b8790">示例错题照片</text></svg>`)}`;
const escapeImportText = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function renderImportPreviews() {
  const section = $("#previewSection");
  section.classList.toggle("hidden", !importFiles.length);
  $("#previewCount").textContent = `${importFiles.length} / ${importFileLimit}`;
  $("#selectedFiles").innerHTML = importFiles.map((item, index) => `<article class="selected-file">
    ${item.preview ? `<img src="${item.preview}" alt="${escapeImportText(item.name)}预览" />` : `<span class="file-placeholder">PDF</span>`}
    <button class="remove-preview" type="button" data-remove-import="${index}" aria-label="删除${escapeImportText(item.name)}">×</button>
    <div class="selected-file-info"><strong title="${escapeImportText(item.name)}">${escapeImportText(item.name)}</strong><small>${escapeImportText(item.label)}</small></div>
  </article>`).join("");
  $$('[data-remove-import]').forEach(button => button.addEventListener("click", () => {
    importFiles.splice(Number(button.dataset.removeImport), 1);
    $("#errorFiles").value = "";
    if (!importFiles.length) delete $("#useSampleImport").dataset.sample;
    renderImportPreviews();
  }));
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("图片读取失败")); };
    image.src = objectUrl;
  });
}

function renderRecognizedImportItems(result) {
  recognizedImportItems = Array.isArray(result?.items) ? result.items.slice(0, 30) : [];
  const clearCount = recognizedImportItems.filter(item => item.confidence === "high" && !item.needsConfirmation).length;
  $("#importResults").innerHTML = `<div class="import-summary">
    <span class="overview-icon green">✓</span>
    <div><strong>识别到 ${recognizedImportItems.length} 道错题</strong><small>${clearCount}道可直接导入，${recognizedImportItems.length - clearCount}道建议确认</small></div>
  </div>${recognizedImportItems.map((item, index) => `<article class="recognized-item ${item.needsConfirmation ? "needs-check" : ""}">
    <div><span class="tiny-label">${escapeImportText(item.section || "其他")}</span><span class="confidence ${item.confidence === "high" ? "high" : "low"}">${item.confidence === "high" ? "识别清晰" : "需要确认"}</span></div>
    <strong>${escapeImportText(item.title || item.question || `错题 ${index + 1}`)}</strong>
    <p>你的答案：${escapeImportText(item.userAnswer || "不确定")}　·　正确答案：${escapeImportText(item.correctAnswer || "待确认")}</p>
    <label>你当时为什么会错？
      <select class="import-reason" data-import-reason="${index}"><option>不理解知识点</option><option>凭熟悉感猜答案</option><option>看漏关键信息</option><option>不记得</option></select>
    </label>
  </article>`).join("")}<p class="prototype-note">${escapeImportText(result?.summary || "请确认识别结果后再导入错题集。")}</p>`;
}

function renderLearningMaterialFiles() {
  $("#materialFileList").innerHTML = learningMaterialFiles.map((file, index) => {
    const extension = (file.name.split(".").pop() || "FILE").slice(0, 4).toUpperCase();
    const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    return `<div class="material-file"><span>${escapeImportText(extension)}</span><div><strong>${escapeImportText(file.name)}</strong><small>${size}</small></div><button class="remove-material" type="button" data-remove-material="${index}" aria-label="删除${escapeImportText(file.name)}">×</button></div>`;
  }).join("");
  $$('[data-remove-material]').forEach(button => button.addEventListener("click", () => {
    learningMaterialFiles.splice(Number(button.dataset.removeMaterial), 1);
    renderLearningMaterialFiles();
  }));
}

const sampleErrorItems = [
  {
    id: "e1", filter: ["due", "frequent"], section: "词汇 / 语法", title: "主题助词 은/는 与主格助词 이/가", source: "近7天出现4次 · 正确率52%", frequent: true, due: true,
    focus: "根据语境判断句子是在提出主题，还是强调主语。",
    cause: "看到名词后凭熟悉感选择，没有判断信息结构。",
    reasoning: "先找句子在回答什么问题；介绍主题用은/는，回答“谁/什么”时优先考虑이/가。",
    habit: "看到熟悉选项就立刻作答。",
    action: "读完整句子，再用“主题还是主语”检查一次。",
    progress: "强化包 5 / 25题", reviews: ["done", "current", "", ""]
  },
  {
    id: "e2", filter: ["due"], section: "听力", title: "否定表达漏听：안、못、-지 않다", source: "昨天新增 · 正确率60%", due: true,
    focus: "听清否定形式，避免把“没做”理解成“做了”。",
    cause: "注意力只落在主要动词，漏掉前后的否定成分。",
    reasoning: "先确认肯定或否定，再判断动作和时间。",
    habit: "听到关键词后提前选答案。",
    action: "选答案前强制检查一次否定和时态。",
    progress: "明日复习 0 / 5题", reviews: ["current", "", "", ""]
  },
  {
    id: "e3", filter: [], section: "阅读", title: "公告题中的日期与截止时间", source: "3天前新增 · 正确率75%",
    focus: "区分活动日期、报名日期和截止日期。",
    cause: "只扫到数字，没有核对数字旁边的名词。",
    reasoning: "先读题干问的日期类型，再回原文定位对应名词。",
    habit: "把第一个出现的日期当答案。",
    action: "给每个日期写上“报名/活动/截止”标签。",
    progress: "第2次复习 3 / 5题", reviews: ["done", "current", "", ""]
  },
  {
    id: "e4", filter: ["mastered"], section: "词汇", title: "数量词：명、개、권", source: "已连续两次通过延迟变式", mastered: true,
    focus: "人物、物品和书籍使用不同量词。",
    cause: "混淆量词适用对象。",
    reasoning: "先判断对象类别，再选择对应量词。",
    habit: "只背中文意思，不记搭配。",
    action: "以名词＋量词组合记忆。",
    progress: "已掌握", reviews: ["done", "done", "done", "done"],
    masteredAt: "2026年6月19日",
    masteryHistory: [
      { date: "6月5日", stage: "首次错题", result: "6 / 10", note: "混淆 명、개、권 的适用对象" },
      { date: "6月8日", stage: "3天复习", result: "9 / 10", note: "完成基础辨析，书籍量词仍错1题" },
      { date: "6月12日", stage: "第1次延迟变式", result: "5 / 5", note: "全部正确，并能按对象类别说明理由" },
      { date: "6月19日", stage: "第2次延迟变式", result: "5 / 5", note: "全部正确，口头讲清判断顺序" }
    ]
  }
];
const errorItems = [
  ...(JSON.parse(localStorage.getItem("topikPrototypeImportedErrors") || "[]")),
  ...(JSON.parse(localStorage.getItem("topikPrototypePracticeErrors") || "[]"))
];
let showingSampleErrors = false;

const particleQuestions = [
  { stem: "저___ 학생입니다.", options: ["는", "가", "를", "에"], answer: 0, explanation: "句子是在介绍“我”这个主题，用 저는。" },
  { stem: "누가 왔어요? 민수___ 왔어요.", options: ["는", "가", "를", "도"], answer: 1, explanation: "回答“谁来了”，强调主语，用 민수가。" },
  { stem: "이 책___ 아주 재미있어요.", options: ["을", "이", "에", "와"], answer: 1, explanation: "“这本书”是形容词 재미있다 的主语，用 이。" },
  { stem: "저___ 커피를 좋아해요.", options: ["는", "가", "를", "에서"], answer: 0, explanation: "谈论“我”的喜好，以“我”为主题，用 저는。" },
  { stem: "어떤 음식___ 제일 맛있어요?", options: ["은", "가", "를", "하고"], answer: 1, explanation: "询问“什么食物最好吃”，疑问焦点是主语，用 이/가。" },
  { stem: "오늘 날씨___ 좋아요.", options: ["를", "가", "에게", "부터"], answer: 1, explanation: "날씨 是 좋아요 的主语，用 가。" },
  { stem: "한국어___ 어렵지만 재미있어요.", options: ["는", "가", "를", "로"], answer: 0, explanation: "提出“韩语”作为谈论主题，并形成对比，用 는。" },
  { stem: "누가 선생님이에요? 저분___ 선생님이에요.", options: ["은", "이", "을", "과"], answer: 1, explanation: "回答“谁是老师”，强调 저분 这个主语，用 이。" },
  { stem: "봄___ 따뜻하고 꽃이 많아요.", options: ["은", "이", "을", "에게"], answer: 0, explanation: "以“春天”为整句主题，用 은。" },
  { stem: "교실에 학생___ 많아요.", options: ["은", "이", "를", "까지"], answer: 1, explanation: "学生是“多”的主语，用 이。" }
];

const placeParticleQuestions = [
  { stem: "저는 학교___ 공부해요.", options: ["에", "에서", "부터", "에게"], answer: 1, explanation: "공부하다 是发生在学校的动作，动作场所用 에서。" },
  { stem: "지금 친구가 집___ 있어요.", options: ["에", "에서", "하고", "까지"], answer: 0, explanation: "있다 表示存在，存在地点用 에。" },
  { stem: "주말에 도서관___ 책을 읽어요.", options: ["에", "에서", "보다", "에게"], answer: 1, explanation: "읽다 是在图书馆进行的动作，动作场所用 에서。" },
  { stem: "다음 달에 한국___ 가요.", options: ["에", "에서", "와", "만"], answer: 0, explanation: "가다 表示移动，目的地用 에。" },
  { stem: "아침마다 공원___ 운동해요.", options: ["에", "에서", "의", "도"], answer: 1, explanation: "운동하다 是在公园发生的动作，动作场所用 에서。" }
];
const topikIReadingFallbackQuestions = [
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
    stemZh: "阅读广告信息：韩빛书店6月1日到6月10日有图书打折活动，小说打八折，儿童书打七折。",
    options: ["행사는 한 달 동안 합니다.", "어린이 책은 30% 할인합니다.", "장소는 도서관입니다.", "소설은 할인하지 않습니다."],
    optionTranslations: ["活动持续一个月。", "儿童书打七折。", "地点在图书馆。", "小说不打折。"],
    answer: 1,
    answerZh: "儿童书打七折。",
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
];
const materialPracticeBank = [
  {
    id: "topik-i-reading-signs-v1",
    exam: "TOPIK",
    level: "I",
    category: "reading",
    title: "TOPIK I 阅读：标识与公告理解",
    sourceTitle: "用户资料《完全掌握 TOPIK I 初级阅读》",
    questions: [
      {
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
        materialImage: "assets/materials/topik1-reading/question/question-101.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读音乐会海报，选择与内容不一致的一项。",
        options: ["서울 벚꽃 음악회는 3일 동안 열립니다.", "서울 벚꽃 음악회는 하루에 두 번씩 열립니다.", "서울 벚꽃 음악회는 4월에 열립니다.", "서울 벚꽃 음악회는 누구나 참여할 수 있습니다."],
        optionTranslations: ["首尔樱花音乐会举办3天。", "首尔樱花音乐会每天举行两场。", "首尔樱花音乐会在4月举行。", "首尔樱花音乐会任何人都可以参加。"],
        answer: 1,
        answerZh: "首尔樱花音乐会每天举行两场。",
        explanation: "4월 4일은 정오 1회, 4월 5일은 저녁 7시 1회, 4월 6일은 오후 4시와 저녁 7시 2회입니다.",
        explanationZh: "海报中三天的场次不同，并不是每天都有两场，所以该选项不符合内容。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.85 · 标识阅读"
      },
      {
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
const listeningFallbackScript = "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.";
const listeningFallbackScriptZh = "男：秀珍，我今天可能去不了社团会议了。突然打工时间变了。女：是吗？那请你明天上午之前把意见用短信发给我吧。我会在会议上替你说。男：谢谢。我会整理好关于海报设计的意见发过去。";
const listeningFallbackQuestions = [
  { audioText: listeningFallbackScript, transcript: listeningFallbackScript, transcriptZh: listeningFallbackScriptZh, stem: "남자가 오늘 동아리 회의에 못 가는 이유는 무엇입니까?", options: ["포스터를 아직 만들지 못해서", "아르바이트 시간이 바뀌어서", "의견을 정리하지 못해서", "내일 오전에 약속이 있어서"], optionTranslations: ["因为还没做完海报", "因为打工时间变了", "因为还没整理好意见", "因为明天上午有约"], answer: 1, answerZh: "因为打工时间变了", explanation: "남자는 갑자기 아르바이트 시간이 바뀌어서 오늘 동아리 회의에 못 간다고 말했습니다.", explanationZh: "男生说自己突然打工时间变了，所以今天不能去社团会议。", source: "TOPIK II listening reason type" },
  { audioText: listeningFallbackScript, transcript: listeningFallbackScript, transcriptZh: listeningFallbackScriptZh, stem: "여자는 남자에게 무엇을 하라고 했습니까?", options: ["회의에 늦게 오라고 했습니다", "포스터를 바로 만들라고 했습니다", "의견을 문자로 보내라고 했습니다", "아르바이트 시간을 바꾸라고 했습니다"], optionTranslations: ["让他晚点来会议", "让他马上做海报", "让他把意见用短信发过去", "让他改打工时间"], answer: 2, answerZh: "让他把意见用短信发过去", explanation: "여자는 내일 오전까지 의견을 문자로 보내 달라고 했습니다.", explanationZh: "女生让男生在明天上午之前把意见用短信发给她。", source: "TOPIK II listening action type" },
  { audioText: listeningFallbackScript, transcript: listeningFallbackScript, transcriptZh: listeningFallbackScriptZh, stem: "남자는 무엇에 대한 의견을 보내겠다고 했습니까?", options: ["회의 시간", "포스터 디자인", "동아리 장소", "아르바이트 일정"], optionTranslations: ["会议时间", "海报设计", "社团地点", "打工日程"], answer: 1, answerZh: "海报设计", explanation: "남자는 포스터 디자인에 대한 의견을 정리해서 보내겠다고 했습니다.", explanationZh: "男生说会整理关于海报设计的意见并发过去。", source: "TOPIK II listening detail type" },
  { audioText: listeningFallbackScript, transcript: listeningFallbackScript, transcriptZh: listeningFallbackScriptZh, stem: "대화 내용과 같은 것을 고르십시오.", options: ["남자는 회의에서 발표할 것입니다", "여자는 남자의 의견을 대신 말할 것입니다", "회의는 내일 오전에 열립니다", "포스터는 이미 완성되었습니다"], optionTranslations: ["男生会在会议上发表", "女生会代替男生转达意见", "会议会在明天上午举行", "海报已经完成了"], answer: 1, answerZh: "女生会代替男生转达意见", explanation: "여자는 회의에서 남자의 의견을 대신 말해 주겠다고 했습니다.", explanationZh: "女生说会在会议上替男生转达他的意见。", source: "TOPIK II listening matching type" },
  { audioText: listeningFallbackScript, transcript: listeningFallbackScript, transcriptZh: listeningFallbackScriptZh, stem: "이 대화에서 남자의 말하기 목적은 무엇입니까?", options: ["회의에 못 가는 상황을 설명하려고", "포스터 디자인을 칭찬하려고", "아르바이트를 소개하려고", "회의 장소를 확인하려고"], optionTranslations: ["为了说明不能去会议的情况", "为了称赞海报设计", "为了介绍打工", "为了确认会议地点"], answer: 0, answerZh: "为了说明不能去会议的情况", explanation: "남자는 아르바이트 시간이 바뀌어 회의에 못 간다는 상황을 설명하고 있습니다.", explanationZh: "男生是在说明因为打工时间变动，所以不能参加会议。", source: "TOPIK II listening purpose type" }
];

const examLabelMap = {
  TOPIK: "TOPIK",
  IELTS: "IELTS",
  OTHER: "自定义学习"
};

let activeTaskId = null;
let activePractice = particleQuestions.slice(0, 5);
let questionIndex = 0;
let selectedAnswer = null;
let questionGraded = false;
let practiceCorrect = 0;
let practiceTaskId = null;
let practiceErrorId = null;
let practiceWrongNotes = [];
let practiceResults = [];
let practiceIsSample = false;
let practiceReviewMode = "learning";
let listeningPlayCounts = {};
let listeningIsSpeaking = false;
let activeCalendarFilter = "all";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const cloud = { config: null, session: null, saveTimer: null, syncing: false, savePending: false, lastError: "" };
const dailyReminder = { timer: null };

function readReminderSettings() {
  const saved = JSON.parse(localStorage.getItem("topikPrototypeDailyReminder") || "null") || {};
  return {
    enabled: Boolean(saved.enabled),
    time: /^\d{2}:\d{2}$/.test(saved.time || "") ? saved.time : "21:30",
    lastNotifiedDate: saved.lastNotifiedDate || ""
  };
}

function writeReminderSettings(next) {
  const settings = { ...readReminderSettings(), ...next };
  localStorage.setItem("topikPrototypeDailyReminder", JSON.stringify(settings));
  renderReminderUI();
  scheduleDailyReminder();
  scheduleCloudSave();
  return settings;
}

function cloudHeaders(token = "") {
  return {
    apikey: cloud.config.anonKey,
    Authorization: `Bearer ${token || cloud.config.anonKey}`,
    "Content-Type": "application/json"
  };
}

function currentCloudState() {
  return {
    tasks,
    importedErrors: errorItems.filter(item => String(item.id).startsWith("imported-")),
    practiceErrors: errorItems.filter(item => String(item.id).startsWith("practice-")),
    settings: JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null"),
    onboarded: localStorage.getItem("topikPrototypeOnboarded") || "",
    planVersion: localStorage.getItem("topikPrototypePlanVersion") || "5",
    tomorrowFocus: localStorage.getItem("topikPrototypeTomorrowFocus") || "",
    dailyReminder: readReminderSettings(),
    rewards: readRewardState()
  };
}

function applyCloudState(data) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data.tasks)) localStorage.setItem("topikPrototypeTasks", JSON.stringify(data.tasks));
  if (Array.isArray(data.importedErrors)) localStorage.setItem("topikPrototypeImportedErrors", JSON.stringify(data.importedErrors));
  if (Array.isArray(data.practiceErrors)) localStorage.setItem("topikPrototypePracticeErrors", JSON.stringify(data.practiceErrors));
  if (data.settings) localStorage.setItem("topikPrototypeSettings", JSON.stringify(data.settings));
  if (data.onboarded) localStorage.setItem("topikPrototypeOnboarded", data.onboarded);
  if (data.planVersion) localStorage.setItem("topikPrototypePlanVersion", data.planVersion);
  if (data.tomorrowFocus) localStorage.setItem("topikPrototypeTomorrowFocus", data.tomorrowFocus);
  if (data.dailyReminder) localStorage.setItem("topikPrototypeDailyReminder", JSON.stringify(data.dailyReminder));
  if (data.rewards) localStorage.setItem("topikPrototypeRewards", JSON.stringify(data.rewards));
}

function storeCloudSession(session) {
  cloud.session = session || null;
  if (session) localStorage.setItem("studyPlannerCloudSession", JSON.stringify(session));
  else localStorage.removeItem("studyPlannerCloudSession");
  updateCloudUI();
}

function readAuthRedirectSession() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const errorMessage = params.get("error_description");
  if (errorMessage) {
    history.replaceState({}, document.title, location.pathname + location.search);
    showToast(errorMessage.replace(/\+/g, " "));
    return null;
  }
  if (!accessToken || !refreshToken) return null;
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get("token_type") || "bearer",
    expires_in: Number(params.get("expires_in") || 3600),
    user: null
  };
  history.replaceState({}, document.title, location.pathname + location.search);
  return session;
}

async function cloudRequest(path, options = {}, retry = true) {
  const response = await fetch(`${cloud.config.url}${path}`, {
    ...options,
    headers: { ...cloudHeaders(cloud.session?.access_token), ...(options.headers || {}) }
  });
  if (response.status === 401 && retry && cloud.session?.refresh_token) {
    const refreshed = await fetch(`${cloud.config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: cloudHeaders(), body: JSON.stringify({ refresh_token: cloud.session.refresh_token })
    });
    if (refreshed.ok) {
      storeCloudSession(await refreshed.json());
      return cloudRequest(path, options, false);
    }
    storeCloudSession(null);
  }
  return response;
}

function updateCloudUI() {
  const connected = Boolean(cloud.session?.access_token);
  $("#openAccount").classList.toggle("connected", connected);
  $("#accountState").textContent = connected
    ? (cloud.syncing ? "同步中" : (cloud.lastError ? "同步失败" : "已同步"))
    : (cloud.config?.enabled ? "未登录" : "待配置");
  $("#signedOutAccount").classList.toggle("hidden", connected);
  $("#signedInAccount").classList.toggle("hidden", !connected);
  $("#signedInActions").classList.toggle("hidden", !connected);
  if (connected) {
    $("#signedInEmail").textContent = cloud.session.user?.email || "已登录";
    const last = localStorage.getItem("topikPrototypeCloudUpdatedAt");
    $("#lastSyncText").textContent = last ? `最近同步：${new Date(last).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` : "学习进度已自动保存";
  }
}

async function saveCloudState(showMessage = false) {
  if (!cloud.config?.enabled || !cloud.session?.user?.id) return false;
  if (cloud.syncing) {
    cloud.savePending = true;
    return false;
  }
  cloud.syncing = true;
  cloud.lastError = "";
  updateCloudUI();
  const updatedAt = new Date().toISOString();
  let saved = false;
  try {
    const response = await cloudRequest("/rest/v1/study_state?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: cloud.session.user.id, data: currentCloudState(), updated_at: updatedAt })
    });
    if (!response.ok) throw new Error("同步失败");
    saved = true;
    localStorage.setItem("topikPrototypeCloudUpdatedAt", updatedAt);
    if (showMessage) showToast("学习进度已同步到云端");
  } catch {
    cloud.lastError = "同步失败";
    if (showMessage) showToast("暂时无法同步，请稍后重试");
  } finally {
    cloud.syncing = false;
    updateCloudUI();
    if (cloud.savePending) {
      cloud.savePending = false;
      setTimeout(() => saveCloudState(false), 0);
    }
  }
  return saved;
}

function scheduleCloudSave() {
  clearTimeout(cloud.saveTimer);
  cloud.saveTimer = setTimeout(() => saveCloudState(false), 700);
}

async function loadCloudState(force = false) {
  if (!cloud.session?.user?.id) return;
  const response = await cloudRequest(`/rest/v1/study_state?select=data,updated_at&user_id=eq.${cloud.session.user.id}&limit=1`);
  if (!response.ok) return;
  const rows = await response.json();
  if (!rows.length) return saveCloudState(true);
  const remote = rows[0];
  const localTime = localStorage.getItem("topikPrototypeCloudUpdatedAt") || "";
  if (force || remote.updated_at > localTime) {
    applyCloudState(remote.data);
    localStorage.setItem("topikPrototypeCloudUpdatedAt", remote.updated_at);
    showToast("已恢复云端学习进度");
    setTimeout(() => location.reload(), 500);
  }
}

async function authenticateCloud(mode) {
  if (!cloud.config?.enabled) return showToast("云同步尚未配置完成");
  const email = $("#accountEmail").value.trim();
  const password = $("#accountPassword").value;
  if (!email || password.length < 6) return showToast("请填写邮箱和至少6位密码");
  const button = mode === "signup" ? $("#signUpButton") : $("#signInButton");
  button.disabled = true;
  button.textContent = mode === "signup" ? "正在注册…" : "正在登录…";
  try {
    const redirectTo = encodeURIComponent(location.origin + location.pathname);
    const path = mode === "signup" ? `/auth/v1/signup?redirect_to=${redirectTo}` : "/auth/v1/token?grant_type=password";
    const response = await fetch(`${cloud.config.url}${path}`, { method: "POST", headers: cloudHeaders(), body: JSON.stringify({ email, password }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const rawMessage = payload.message || payload.msg || payload.error_description || payload.error || "操作失败";
      const friendlyMessage = /invalid api key/i.test(rawMessage)
        ? "云同步密钥无效，请检查Vercel中的SUPABASE_ANON_KEY"
        : /signup.*disabled|signups.*disabled/i.test(rawMessage)
          ? "当前项目尚未开启邮箱注册"
          : /password/i.test(rawMessage) && /least|characters|weak/i.test(rawMessage)
            ? "密码强度不足，请使用至少6位密码"
            : /already registered|already been registered|user already exists/i.test(rawMessage)
              ? "该邮箱已经注册，请直接登录"
              : rawMessage;
      throw new Error(friendlyMessage);
    }
    if (!payload.access_token) {
      showToast("注册成功，请先到邮箱点击确认链接");
    } else {
      storeCloudSession(payload);
      await loadCloudState(true);
      closeModal("accountModal");
      showToast(mode === "signup" ? "注册成功，已开启云同步" : "登录成功，正在恢复进度");
    }
  } catch (error) { showToast(error.message || "操作失败，请重试"); }
  finally {
    button.disabled = false;
    button.textContent = mode === "signup" ? "注册账号" : "登录并同步";
  }
}

async function initializeCloud() {
  if (location.protocol === "file:") { updateCloudUI(); return; }
  try {
    const response = await fetch("/api/cloud-config", { cache: "no-store" });
    cloud.config = await response.json();
  } catch { cloud.config = { enabled: false }; }
  const redirected = readAuthRedirectSession();
  const stored = redirected || JSON.parse(localStorage.getItem("studyPlannerCloudSession") || "null");
  if (stored?.access_token) {
    storeCloudSession(stored);
    const userResponse = await cloudRequest("/auth/v1/user");
    if (userResponse.ok) {
      cloud.session.user = await userResponse.json();
      storeCloudSession(cloud.session);
      await loadCloudState(false);
      if (redirected) showToast("邮箱确认成功，已自动登录并开启云同步");
    } else storeCloudSession(null);
  } else updateCloudUI();
}

function minutesBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function hasPracticeRecord(task = {}) {
  return Number.isFinite(Number(task.checkin?.correct)) && Number(task.checkin?.total) > 0;
}

function completedPracticeTasks() {
  return tasks.filter(hasPracticeRecord);
}

function accuracyFor(items = []) {
  const total = items.reduce((sum, task) => sum + Number(task.checkin?.total || 0), 0);
  const correct = items.reduce((sum, task) => sum + Number(task.checkin?.correct || 0), 0);
  return total ? Math.round((correct / total) * 100) : null;
}

function renderProgressView() {
  const records = completedPracticeTasks();
  const mockRecords = records.filter(task => task.category === "mock");
  const latestMockRate = accuracyFor(mockRecords.slice(-1));
  $("#scorePill").classList.toggle("is-empty", latestMockRate === null);
  $("#scorePill").innerHTML = latestMockRate === null
    ? "<small>当前模拟</small><strong>暂无</strong><span>完成模拟后生成</span>"
    : `<small>当前模拟</small><strong>${Math.round(latestMockRate * 2)} / 200</strong><span>按最近一次模拟估算</span>`;

  if (!records.length) {
    $("#progressGrid").innerHTML = `<article class="chart-card wide progress-empty-card">
      <div class="card-title"><div><p>真实学习数据</p><strong>暂无练习记录</strong></div></div>
      <p>完成第一组系统练习后，这里才会显示正确率、能力分布和连续学习。现在不会使用演示数据。</p>
    </article>
    <article class="chart-card progress-empty-card">
      <div class="card-title"><div><p>能力分布</p><strong>等待答题数据</strong></div></div>
      <p>听力、阅读、写作等分项会根据真实答题结果更新。</p>
    </article>
    <article class="chart-card">
      <div class="card-title"><div><p>本周习惯</p><strong>还未开始</strong></div></div>
      <div class="habit-days">${["一", "二", "三", "四", "五", "六", "日"].map(label => `<span>${label}</span>`).join("")}</div>
      <p class="habit-note">完成当天任一组系统练习后，会点亮对应日期。</p>
    </article>`;
    return;
  }

  const recent = records.slice(-4);
  const categoryLabels = { listening: "听力", reading: "阅读", vocab: "词汇语法", writing: "写作", speaking: "口语", mock: "模拟", consolidation: "巩固", review: "错题" };
  const categories = [...new Set(records.map(task => task.category))].slice(0, 5);
  const completedDays = new Set(records.map(task => task.day));
  const streakDays = days.filter(day => completedDays.has(day.key)).length;
  const overallRate = accuracyFor(records);
  $("#progressGrid").innerHTML = `<article class="chart-card wide">
    <div class="card-title"><div><p>最近练习正确率</p><strong>${overallRate}% · 来自真实答题</strong></div></div>
    <div class="bar-chart" aria-label="最近练习正确率柱状图">
      ${recent.map((task, index) => {
        const rate = accuracyFor([task]) || 0;
        return `<div><i style="height:${Math.max(8, rate)}%"></i><span>第${records.length - recent.length + index + 1}组</span><b>${rate}%</b></div>`;
      }).join("")}
    </div>
  </article>
  <article class="chart-card">
    <div class="card-title"><div><p>能力分布</p><strong>按已完成练习统计</strong></div></div>
    <div class="skill-bars">
      ${categories.map(category => {
        const rate = accuracyFor(records.filter(task => task.category === category)) || 0;
        return `<div><span>${categoryLabels[category] || "练习"}</span><i><em style="width:${rate}%"></em></i><b>${rate}%</b></div>`;
      }).join("")}
    </div>
  </article>
  <article class="chart-card">
    <div class="card-title"><div><p>本周习惯</p><strong>已学习 ${streakDays} 天</strong></div></div>
    <div class="habit-days">${days.map((day, index) => `<span class="${completedDays.has(day.key) ? "done" : ""}">${["一", "二", "三", "四", "五", "六", "日"][index]}</span>`).join("")}</div>
    <p class="habit-note">数据只来自已完成的系统练习。</p>
  </article>`;
}

function taskDisplayTitle(task = {}, index = 0) {
  const rawTitle = String(task.title || "");
  if (task.customTitle && rawTitle) return rawTitle;
  const cleanedTitle = rawTitle.replace(/^(听力|阅读|词汇\s*\/\s*语法|词汇|语法|写作|巩固练习|模拟测验|错题复盘)[：:]\s*/, "");
  if (cleanedTitle && cleanedTitle !== rawTitle) return cleanedTitle;
  if (/^(IELTS|雅思|学习)\s/.test(rawTitle)) return rawTitle;
  if (rawTitle && !/^TOPIK\s+[I]{1,2}\s/.test(rawTitle) && !/target grade|listening|reading|writing|speaking|vocab|grammar|review|consolidation/i.test(rawTitle)) return rawTitle;
  const settings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {};
  const examPrefix = settings.exam === "IELTS"
    ? "IELTS"
    : (settings.exam === "TOPIK" ? "" : (settings.customExamName || "学习"));
  const titleMap = {
    listening: ["听人物和地点", "听下一步行动", "听原因和理由", "听数字和时间", "听内容一致", "听否定和时态", "看图听关键词", "听后复述"],
    writing: ["写作：句子补全", "写作：短文逻辑补全", "写作：图表说明", "写作：议论文结构"],
    reading: ["公告信息读取", "广告信息读取", "短文大意理解", "题干关键词定位", "图表信息读取", "句子连接判断", "限时阅读"],
    vocab: ["生活场景词汇", "基础助词辨析", "动词形容词变形", "连接语尾基础", "固定搭配训练", "语境填空", "易混词辨析"],
    grammar: ["基础助词辨析", "连接语尾基础", "句子结构判断", "时态与敬语"],
    consolidation: ["错因预防练习", "延迟巩固练习", "混合题型串联", "限时综合练习", "本日知识回忆"],
    review: ["错题复盘：同类变式题", "错题复盘：到期题重做", "错题复盘：判断路径"],
    mock: ["阶段模拟：限时综合练习"]
  };
  const options = titleMap[task.category] || ["学习任务"];
  const displayIndex = Number.isInteger(task.displayIndex) ? task.displayIndex : index;
  return [examPrefix, options[displayIndex % options.length]].filter(Boolean).join(" ");
}

function taskDisplayNote(task = {}, index = 0) {
  const settings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {};
  const rawNote = String(task.note || "");
  if (task.customTitle || settings.exam !== "TOPIK" || settings.level === "II") return rawNote;
  const token = normalizeStudyCategory(task.category);
  const templates = studyTemplates[token] || studyTemplates.consolidation || [];
  const displayIndex = Number.isInteger(task.displayIndex) ? task.displayIndex : index;
  const templateNote = templates[displayIndex % templates.length]?.[1] || "";
  const looksLikeOldGeneratedNote = /^围绕目标\d级/.test(rawNote) || /综合同型题|基础句型和高频表达|公告、广告和短文信息/.test(rawNote);
  return looksLikeOldGeneratedNote && templateNote ? templateNote : rawNote;
}

function taskTrainingPoint(task = {}, index = 0) {
  const title = taskDisplayTitle(task, index);
  const parts = title.split("：");
  const hasModulePrefix = parts.length > 1;
  const moduleName = hasModulePrefix
    ? parts[0].replace(/^TOPIK\s+[I]{1,2}\s+/, "").replace(/^IELTS\s+/, "").trim()
    : (categoryMeta[task.category]?.label || "练习");
  const point = hasModulePrefix ? parts.slice(1).join("：") : title;
  const note = taskDisplayNote(task, index).replace(/^围绕目标\d级/, "目标训练：").replace(/^目标训练：/, "目标训练：");
  return { moduleName, point, note };
}

function renderCalendar() {
  days = buildCurrentWeekDays();
  const weekRangeTitle = $("#weekRangeTitle");
  if (weekRangeTitle) weekRangeTitle.textContent = `${days[0].date}—${days[6].date}`;
  const calendar = $("#weekCalendar");
  const visibleCategories = new Set(tasks.filter(task => task.status !== "cancelled").map(task => task.category));
  if (activeCalendarFilter !== "all" && !visibleCategories.has(activeCalendarFilter)) activeCalendarFilter = "all";
  $$("[data-calendar-filter]").forEach(button => {
    const filter = button.dataset.calendarFilter;
    button.classList.toggle("hidden", filter !== "all" && !visibleCategories.has(filter));
  });
  $("#calendarLegend")?.classList.toggle("has-filter", activeCalendarFilter !== "all");
  $$("[data-calendar-filter]").forEach(button => {
    const active = button.dataset.calendarFilter === activeCalendarFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  calendar.innerHTML = days.map(day => {
    const dayTasks = tasks.filter(task => task.day === day.key);
    const activeDayTasks = dayTasks.filter(task => task.status !== "cancelled");
    const total = activeDayTasks.reduce((sum, task) => sum + minutesBetween(task.start, task.end), 0);
    return `<article class="day-column ${day.featured ? "today" : ""}">
      <header class="day-head">
        <p><span>${day.en}</span><span>${day.date}</span></p>
        <h3>${day.name}</h3>
        <small>${day.featured ? "今天 · " : ""}${Math.floor(total / 60)}小时${total % 60 ? `${total % 60}分钟` : ""}</small>
      </header>
      ${dayTasks.map(task => {
        const meta = categoryMeta[task.category] || categoryMeta.consolidation;
        const duration = minutesBetween(task.start, task.end);
        const title = taskDisplayTitle(task, tasks.indexOf(task));
        const dimmed = activeCalendarFilter !== "all" && task.category !== activeCalendarFilter;
        return `<div class="task-card ${meta.className} ${task.status} ${dimmed ? "dimmed" : ""}" data-task-id="${task.id}" data-task-category="${task.category}" tabindex="0" role="button">
          <div class="task-time"><span>◷ ${task.start}–${task.end}</span><span>${meta.label}</span></div>
          <h4>${title}</h4>
          <p>${taskDisplayNote(task, tasks.indexOf(task))}</p>
          <span class="task-duration">${task.status === "cancelled" ? "已取消" : `${duration}分钟`}</span>
        </div>`;
      }).join("")}
    </article>`;
  }).join("");

  $$(".task-card").forEach(card => {
    card.addEventListener("click", () => openTask(Number(card.dataset.taskId)));
    card.addEventListener("keydown", event => { if (event.key === "Enter") openTask(Number(card.dataset.taskId)); });
  });
  updateProgress();
}

function applyCalendarFilter(filter = "all") {
  activeCalendarFilter = activeCalendarFilter === filter ? "all" : filter;
  renderCalendar();
}

function updateProgress() {
  const planned = tasks
    .filter(task => task.status !== "cancelled")
    .reduce((sum, task) => sum + minutesBetween(task.start, task.end), 0);
  const completed = completedPracticeTasks().reduce((sum, task) => sum + minutesBetween(task.start, task.end), 0);
  const percentage = planned ? Math.round(completed / planned * 100) : 0;
  $("#plannedHours").textContent = `${(planned / 60).toFixed(1)} 小时`;
  $("#completedHours").textContent = `${(completed / 60).toFixed(1)} 小时`;
  $("#progressText").textContent = `${percentage}%`;
  $("#progressBar").style.width = `${percentage}%`;
  renderProgressView();
}

function renderErrors(filter = "all") {
  $("#dueOverviewCount").textContent = `${errorItems.filter(item => item.due && !item.mastered).length} 个知识点`;
  $("#frequentOverviewCount").textContent = `${errorItems.filter(item => item.frequent && !item.mastered).length} 个强化包`;
  $("#masteredOverviewCount").textContent = `${errorItems.filter(item => item.mastered).length} 个知识点`;
  $("#errorBadge").textContent = errorItems.filter(item => !item.mastered).length;
  const dueItems = errorItems.filter(item => item.due && !item.mastered);
  $("#startDueReview").disabled = !dueItems.length;
  $("#startDueReview").textContent = dueItems.length ? "开始今日复习 · 5题" : "暂无到期复习";
  if (!errorItems.length && !showingSampleErrors) {
    $("#errorList").innerHTML = `<div class="error-empty-state">
      <span class="error-empty-icon">◎</span>
      <h3>错题集还是空的</h3>
      <p>做题后会自动整理错因、正确思路和1、3、7、14天复习安排。</p>
      <div><button class="primary-button" id="emptyImportErrors">导入第一批错题</button><button class="secondary-button" id="showSampleErrors">查看示例错题</button></div>
    </div>`;
    $("#emptyImportErrors").addEventListener("click", () => openModal("importModal"));
    $("#showSampleErrors").addEventListener("click", () => { showingSampleErrors = true; renderErrors("all"); });
    return;
  }
  const sourceItems = showingSampleErrors ? sampleErrorItems : errorItems;
  const items = sourceItems.filter(item => filter === "all" || item.filter.includes(filter));
  const sampleBanner = showingSampleErrors ? `<div class="sample-errors-banner"><div><strong>示例错题</strong><span>仅用于体验，不计入统计和复习安排。</span></div><button class="secondary-button" id="hideSampleErrors">返回我的错题集</button></div>` : "";
  $("#errorList").innerHTML = sampleBanner + items.map(item => `<article class="error-card ${showingSampleErrors ? "sample-error-card" : ""}">
    <div class="error-top">
      <div>
        <div class="error-labels">
          <span class="tiny-label">${item.section}</span>
          ${item.frequent ? '<span class="tiny-label frequent">高频错误</span>' : ""}
          ${item.due ? '<span class="tiny-label due">今日到期</span>' : ""}
          ${item.mastered ? '<span class="tiny-label mastered">已掌握</span>' : ""}
        </div>
        <h3>${item.title}</h3>
        <p class="source">${item.source}</p>
      </div>
    </div>
    <div class="error-grid">
      <div class="error-field"><span>错题重点</span><p>${item.focus}</p></div>
      <div class="error-field"><span>具体错误原因</span><p>${item.cause}</p></div>
      <div class="error-field"><span>正确思考路径</span><p>${item.reasoning}</p></div>
      <div class="error-field"><span>要改的习惯 → 改进动作</span><p>${item.habit}<br><strong>${item.action}</strong></p></div>
    </div>
    <div class="error-actions">
      <div>
        <div class="review-timeline">${item.reviews.map((state, index) => `<span class="review-dot ${state}">${[1,3,7,14][index]}天</span>`).join("")}</div>
        <div class="pack-progress">${item.progress}</div>
      </div>
      ${item.mastered ? `<button class="secondary-button mastery-record-trigger" data-mastery-id="${item.id}" data-sample="${showingSampleErrors}">查看记录</button>` : `<button class="${item.frequent ? "primary-button" : "secondary-button"} practice-trigger" data-error-id="${item.id}" data-sample="${showingSampleErrors}">${showingSampleErrors ? "体验示例练习" : (item.frequent ? "继续强化练习" : "开始复习")}</button>`}
    </div>
  </article>`).join("") || '<div class="error-card"><p>这里暂时没有记录。</p></div>';

  $("#hideSampleErrors")?.addEventListener("click", () => { showingSampleErrors = false; renderErrors("all"); });
  $$(".practice-trigger").forEach(button => button.addEventListener("click", () => startPractice(button.dataset.errorId, null, button.dataset.sample === "true")));
  $$(".mastery-record-trigger").forEach(button => button.addEventListener("click", () => openMasteryRecord(button.dataset.masteryId, button.dataset.sample === "true")));
}

function openMasteryRecord(id, isSample = false) {
  const item = (isSample ? sampleErrorItems : errorItems).find(error => error.id === id);
  if (!item) return;
  $("#masteryRecordTitle").textContent = item.title;
  $("#masteryRecordMeta").textContent = `${item.masteredAt}标记为已掌握`;
  $("#masteryHistory").innerHTML = (item.masteryHistory || []).map(entry => `<li>
    <span class="history-date">${entry.date}</span><div><strong>${entry.stage}<b>${entry.result}</b></strong><p>${entry.note}</p></div>
  </li>`).join("");
  openModal("masteryRecordModal");
}

function openTask(id) {
  activeTaskId = id;
  const task = tasks.find(item => item.id === id);
  const taskModalPanel = $("#taskModal .task-panel");
  taskModalPanel?.classList.remove("is-editing");
  const meta = categoryMeta[task.category] || categoryMeta.consolidation;
  const total = Number(task.checkin?.total || 0);
  const correct = Number(task.checkin?.correct || 0);
  const rate = total ? Math.round(correct / total * 100) : null;
  const hasLearningRecord = total > 0;
  $("#taskModalCategory").textContent = meta.label;
  $("#taskModalCategory").className = `modal-category legend-${meta.className === "vocab" ? "vocab" : meta.className}`;
  $("#taskModalTitle").textContent = taskDisplayTitle(task, tasks.indexOf(task));
  $("#taskModalMeta").textContent = `${days.find(day => day.key === task.day).name} · ${task.start}–${task.end} · ${minutesBetween(task.start, task.end)}分钟`;
  const focus = taskTrainingPoint(task, tasks.indexOf(task));
  $("#taskFocusBox").innerHTML = `<span>${focus.moduleName}</span><strong>${focus.point}</strong><p>${focus.note || "系统会按这组训练点生成练习并记录结果。"}</p>`;
  const hasSeenTaskFlow = localStorage.getItem("topikPrototypeTaskFlowSeen") === "yes";
  $("#taskFlowIntro").classList.toggle("hidden", hasSeenTaskFlow);
  if (!hasSeenTaskFlow) localStorage.setItem("topikPrototypeTaskFlowSeen", "yes");
  const isMockTask = task.category === "mock";
  $("#practiceModeNote").innerHTML = isMockTask
    ? `<span>模拟考试</span><strong>先完整答完本组，再统一查看答案、中文解析和错题。</strong>`
    : `<span>学习模式</span><strong>提交后显示中文解析，帮你把这一题学懂。</strong>`;
  $("#practiceModeNote").classList.add("hidden");
  $("#taskRecordTitle").textContent = hasLearningRecord ? "答题结果" : "开始前确认";
  $("#taskAutoRecord").innerHTML = total
    ? `<span>系统已记录</span><strong>${correct} / ${total} 题正确 · ${rate}%</strong><p>${task.checkin?.source || "系统练习自动统计"} · ${task.checkin?.updatedAt ? new Date(task.checkin.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "刚刚"}</p>`
    : `<span>系统自动记录</span><strong>选择题数后开始练习，系统会自动统计正确率、错题和用时。</strong>`;
  $("#reflectionField").classList.add("hidden");
  $("#taskNote").disabled = !hasLearningRecord;
  $("#taskNote").value = hasLearningRecord ? (task.checkin?.reflection || "") : "";
  $("#saveReflection").classList.add("hidden");
  $("#saveReflection").disabled = !hasLearningRecord;
  $("#saveReflection").textContent = "保存反思";
  $("#cancelTaskPlan").classList.toggle("hidden", hasLearningRecord);
  $("#cancelTaskPlan").disabled = hasLearningRecord;
  $("#cancelTaskPlan").textContent = task.status === "cancelled" ? "恢复这个计划" : "取消这个计划";
  $("#editTaskPlan").classList.toggle("hidden", hasLearningRecord);
  $("#editTaskPlan").disabled = hasLearningRecord;
  $("#taskEditPanel").classList.add("hidden");
  fillTaskEditForm(task);
  $("#openPractice").classList.toggle("hidden", task.status === "cancelled");
  $("#openPractice").disabled = task.status === "cancelled";
  $("#openPractice").textContent = isMockTask ? "开始模拟" : "开始学习";
  openModal("taskModal");
}

function fillTaskEditForm(task) {
  $("#editTaskDay").innerHTML = days.map(day => `<option value="${day.key}">${day.name}</option>`).join("");
  $("#editTaskCategory").innerHTML = Object.entries(categoryMeta)
    .filter(([key]) => key !== "speaking" || tasks.some(item => item.category === "speaking"))
    .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join("");
  $("#editTaskDay").value = task.day;
  $("#editTaskCategory").value = task.category;
  $("#editTaskStart").value = task.start;
  $("#editTaskEnd").value = task.end;
  $("#editTaskTitle").value = taskDisplayTitle(task, tasks.indexOf(task));
  $("#editTaskNote").value = task.note || "";
}

function toggleTaskEdit(forceOpen = null) {
  const panel = $("#taskEditPanel");
  const shouldOpen = forceOpen ?? panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !shouldOpen);
  $("#taskModal .task-panel")?.classList.toggle("is-editing", shouldOpen);
  $("#editTaskPlan").textContent = "编辑计划";
}

function saveTaskEdit() {
  const task = tasks.find(item => item.id === activeTaskId);
  if (!task) return;
  if (hasPracticeRecord(task)) return showToast("已完成的学习记录不能编辑");
  const day = $("#editTaskDay").value;
  const category = $("#editTaskCategory").value;
  const start = $("#editTaskStart").value;
  const end = $("#editTaskEnd").value;
  const title = $("#editTaskTitle").value.trim();
  const note = $("#editTaskNote").value.trim();
  if (!days.some(item => item.key === day)) return showToast("请选择有效的学习日期");
  if (!categoryMeta[category]) return showToast("请选择有效的任务类型");
  if (!start || !end || start >= end) return showToast("请填写有效的开始和结束时间");
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  const selectedDayName = days.find(item => item.key === day)?.name || "当前日期";
  if (overlapsProtectedBreak(startMinutes, endMinutes) && !window.confirm(`确认保存：${selectedDayName} ${start}–${end}`)) return;
  if (!title) return showToast("请填写任务标题");
  task.day = day;
  task.category = category;
  task.start = start;
  task.end = end;
  task.title = title.slice(0, 48);
  task.customTitle = true;
  task.note = note.slice(0, 120);
  task.standards = completionStandards[category] || completionStandards.consolidation;
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  renderCalendar();
  updateTomorrowFocus();
  scheduleCloudSave();
  toggleTaskEdit(false);
  openTask(task.id);
  showToast("计划已更新，后续出题会按新内容执行");
}

function cancelActiveTaskPlan() {
  const task = tasks.find(item => item.id === activeTaskId);
  if (!task) return;
  if (hasPracticeRecord(task)) return showToast("已完成的学习记录不能取消");
  if (task.status === "cancelled") {
    task.status = "planned";
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
    renderCalendar();
    closeModal("taskModal");
    scheduleCloudSave();
    showToast("已恢复这个计划");
    return;
  }
  if (!window.confirm("确定取消这个学习计划吗？")) return;
  task.status = "cancelled";
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  activeTaskId = null;
  renderCalendar();
  closeModal("taskModal");
  scheduleCloudSave();
  showToast("已取消这个计划");
}

function defaultTomorrowFocus() {
  const settings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {};
  if (settings.exam === "IELTS") return "先做一组 Listening 精听，再完成一组 Reading 同义替换题。";
  if (settings.exam === "OTHER") return "先完成一个核心知识模块，再用练习题检验理解。";
  return "明天按学习计划完成第一组系统练习，系统会根据答题结果整理错题。";
}

function nextStudyDayKey(fromKey = beijingDayKey()) {
  const selected = days.filter(day => tasks.some(task => task.day === day.key));
  if (!selected.length) return days[(days.findIndex(day => day.key === fromKey) + 1 + days.length) % days.length].key;
  const currentIndex = selected.findIndex(day => day.key === fromKey);
  return selected[(currentIndex + 1 + selected.length) % selected.length].key;
}

function taskFocusLabel(task) {
  return task ? `「${taskDisplayTitle(task, tasks.indexOf(task))}」` : "";
}

function tomorrowPlanFocus() {
  const tomorrowKey = nextStudyDayKey();
  const tomorrowTasks = tasks.filter(task => task.day === tomorrowKey);
  if (!tomorrowTasks.length) return defaultTomorrowFocus();
  const hasWrongRecords = errorItems.some(item => !item.mastered);
  const priority = hasWrongRecords ? (tomorrowTasks.find(task => task.category === "review") || tomorrowTasks[0]) : tomorrowTasks[0];
  const moreCount = Math.max(0, tomorrowTasks.length - 1);
  return moreCount
    ? `明天按计划先做${taskFocusLabel(priority)}，再完成另外 ${moreCount} 组学习任务。`
    : `明天按计划完成${taskFocusLabel(priority)}。`;
}

function todayWrongFocus() {
  const today = beijingDateKey();
  const todayTasks = tasks.filter(task => hasPracticeRecord(task) && beijingDateKey(task.checkin?.updatedAt ? new Date(task.checkin.updatedAt) : new Date()) === today);
  const wrongTask = todayTasks.find(task => Number(task.checkin.correct || 0) < Number(task.checkin.total || 0));
  if (!wrongTask) return "";
  const wrongCount = Number(wrongTask.checkin.total || 0) - Number(wrongTask.checkin.correct || 0);
  const note = String(wrongTask.checkin.note || wrongTask.checkin.reflection || "").replace(/^AI自动记录：/, "").slice(0, 36);
  return note
    ? `先复盘今天${taskFocusLabel(wrongTask)}的 ${wrongCount} 道错题：${note}。`
    : `先复盘今天${taskFocusLabel(wrongTask)}的 ${wrongCount} 道错题。`;
}

function buildTomorrowFocus() {
  const wrongFocus = todayWrongFocus();
  const planFocus = tomorrowPlanFocus();
  return wrongFocus ? `${wrongFocus}${planFocus}` : planFocus;
}

function updateTomorrowFocus(text = "") {
  const focus = text || buildTomorrowFocus();
  $("#tomorrowFocus").textContent = focus;
  localStorage.setItem("topikPrototypeTomorrowFocus", focus);
}

function readStudySettings() {
  return JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {
    exam: "TOPIK",
    level: "I",
    targetGrade: "2",
    weak: ["语法"],
    studyContent: ""
  };
}

function getExamPracticeLabel(settings) {
  if (settings.exam === "TOPIK") return `TOPIK ${settings.level || "I"} · 目标${settings.targetGrade || (settings.level === "II" ? "4" : "2")}级`;
  if (settings.exam === "IELTS") return `IELTS ${settings.level === "II" ? "General Training" : "Academic"}`;
  return settings.customExamName || settings.studyContent || examLabelMap[settings.exam] || "当前学习目标";
}

function fallbackPracticeQuestions(errorId) {
  if (errorId === "imported-1") return placeParticleQuestions;
  if (errorId === "e1") return particleQuestions.slice(0, 5);
  return particleQuestions.slice(5, 10);
}

function localFallbackForContext(errorId, context) {
  const materialPractice = materialPracticeForContext(context);
  if (materialPractice.length) return materialPractice;
  if (context?.category === "listening") return listeningFallbackQuestions;
  if (context?.category === "reading") return topikIReadingFallbackQuestions;
  return fallbackPracticeQuestions(errorId);
}

function materialPracticeForContext(context = {}, limit = 5) {
  const settings = context.settings || readStudySettings();
  const match = materialPracticeBank.find(item =>
    item.exam === settings.exam &&
    item.level === settings.level &&
    item.category === context.category
  );
  return match ? match.questions.slice(0, limit).map(question => ({ ...question, materialSetTitle: match.title, sourceTitle: match.sourceTitle })) : [];
}

function stopListeningAudio() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  listeningIsSpeaking = false;
}

function isListeningQuestion(question = {}) {
  const task = practiceTaskId ? tasks.find(item => item.id === practiceTaskId) : null;
  return Boolean(question.audioText || question.transcript || task?.category === "listening" || /listening|듣기/i.test(question.source || question.questionType || ""));
}

function listeningTextFor(question = {}) {
  return String(question.audioText || question.transcript || "").trim();
}

function playListeningQuestion() {
  const question = activePractice[questionIndex];
  const text = listeningTextFor(question);
  const key = `${questionIndex}`;
  const currentCount = listeningPlayCounts[key] || 0;
  const isReview = questionGraded;
  if (!text) return showToast("这题暂时没有可播放音频，已作为听力文本题处理");
  if (!("speechSynthesis" in window)) return showToast("当前浏览器不支持朗读，请提交后查看听力原文");
  if (!isReview && currentCount >= 2) return showToast("答题阶段最多播放2次，提交后可反复复听");
  stopListeningAudio();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.88;
  utterance.onend = () => {
    listeningIsSpeaking = false;
    renderQuestion();
  };
  utterance.onerror = () => {
    listeningIsSpeaking = false;
    showToast("朗读暂不可用，请提交后查看听力原文");
    renderQuestion();
  };
  if (!isReview) listeningPlayCounts[key] = currentCount + 1;
  listeningIsSpeaking = true;
  window.speechSynthesis.speak(utterance);
  renderQuestion();
}

function readPracticeQuestionCount() {
  const selected = Number($("#practiceQuestionCount")?.value || 5);
  return [5, 10, 15, 20].includes(selected) ? selected : 5;
}

function reviewModeForTask(linkedTaskId) {
  const task = tasks.find(item => item.id === linkedTaskId);
  return task?.category === "mock" ? "exam" : "learning";
}

function currentPracticeScore() {
  return practiceResults.reduce((sum, item) => sum + (item?.correct ? 1 : 0), 0);
}

function syncPracticeWrongNotes() {
  practiceWrongNotes = practiceResults
    .filter(item => item && !item.correct)
    .map(item => ({
      stem: item.question?.stem || "",
      explanation: item.explanation || item.question?.explanation || "",
      explanationZh: item.explanationZh || item.question?.explanationZh || "",
      answer: item.answer || item.question?.options?.[item.question?.answer] || "",
      answerZh: item.answerZh || item.question?.answerZh || item.question?.optionTranslations?.[item.question?.answer] || "",
      listeningMistake: isListeningQuestion(item.question) ? "需要复听原文，标记没听出的关键词" : ""
    }));
}

function renderPracticeResultBoard() {
  const total = activePractice.length;
  const correct = currentPracticeScore();
  const wrong = practiceResults.filter(item => item && !item.correct).length;
  const unanswered = Math.max(0, total - practiceResults.filter(Boolean).length);
  const wrongList = practiceResults
    .map((item, index) => item && !item.correct ? { ...item, index } : null)
    .filter(Boolean);
  const firstWrong = wrongList[0];
  const reviewAdvice = wrong
    ? "建议先把错题重做一遍。错题会进入错题集，之后按复习节奏提醒。"
    : "本组全部正确。可以继续下一组学习，之后按计划做延迟复习。";
  const firstWrongLine = firstWrong
    ? `<p><strong>先看第 ${firstWrong.index + 1} 题：</strong>${escapeImportText(firstWrong.answerZh || firstWrong.answer || "回看答案依据")}</p>`
    : "";
  const linkedTask = practiceTaskId ? tasks.find(item => item.id === practiceTaskId) : null;
  const reflectionValue = linkedTask?.checkin?.reflection || "";
  $("#questionArea").innerHTML = `<div class="practice-result-board">
    <p class="section-kicker">本组完成 · 系统自动记录</p>
    <h2>${correct} / ${total} 题正确</h2>
    <div class="result-legend">
      <span><i class="is-correct"></i>答对 ${correct}</span>
      <span><i class="is-wrong"></i>答错 ${wrong}</span>
      <span><i class="is-unanswered"></i>未答 ${unanswered}</span>
    </div>
    <div class="question-status-grid" aria-label="本组题目状态">
      ${activePractice.map((_, index) => {
        const result = practiceResults[index];
        const status = !result ? "unanswered" : (result.correct ? "correct" : "wrong");
        const label = !result ? "未答" : (result.correct ? "答对" : "答错");
        return `<button type="button" class="${status}" data-review-question="${index}" title="第 ${index + 1} 题：${label}">${index + 1}</button>`;
      }).join("")}
    </div>
    <div class="result-review-note">
      ${firstWrongLine}
      <p><strong>复盘建议：</strong>${escapeImportText(reviewAdvice)}</p>
    </div>
    ${linkedTask ? `<label class="result-reflection-field">
      <span>补一句反思 <small>可选</small></span>
      <textarea id="practiceReflectionNote" rows="2" placeholder="比如：哪里卡住了、下次想先复习什么">${escapeImportText(reflectionValue)}</textarea>
    </label>` : ""}
    <div class="result-actions">
      ${wrong
        ? `<button class="secondary-button" id="retryWrongQuestions" type="button">重做错题</button>`
        : `<button class="secondary-button" id="retryAllQuestions" type="button">再练一组</button>`
      }
    </div>
  </div>`;
  $("#practiceFeedback").className = "practice-feedback hidden";
  $("#prevQuestion").style.display = "none";
  $("#nextQuestion").textContent = "完成本组";
  $("#nextQuestion").onclick = completePracticeSession;
  $$("[data-review-question]").forEach(button => button.addEventListener("click", () => {
    questionIndex = Number(button.dataset.reviewQuestion);
    selectedAnswer = practiceResults[questionIndex]?.selected ?? null;
    questionGraded = true;
    renderQuestion();
    $("#nextQuestion").textContent = "返回结果";
    $("#nextQuestion").onclick = renderPracticeResultBoard;
  }));
  $("#retryWrongQuestions")?.addEventListener("click", () => restartPracticeWithQuestions(wrongList.map(item => item.question)));
  $("#retryAllQuestions")?.addEventListener("click", () => restartPracticeWithQuestions(activePractice));
}

function restartPracticeWithQuestions(questions) {
  const nextQuestions = questions.filter(Boolean);
  if (!nextQuestions.length) return;
  activePractice = nextQuestions;
  practiceWrongNotes = [];
  practiceResults = [];
  practiceCorrect = 0;
  questionIndex = 0;
  selectedAnswer = null;
  questionGraded = false;
  listeningPlayCounts = {};
  resetPracticeControls();
  renderQuestion();
}

function normalizePracticeQuestions(items, limit = 5) {
  return (items || []).map((item, index) => {
    const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : [];
    const answer = Number(item.answer);
    const audioText = String(item.audioText || item.audio || item.transcript || "").trim();
    return {
      stem: String(item.stem || item.question || "").trim(),
      stemZh: String(item.stemZh || item.questionZh || item.stemChinese || "").trim(),
      options,
      optionTranslations: Array.isArray(item.optionTranslations || item.optionsZh) ? (item.optionTranslations || item.optionsZh).map(String).slice(0, 4) : [],
      answer: Number.isInteger(answer) ? answer : 0,
      explanation: String(item.explanation || item.reason || "系统会根据答案依据继续调整后续练习。").trim(),
      explanationZh: String(item.explanationZh || item.explanationChinese || item.reasonZh || "").trim(),
      answerZh: String(item.answerZh || item.correctAnswerZh || "").trim(),
      source: item.source ? String(item.source).slice(0, 120) : "",
      sourceTitle: String(item.sourceTitle || "").trim(),
      materialSetTitle: String(item.materialSetTitle || "").trim(),
      materialImage: String(item.materialImage || item.image || "").trim(),
      audioText,
      transcript: String(item.transcript || audioText).trim(),
      transcriptZh: String(item.transcriptZh || item.transcriptChinese || item.audioTextZh || "").trim(),
      questionType: String(item.questionType || item.type || "").trim()
    };
  }).filter(item => item.stem && item.options.length >= 2 && item.answer >= 0 && item.answer < item.options.length).slice(0, limit);
}

function answerLetter(index) {
  return String.fromCharCode(65 + index);
}

function questionMeaningText(question = {}) {
  if (question.stemZh) return question.stemZh;
  if (question.transcriptZh) return `听力原文大意：${question.transcriptZh}`;
  if (question.stem) return question.stem;
  return "当前题目内容暂未返回中文说明。";
}

function practiceExplanationText(question = {}) {
  return question.explanationZh || question.explanation || "这道题要根据题干中的关键信息判断，正确选项和原文信息一致。";
}

function persistErrorItems() {
  localStorage.setItem("topikPrototypeImportedErrors", JSON.stringify(errorItems.filter(item => String(item.id).startsWith("imported-"))));
  localStorage.setItem("topikPrototypePracticeErrors", JSON.stringify(errorItems.filter(item => String(item.id).startsWith("practice-"))));
}

function createPracticeErrorItems(task, wrongResults = []) {
  if (!task || !wrongResults.length) return [];
  const taskIndex = tasks.indexOf(task);
  const title = taskDisplayTitle(task, taskIndex);
  const section = categoryMeta[task.category]?.label || "练习";
  const timestamp = Date.now();
  const created = wrongResults.map((result, index) => {
    const question = result.question || {};
    const correctOption = question.options?.[question.answer] || result.answer || "";
    const correctOptionZh = question.answerZh || question.optionTranslations?.[question.answer] || result.answerZh || "";
    const selectedOption = question.options?.[result.selected] || "";
    const selectedOptionZh = question.optionTranslations?.[result.selected] || "";
    const focus = question.questionType || question.sourceTitle || question.materialSetTitle || title;
    const correctLine = [correctOption, correctOptionZh].filter(Boolean).join(" / ");
    const selectedLine = selectedOption ? [selectedOption, selectedOptionZh].filter(Boolean).join(" / ") : "未作答";
    return {
      id: `practice-${task.id || "task"}-${timestamp}-${index}`,
      filter: ["due"],
      section,
      title: `${title} · 第 ${result.index + 1} 题`,
      source: "系统练习自动整理",
      due: true,
      focus: focus || "回看本题题干与正确答案依据。",
      cause: `你的选择：${selectedLine}`,
      reasoning: `正确答案：${answerLetter(question.answer)}. ${correctLine || "回看正确选项"}。${practiceExplanationText(question)}`,
      habit: isListeningQuestion(question) ? "听到关键词后过早选答案，没等完整信息。" : "只抓到局部信息，没有逐项核对选项。",
      action: isListeningQuestion(question) ? "复听原文，标出没听清的关键词。" : "先定位题干信息，再逐项排除不一致选项。",
      progress: "待复盘 0 / 1题",
      reviews: ["current", "", "", ""],
      taskId: task.id || "",
      question: question.stem || "",
      createdAt: new Date().toISOString()
    };
  });
  errorItems.unshift(...created);
  persistErrorItems();
  return created;
}

function renderPracticeFeedback(question = {}, correct = false) {
  const correctOption = question.options?.[question.answer] || "";
  const correctOptionZh = question.answerZh || question.optionTranslations?.[question.answer] || "";
  const selectedOption = question.options?.[selectedAnswer] || "";
  const selectedLabel = selectedAnswer === null ? "" : `${answerLetter(selectedAnswer)}. ${selectedOption}`;
  return `<div class="feedback-answer-line">
    <span>${correct ? "回答正确" : "正确答案"}</span>
    <strong>${answerLetter(question.answer)}. ${escapeImportText(correctOption)}</strong>
    ${correctOptionZh ? `<p>${escapeImportText(correctOptionZh)}</p>` : ""}
  </div>
  ${!correct && selectedLabel ? `<div class="feedback-mini-line"><span>你的选择</span><p>${escapeImportText(selectedLabel)}</p></div>` : ""}
  <div class="feedback-mini-line"><span>题目要求</span><p>${escapeImportText(questionMeaningText(question))}</p></div>
  <div class="feedback-mini-line"><span>为什么选它</span><p>${escapeImportText(practiceExplanationText(question))}</p></div>`;
}

function getPracticeContext(errorId, linkedTaskId) {
  const settings = readStudySettings();
  const task = linkedTaskId ? tasks.find(item => item.id === linkedTaskId) : null;
  const examLabel = getExamPracticeLabel(settings);
  const category = task?.category || (errorId === "imported-1" ? "review" : "vocab");
  const title = task ? taskDisplayTitle(task, tasks.indexOf(task)) : (errorId === "imported-1" ? "导入错题诊断" : "错题变式复习");
  return { settings, task, examLabel, category, title };
}

async function loadExamDrivenPractice(errorId, linkedTaskId, questionCount = 5) {
  const context = getPracticeContext(errorId, linkedTaskId);
  const materialPractice = materialPracticeForContext(context, questionCount);
  if (materialPractice.length) return materialPractice;
  if (location.protocol === "file:") return [];
  const requestPayload = {
    ...context.settings,
    practiceRequest: {
      exam: context.settings.exam,
      level: context.settings.level,
      targetGrade: context.settings.targetGrade,
      category: context.category,
      taskTitle: context.title,
      taskNote: context.task?.note || "",
      standards: context.task?.standards || [],
      weak: context.settings.weak || [],
      studyContent: context.settings.studyContent || "",
      requestedQuestionCount: questionCount,
      sourcePolicy: "优先参考官方公开样题、公开真题题型和用户资料来校准考试模块与难度；按当前训练点生成原创同型练习，不把训练标签写成官方分类，也不直接复刻受版权限制的整套真题。"
    }
  };
  const timeoutMs = 60000;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await callStudyAssistant("practice", requestPayload, { timeoutMs });
      const questions = normalizePracticeQuestions(result?.questions || result?.practice?.questions, questionCount);
      if (questions.length) return questions;
      lastError = new Error("No generated questions returned");
    } catch (error) {
      lastError = error;
    }
    if (attempt === 1 && linkedTaskId) showToast("在线出题还没完成，系统正在自动重试一次");
  }
  throw lastError || new Error("Practice generation failed");
}

function beijingDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function beijingDayKey(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(date).toLowerCase();
  return { mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun" }[key] || "mon";
}

function minutesNowInBeijing(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).map(part => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60;
}

function dailyReviewSummary() {
  const today = beijingDateKey();
  const todayTasks = tasks.filter(task => task.checkin?.updatedAt && beijingDateKey(new Date(task.checkin.updatedAt)) === today);
  const checkedTasks = todayTasks.filter(task => task.status === "completed" || task.checkin?.note || task.checkin?.total);
  if (!checkedTasks.length) {
    return {
      hasCheckin: false,
      focus: buildTomorrowFocus(),
      message: "今天还没有完成系统练习，明日重点先按 T+1 学习计划生成。"
    };
  }
  const focus = buildTomorrowFocus();
  return {
    hasCheckin: true,
    focus,
    message: `已根据今天的打卡整理明日重点：${focus}`
  };
}

function renderReminderUI() {
  if (!$("#dailyReminderEnabled")) return;
  const settings = readReminderSettings();
  const summary = dailyReviewSummary();
  $("#dailyReminderEnabled").checked = settings.enabled;
  $("#dailyReminderTime").value = settings.time;
  $("#dailyReminderTitle").textContent = settings.enabled ? `每日 ${settings.time} 复盘` : "每日复盘提醒";
  $("#dailyReminderText").textContent = settings.enabled
    ? (summary.hasCheckin ? `今晚 ${settings.time} 会根据今天的打卡生成明日重点。` : summary.message)
    : "开启后，晚上根据当天打卡整理明日重点。";
  if ("Notification" in window) {
    $("#dailyReminderNotify").textContent = Notification.permission === "granted" ? "通知已开启" : "浏览器通知";
    $("#dailyReminderNotify").disabled = Notification.permission === "denied";
  } else {
    $("#dailyReminderNotify").textContent = "不支持通知";
    $("#dailyReminderNotify").disabled = true;
  }
}

function sendDailyNotification(message) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("今晚复盘：明天先抓一个重点", { body: message });
}

async function runDailyReminder(manual = false) {
  const settings = readReminderSettings();
  if (!settings.enabled && !manual) return;
  const today = beijingDateKey();
  if (!manual && settings.lastNotifiedDate === today) return;
  const summary = dailyReviewSummary();
  updateTomorrowFocus(summary.focus);
  writeReminderSettings({ lastNotifiedDate: today });
  showToast(summary.message);
  sendDailyNotification(summary.message);
  await saveCloudState(false);
}

function scheduleDailyReminder() {
  clearTimeout(dailyReminder.timer);
  const settings = readReminderSettings();
  if (!settings.enabled) return;
  const [hour, minute] = settings.time.split(":").map(Number);
  const target = hour * 60 + minute;
  const now = minutesNowInBeijing();
  const delayMinutes = target > now ? target - now : target + 1440 - now;
  dailyReminder.timer = setTimeout(() => runDailyReminder(false).finally(scheduleDailyReminder), Math.max(1000, delayMinutes * 60 * 1000));
}

const rewardCatalog = {
  "first-checkin": { badge: "DAY 1", visual: "companion-day1", companionDay: 1, title: "第一盏应援灯亮了", text: "给今天也在坚持学习的你亮一下", note: "今天的灯亮起来了。第一条记录已经留下，先陪你开始。" },
  "checkin-7": { badge: "7", visual: "support-card", title: "一周安可", text: "你已经留下 7 天记录了。这周不一定每天都顺，但你还是把学习接住了。", note: "收下一张「本周没有断掉」应援小卡。" },
  "checkin-14": { badge: "14", visual: "lyric-card", title: "慢慢有节奏", text: "这两周不是突然变厉害，是一点点把节奏找回来了。", note: "这一段节奏，先替你收好。" },
  "checkin-30": { badge: "30", visual: "ticket", title: "一个月巡演站", text: "你已经陪自己走过一个月。回头看，这些记录都是你一点点做过来的痕迹。", note: "收下一张「一个月站」纪念票根。" },
  "first-error-solved": { badge: "OK", title: "高音通过", text: "这道错题不是被跳过了，是被你慢慢拿下了。", note: "这题被你拿下了。" },
  "perfect-practice": { badge: "100", title: "今日主打曲", text: "这一组很漂亮。可以记下这次顺手、清醒、准确的感觉。", note: "今晚这首主打曲，轮到你亮一下。" }
};

function readRewardState() {
  const saved = JSON.parse(localStorage.getItem("topikPrototypeRewards") || "null") || {};
  return {
    unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [],
    checkinDates: Array.isArray(saved.checkinDates) ? saved.checkinDates : [],
    solvedErrors: Number(saved.solvedErrors || 0)
  };
}

function writeRewardState(state) {
  localStorage.setItem("topikPrototypeRewards", JSON.stringify(state));
  scheduleCloudSave();
}

function rewardVisualMarkup(reward) {
  if (reward.visual === "taegg-lamp") {
    return `<button class="taegg-video-card is-replaying" type="button" aria-label="重播亮灯动画">
      <video class="taegg-reward-video" poster="assets/first-day-cheer-light-ai.png" playsinline preload="auto">
        <source src="assets/seedance-taegg-light-landscape.mp4" type="video/mp4" media="(min-aspect-ratio: 4/3)" />
        <source src="assets/seedance-taegg-light-portrait.mp4" type="video/mp4" />
      </video>
      <img class="taegg-video-fallback" src="assets/first-day-cheer-light-ai.png" alt="" />
      <span class="reward-sound-hint">点一下开声音</span>
      <span class="taegg-video-scene"></span>
      <span class="taegg-video-dim"></span>
      <span class="taegg-video-sheen"></span>
      <span class="taegg-video-flare"></span>
      <span class="taegg-video-progress"></span>
      <span class="taegg-video-play" aria-hidden="true"></span>
      <span class="taegg-light-wash"></span>
    </button>`;
  }
  if (reward.visual === "support-card") {
    return `<div class="reward-support-card" aria-hidden="true">
      <span class="support-card-glow"></span>
      <span class="support-card-mark">${reward.badge}</span>
      <span class="support-card-butterfly"></span>
      <span class="support-card-title">ENCORE</span>
      <span class="support-card-line"></span>
    </div>`;
  }
  if (reward.visual === "lyric-card") {
    return `<button class="reward-lyric-card" type="button" aria-label="切换歌词卡片" data-page="0">
      <span class="lyric-card-shine"></span>
      <span class="lyric-lines">
        <strong>两周的记录</strong>
        <strong>慢慢有了</strong>
        <strong>自己的节奏</strong>
      </span>
      <span class="lyric-card-footer"><em>TRACK ${reward.badge}</em><b>slowly stable</b></span>
      <span class="lyric-card-dots"><i class="active"></i><i></i><i></i></span>
    </button>`;
  }
  if (reward.visual === "ticket") {
    return `<div class="reward-ticket" aria-hidden="true">
      <span class="ticket-stub">${reward.badge}</span>
      <span class="ticket-main"><strong>TOUR STOP</strong><em>one month</em></span>
      <span class="ticket-butterfly"></span>
    </div>`;
  }
  return `<div class="reward-badge-card" aria-hidden="true">
    <span class="reward-butterfly one"></span>
    <span class="reward-butterfly two"></span>
    <div class="reward-badge" id="rewardBadge">${reward.badge}</div>
  </div>`;
}

function showReward(reward) {
  const rewardPanel = $("#rewardModal .reward-panel");
  rewardPanel.classList.remove("companion-reward-panel");
  rewardPanel.classList.toggle("first-reward-panel", reward.visual === "taegg-lamp");
  rewardPanel.classList.remove("reward-video-ended");
  rewardPanel.classList.remove("reward-copy-visible");
  if (reward.companionDay) {
    rewardPanel.classList.add("companion-reward-panel");
    rewardPanel.classList.remove("first-reward-panel");
    $("#rewardVisual").innerHTML = `<iframe class="reward-companion-frame" title="${escapeImportText(reward.title)}" src="https://reward-companion-system.vercel.app/?rewardDay=${Number(reward.companionDay)}"></iframe>`;
    openModal("rewardModal");
    return;
  }
  $("#rewardVisual").innerHTML = rewardVisualMarkup(reward);
  const lyricCard = $(".reward-lyric-card");
  if (lyricCard) {
    const lyricPages = [
      ["两周的记录", "慢慢有了", "自己的节奏"],
      ["不是很用力", "也没有放弃", "只是一直在"],
      ["这一页", "先为你", "轻轻亮着"]
    ];
    lyricCard.addEventListener("click", () => {
      const next = (Number(lyricCard.dataset.page || 0) + 1) % lyricPages.length;
      lyricCard.dataset.page = String(next);
      lyricCard.querySelector(".lyric-lines").innerHTML = lyricPages[next].map(line => `<strong>${line}</strong>`).join("");
      lyricCard.querySelectorAll(".lyric-card-dots i").forEach((dot, index) => dot.classList.toggle("active", index === next));
    });
  }
  const taeggVideo = $(".taegg-video-card");
  if (taeggVideo) {
    const rewardVideo = taeggVideo.querySelector(".taegg-reward-video");
    const soundHint = taeggVideo.querySelector(".reward-sound-hint");
    const updateTaeggTiming = () => {
      if (!rewardVideo || !Number.isFinite(rewardVideo.duration)) return;
      rewardPanel.classList.toggle("reward-copy-visible", rewardVideo.duration - rewardVideo.currentTime <= 1);
    };
    const playTaegg = () => {
      if (!rewardVideo) return;
      rewardVideo.play().catch(() => {
        rewardVideo.muted = true;
        soundHint?.classList.add("visible");
        rewardVideo.play().catch(() => {});
      });
    };
    const replayTaegg = () => {
      rewardPanel.classList.remove("reward-video-ended");
      rewardPanel.classList.remove("reward-copy-visible");
      taeggVideo.classList.remove("is-replaying");
      taeggVideo.classList.remove("is-ended");
      void taeggVideo.offsetWidth;
      taeggVideo.classList.add("is-replaying");
      if (rewardVideo) {
        rewardVideo.muted = false;
        rewardVideo.currentTime = 0;
        soundHint?.classList.remove("visible");
        playTaegg();
      }
    };
    taeggVideo.addEventListener("click", () => {
      if (rewardVideo?.muted) {
        rewardVideo.muted = false;
        if (rewardVideo.ended) {
          rewardPanel.classList.remove("reward-video-ended");
          rewardPanel.classList.remove("reward-copy-visible");
          rewardVideo.currentTime = 0;
        }
        soundHint?.classList.remove("visible");
        rewardVideo.play().catch(() => {
          rewardVideo.muted = true;
          soundHint?.classList.add("visible");
          rewardVideo.play().catch(() => {});
        });
        return;
      }
      replayTaegg();
    });
    if (rewardVideo) {
      rewardVideo.addEventListener("loadeddata", () => {
        updateTaeggTiming();
        rewardVideo.muted = false;
        playTaegg();
      }, { once: true });
      rewardVideo.addEventListener("timeupdate", updateTaeggTiming);
      rewardVideo.addEventListener("ended", () => {
        rewardPanel.classList.add("reward-copy-visible");
        taeggVideo.classList.add("is-ended");
        rewardPanel.classList.add("reward-video-ended");
      });
    }
  }
  $("#rewardTitle").textContent = reward.title;
  $("#rewardText").textContent = reward.text;
  $("#rewardNote").textContent = reward.note;
  openModal("rewardModal");
}

function unlockRewards(ids) {
  const state = readRewardState();
  const fresh = ids.filter(id => rewardCatalog[id] && !state.unlocked.includes(id));
  if (!fresh.length) return;
  state.unlocked.push(...fresh);
  writeRewardState(state);
  fresh.forEach((id, index) => setTimeout(() => showReward(rewardCatalog[id]), index * 500));
}

function recordCheckinReward(task) {
  const state = readRewardState();
  const dateKey = beijingDateKey(task.checkin?.updatedAt ? new Date(task.checkin.updatedAt) : new Date());
  if (!state.checkinDates.includes(dateKey)) state.checkinDates.push(dateKey);
  writeRewardState(state);
  const count = state.checkinDates.length;
  unlockRewards([
    "first-checkin",
    ...(count >= 7 ? ["checkin-7"] : []),
    ...(count >= 14 ? ["checkin-14"] : []),
    ...(count >= 30 ? ["checkin-30"] : [])
  ]);
}

function recordSolvedErrorReward(rate) {
  const state = readRewardState();
  state.solvedErrors += 1;
  writeRewardState(state);
  unlockRewards(["first-error-solved", ...(rate === 100 ? ["perfect-practice"] : [])]);
}

async function saveReflection() {
  const task = tasks.find(item => item.id === activeTaskId);
  if (!task?.checkin?.total) {
    showToast("先完成系统练习，再写反思");
    return;
  }
  const note = $("#taskNote").value.trim();
  task.checkin = {
    ...(task.checkin || {}),
    reflection: note,
    note: task.checkin?.note || "",
    source: task.checkin?.source || "用户反思",
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  renderCalendar();
  closeModal("taskModal");
  if (note) {
    updateTomorrowFocus();
    showToast("反思已保存，明日重点会参考这条记录");
  } else {
    showToast("没有补充内容，学习完成会由系统练习自动记录");
  }
  renderReminderUI();
  await saveCloudState(false);
}

async function startPractice(errorId = "e1", linkedTaskId = null, isSample = false) {
  resetPracticeControls();
  practiceReviewMode = linkedTaskId ? reviewModeForTask(linkedTaskId) : "learning";
  practiceTaskId = linkedTaskId;
  practiceErrorId = linkedTaskId ? null : errorId;
  practiceIsSample = isSample;
  practiceWrongNotes = [];
  practiceResults = [];
  listeningPlayCounts = {};
  stopListeningAudio();
  const context = getPracticeContext(errorId, linkedTaskId);
  const questionCount = linkedTaskId ? readPracticeQuestionCount() : 5;
  activePractice = localFallbackForContext(errorId, context);
  questionIndex = 0;
  selectedAnswer = null;
  questionGraded = false;
  practiceCorrect = 0;
  $("#practiceEyebrow").textContent = errorId === "imported-1" ? "导入错题诊断 · 5题" : `${context.examLabel} · 系统出题`;
  $("#practiceTitle").textContent = "正在生成练习题";
  $("#questionProgress").textContent = "请稍候";
  $("#questionArea").innerHTML = `<div class="practice-loading-state" role="status" aria-live="polite">
    <span class="loading-spinner" aria-hidden="true"></span>
    <div>
      <p class="section-kicker">系统出题中</p>
      <h3>正在按你的考试目标生成 ${questionCount} 道题</h3>
      <p>会参考考试模块、目标等级、本组训练点和已确认资料来出题。系统最多等待 1 分钟；如果失败会自动再试一次。</p>
    </div>
  </div>`;
  if (!questionGraded) $("#practiceFeedback").className = "practice-feedback hidden";
  $("#prevQuestion").disabled = true;
  $("#nextQuestion").disabled = true;
  $("#nextQuestion").textContent = "正在生成";
  openModal("practiceModal");
  try {
    const generated = await loadExamDrivenPractice(errorId, linkedTaskId, questionCount);
    if (generated.length) activePractice = generated;
    else if (linkedTaskId) showToast("暂未生成新题，已使用本地兜底练习");
  } catch {
    if (linkedTaskId) showToast("在线出题两次失败，已进入本地兜底练习");
  }
  questionIndex = 0;
  selectedAnswer = null;
  questionGraded = false;
  practiceCorrect = 0;
  practiceWrongNotes = [];
  practiceResults = [];
  $("#practiceTitle").textContent = context.title;
  $("#nextQuestion").disabled = false;
  renderQuestion();
}

function renderQuestion() {
  const question = activePractice[questionIndex];
  const learningMode = practiceReviewMode === "learning";
  const listening = isListeningQuestion(question);
  const transcript = listeningTextFor(question);
  const transcriptZh = String(question.transcriptZh || "").trim();
  const playCount = listeningPlayCounts[`${questionIndex}`] || 0;
  const remainingPlays = Math.max(0, 2 - playCount);
  const materialLabel = question.materialSetTitle || question.sourceTitle || "";
  $("#questionProgress").textContent = `${questionIndex + 1} / ${activePractice.length}`;
  $("#questionArea").innerHTML = `${listening ? `<div class="listening-player">
    <div><span>听力播放</span><strong>${questionGraded ? (learningMode ? "复盘阶段可反复听" : "本题已记录，整组完成后复盘") : `答题阶段剩余 ${remainingPlays} 次`}</strong></div>
    <button class="secondary-button compact" id="playListening" type="button" ${listeningIsSpeaking || (!learningMode && questionGraded) || (!questionGraded && remainingPlays <= 0) || !transcript ? "disabled" : ""}>${listeningIsSpeaking ? "播放中…" : "播放音频"}</button>
  </div>` : ""}
  ${materialLabel ? `<div class="material-source-pill">资料题 · ${escapeImportText(materialLabel)}</div>` : ""}
  ${question.materialImage ? `<button class="question-material-image" type="button" id="openMaterialImage" aria-label="查看原始资料图"><img src="${escapeImportText(question.materialImage)}" alt="原始资料页" loading="lazy" /></button>` : ""}
  <p class="question-stem">${escapeImportText(question.stem)}</p><div class="answer-options">
    ${question.options.map((option, index) => `<label class="answer-option ${selectedAnswer === index ? "selected" : ""}">
      <input type="radio" name="answer" value="${index}" />
      <span class="answer-letter">${answerLetter(index)}</span><span>${escapeImportText(option)}</span>
    </label>`).join("")}
  </div>${listening && learningMode && questionGraded && transcript ? `<div class="transcript-box"><span>听力原文</span><p>${escapeImportText(transcript)}</p>${transcriptZh ? `<span>中文翻译</span><p>${escapeImportText(transcriptZh)}</p>` : ""}</div>` : ""}`;
  if (!questionGraded) $("#practiceFeedback").className = "practice-feedback hidden";
  $("#nextQuestion").textContent = "提交答案";
  $("#prevQuestion").disabled = questionIndex === 0;
  $("#playListening")?.addEventListener("click", playListeningQuestion);
  $$(".answer-option").forEach((option, index) => option.addEventListener("click", () => {
    if (questionGraded) return;
    selectedAnswer = index;
    $$(".answer-option").forEach(item => item.classList.remove("selected"));
    option.classList.add("selected");
  }));
}

function advanceQuestion() {
  if (!questionGraded) {
    if (selectedAnswer === null) return showToast("请先选择一个答案");
    const question = activePractice[questionIndex];
    const correct = selectedAnswer === question.answer;
    practiceResults[questionIndex] = {
      question,
      selected: selectedAnswer,
      correct,
      answer: question.options[question.answer] || "",
      answerZh: question.answerZh || question.optionTranslations?.[question.answer] || "",
      explanation: question.explanation || "",
      explanationZh: question.explanationZh || ""
    };
    practiceCorrect = currentPracticeScore();
    syncPracticeWrongNotes();
    questionGraded = true;
    renderQuestion();
    if (practiceReviewMode === "exam") {
      const feedback = $("#practiceFeedback");
      feedback.className = "practice-feedback recorded";
      feedback.innerHTML = "<strong>本题已记录</strong><br><span>考试模式下不立刻显示答案和中文解析，整组完成后统一复盘。</span>";
      $("#nextQuestion").textContent = questionIndex === activePractice.length - 1 ? "查看本组结果" : "下一题";
      return;
    }
    const feedback = $("#practiceFeedback");
    feedback.className = `practice-feedback ${correct ? "correct" : "wrong"}`;
    feedback.innerHTML = renderPracticeFeedback(question, correct);
    $("#nextQuestion").textContent = questionIndex === activePractice.length - 1 ? "查看本组结果" : "下一题";
    return;
  }
  if (questionIndex < activePractice.length - 1) {
    questionIndex += 1;
    selectedAnswer = null;
    questionGraded = false;
    renderQuestion();
  } else {
    renderPracticeResultBoard();
  }
}

function completePracticeSession() {
  const total = activePractice.length;
  const wrongCount = total - practiceCorrect;
  const rate = total ? Math.round(practiceCorrect / total * 100) : 0;
  const resultReflection = $("#practiceReflectionNote")?.value.trim() || "";
  if (practiceTaskId) {
    const task = tasks.find(item => item.id === practiceTaskId);
    if (task) {
      const autoNote = wrongCount
        ? `AI自动记录：错${wrongCount}题；${practiceWrongNotes.slice(0, 2).map(item => item.listeningMistake || item.explanationZh || item.explanation).join("；")}`
        : "AI自动记录：本组全部正确，建议按计划进行延迟复习。";
      task.status = "completed";
      const wrongResults = practiceResults
        .map((item, index) => item && !item.correct ? { ...item, index } : null)
        .filter(Boolean);
      const createdErrors = practiceIsSample ? [] : createPracticeErrorItems(task, wrongResults);
      task.checkin = {
        correct: practiceCorrect,
        total,
        note: autoNote,
        reflection: resultReflection || task.checkin?.reflection || "",
        source: "系统练习自动统计",
        updatedAt: new Date().toISOString(),
        errorIds: createdErrors.map(item => item.id)
      };
      localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
      renderCalendar();
      updateTomorrowFocus();
      recordCheckinReward(task);
      renderErrors();
      scheduleCloudSave();
    }
  }
  const error = practiceIsSample ? null : errorItems.find(item => item.id === practiceErrorId);
  if (error) {
    error.progress = `本次练习 ${practiceCorrect} / ${total}题 · ${rate}%`;
    persistErrorItems();
    if (rate >= 80) recordSolvedErrorReward(rate);
    renderErrors();
    scheduleCloudSave();
  }
  closeModal("practiceModal");
  showToast(practiceIsSample ? "示例练习已完成，不会写入你的错题集" : (practiceTaskId ? (resultReflection ? "学习结果和反思已保存" : "学习行为已自动记录") : "练习结果已更新到错题集"));
  practiceTaskId = null;
  practiceErrorId = null;
  practiceIsSample = false;
  resetPracticeControls();
}

function resetPracticeControls() {
  $("#prevQuestion").style.display = "";
  $("#nextQuestion").onclick = advanceQuestion;
}

function openModal(id) { $("#" + id).classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(id) {
  if (id === "practiceModal") stopListeningAudio();
  if (id === "rewardModal") $("#rewardVisual").innerHTML = "";
  $("#" + id).classList.add("hidden");
  document.body.style.overflow = "";
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3800);
}

let pendingSettings = null;

async function callStudyAssistant(action, settings, options = {}) {
  if (location.protocol === "file:") return null;
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeoutId = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
  try {
    const response = await fetch("/api/study-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, settings }),
      signal: controller?.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `AI service unavailable: ${response.status}`);
    return payload;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeAiTasks(aiTasks, settings) {
  const allowedDays = new Set(settings.studyDays?.length ? settings.studyDays : days.map(day => day.key));
  const availableStart = settings.availableStart || "00:00";
  const availableEnd = settings.availableEnd || "23:59";
  const defaultTokens = defaultStudyTokens(settings);
  const selectedTokens = selectedStudyTokens(settings, defaultTokens).map(normalizeStudyCategory);
  const allowed = [...new Set([
    ...selectedTokens,
    "consolidation",
    "review",
    ...(settings.intensity === "高强度" ? ["mock"] : [])
  ])];
  const allowedCategories = new Set(allowed);
  return (aiTasks || []).filter(task => {
    const category = normalizeStudyCategory(task.category);
    const validClock = /^\d{2}:\d{2}$/.test(task.start || "") && /^\d{2}:\d{2}$/.test(task.end || "");
    if (!validClock) return false;
    const startMinutes = clockToMinutes(task.start);
    const endMinutes = clockToMinutes(task.end);
    return allowedDays.has(task.day)
      && allowedCategories.has(category)
      && task.start >= availableStart
      && task.end <= availableEnd
      && task.start < task.end
      && !overlapsProtectedBreak(startMinutes, endMinutes);
  }).map((task, index) => {
    const category = normalizeStudyCategory(task.category);
    const normalized = {
      id: 3000 + index,
      day: task.day,
      start: task.start,
      end: task.end,
      category,
      displayIndex: index,
      title: String(task.title || "学习任务").slice(0, 40),
      note: String(task.note || "").slice(0, 100),
      status: "planned",
      standards: Array.isArray(task.standards) ? task.standards.slice(0, 5).map(String) : (completionStandards[task.category] || completionStandards.consolidation)
    };
    normalized.title = taskDisplayTitle(normalized, index);
    return normalized;
  });
}

async function commitPlanSettings(settings) {
  const button = $("#confirmPlanSources");
  button.disabled = true;
  button.textContent = "正在生成…";
  const persistentSettings = { ...settings, localFileCount: settings.materialFiles?.length || 0, materialFiles: [] };
  localStorage.setItem("topikPrototypeSettings", JSON.stringify(persistentSettings));
  applyExamBrand(settings.exam, settings.level, settings.targetGrade);
  let aiGenerated = false;
  try {
    const result = await callStudyAssistant("plan", {
      ...settings,
      materialFiles: settings.materialFiles?.map(({ name, type, sizeLabel }) => ({ name, type, sizeLabel }))
    });
    const generatedTasks = normalizeAiTasks(result?.tasks, settings);
    if (generatedTasks.length) {
      tasks = generatedTasks;
      aiGenerated = true;
    } else {
      tasks = generatePlanFromSettings(settings);
    }
  } catch {
    tasks = generatePlanFromSettings(settings);
  }
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  localStorage.setItem("topikPrototypePlanVersion", planSchemaVersion);
  renderCalendar();
  updateTomorrowFocus();
  $("#profileIntensity").textContent = settings.intensityLabel;
  updateExamOptions(settings.exam, settings.level);
  localStorage.setItem("topikPrototypeOnboarded", "yes");
  scheduleCloudSave();
  closeModal("resourceConfirmModal");
  closeModal("settingsModal");
  button.disabled = false;
  button.textContent = "确认并生成计划";
  showToast(aiGenerated ? "AI已根据确认资料生成周计划" : "已使用本地生成器创建周计划");
}

function suggestedSourcesFor(settings) {
  const userSources = settings.resourceLinks.map((url, index) => ({ title: `用户资料 ${index + 1}`, detail: url, type: "用户提供" }));
  const localSources = (settings.materialFiles || []).map(file => ({ title: file.name, detail: file.sizeLabel, type: "本地文件" }));
  if (!settings.autoResearch) return [...userSources, ...localSources];
  const searched = settings.exam === "TOPIK" ? [
    { title: "TOPIK 官方网站", detail: "https://www.topik.go.kr/", type: "官方入口" },
    { title: "国立国际教育院 NIIED · TOPIK 主管机构", detail: "https://www.niied.go.kr/", type: "官方机构" },
    { title: "公开样题 / 用户自有材料", detail: "用于校准题型、难度和错题复盘", type: "校准材料" },
    { title: "TOPIK II 训练点生成规则", detail: "按考试模块和能力训练点生成原创练习；训练点不是官方分类", type: "训练点参考" }
  ] : settings.exam === "IELTS" ? [
    { title: "IELTS 官方考试类型与结构", detail: "https://ielts.org/take-a-test/test-types", type: "官方入口" },
    { title: "IELTS 官方样题与备考资源", detail: "https://ielts.org/take-a-test/preparation-resources", type: "公开样题" },
    { title: "用户自有材料 / 错题记录", detail: "用于定位弱项并生成原创同型练习", type: "校准材料" }
  ] : [
    { title: `${settings.customExamName}官方考试说明`, detail: "将搜索考试主管机构或课程官方文档", type: "待搜索核验" },
    { title: "考试大纲、题型与评分标准", detail: "仅采用能确认发布机构和更新时间的来源", type: "待搜索核验" }
  ];
  return [...userSources, ...localSources, ...searched];
}

function renderSourceChoices(sources) {
  $("#confirmResourceSources").innerHTML = sources.map((source, index) => `<label class="source-choice">
    <input type="checkbox" data-confirm-source="${index}" checked />
    <span><strong>${escapeImportText(source.title)} · ${escapeImportText(source.type)}</strong><small>${escapeImportText(source.detail || source.url || "")}</small></span>
  </label>`).join("") || '<div class="source-line">未选择资料来源，将只按考试目标和补充学习范围生成。</div>';
}

function updatePlanConfirmationState() {
  const button = $("#confirmPlanSources");
  const researchLoading = $("#researchNote").classList.contains("loading");
  const confirmed = $("#confirmUncertaintyCheck").checked;
  button.disabled = researchLoading || !confirmed;
  button.textContent = researchLoading ? "等待资料核验…" : (confirmed ? "确认并生成计划" : "请先勾选确认");
}

async function showResourceConfirmation(settings) {
  pendingSettings = settings;
  const examName = settings.exam === "OTHER" ? settings.customExamName : (settings.exam === "IELTS" ? "雅思 IELTS" : "TOPIK");
  const goal = settings.exam === "OTHER"
    ? (settings.customExamGoal || "暂未填写")
    : (settings.exam === "IELTS" ? (settings.level === "II" ? "培训类" : "学术类") : `TOPIK ${settings.level} · 目标${settings.targetGrade || (settings.level === "II" ? "4" : "2")}级`);
  $("#confirmExamName").textContent = examName;
  $("#confirmExamGoal").textContent = goal;
  const scopeParts = [
    settings.weak.length ? `薄弱项：${settings.weak.join("、")}` : "",
    settings.studyContent ? `补充范围：${settings.studyContent}` : ""
  ].filter(Boolean);
  $("#confirmStudyScope").textContent = scopeParts.join("；") || "将根据考试目标整理核心科目";
  const dayNames = { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五", sat: "周六", sun: "周日" };
  $("#confirmStudySchedule").textContent = `${(settings.studyDays || []).map(day => dayNames[day]).join("、") || "每天"} · ${settings.availableStart}–${settings.availableEnd} · 第一轮 ${settings.firstRoundWeeks} 周${settings.examDate ? ` · 考试日 ${settings.examDate}` : ""}`;
  const sources = suggestedSourcesFor(settings);
  renderSourceChoices(sources);
  $("#researchNote").classList.toggle("hidden", !settings.autoResearch);
  const confirmButton = $("#confirmPlanSources");
  $("#confirmUncertaintyCheck").checked = false;
  const setResearchState = (state, text) => {
    $("#researchNote").classList.remove("loading", "success", "error");
    $("#researchNote").classList.add(state);
    $("#researchStatusChip").textContent = state === "loading" ? "搜索中" : (state === "success" ? "核验完成" : "暂未完成");
    $("#researchNoteText").textContent = text;
    updatePlanConfirmationState();
  };
  if (settings.autoResearch) setResearchState("loading", "正在连接AI，核对考试说明、公开样题和用户资料…");
  else {
    $("#researchNote").classList.remove("loading", "success", "error");
    $("#researchNoteText").textContent = "";
    updatePlanConfirmationState();
  }
  $("#confirmUncertainty").textContent = "请核对前面填写或选择的关键信息：考试类型、目标、时间安排、题型参考来源等是否正确。";
  pendingSettings.suggestedSources = sources;
  closeModal("settingsModal");
  openModal("resourceConfirmModal");
  if (settings.autoResearch && location.protocol !== "file:") {
    try {
      const result = await callStudyAssistant("research", { ...settings, materialFiles: settings.materialFiles?.map(({ name, type, sizeLabel }) => ({ name, type, sizeLabel })) });
      if (result?.scope?.length) $("#confirmStudyScope").textContent = result.scope.join("、");
      if (result?.uncertainties?.length) $("#confirmUncertainty").textContent = `请核对前面填写或选择的关键信息，尤其是：${result.uncertainties.slice(0, 3).join("；")}`;
      if (result?.sources?.length) {
        const suppliedSources = sources.filter(source => source.type === "用户提供" || source.type === "本地文件");
        const researchedSources = result.sources.map(source => ({
          title: source.title || "题型参考来源",
          detail: source.url || source.note || source.reason || source.detail || "",
          type: source.type || "题型参考"
        }));
        const mergedSources = [...suppliedSources, ...researchedSources];
        pendingSettings.suggestedSources = mergedSources;
        renderSourceChoices(mergedSources);
      }
      setResearchState("success", result?.summary || "已整理考试资料和训练点参考，请检查后再确认。");
    } catch {
      setResearchState("error", "实时核验暂不可用，当前显示内置资料来源；你仍可检查后继续生成计划。");
    }
  } else if (settings.autoResearch) {
    setResearchState("error", "本地页面不能执行实时搜索，请使用在线版；当前显示内置资料来源预览。");
  }
}

function showImportResults(result = null) {
  if (result) renderRecognizedImportItems(result);
  $("#importResults").classList.remove("hidden");
  $("#analyzeImport").classList.add("hidden");
  $("#confirmImport").classList.remove("hidden");
}

function confirmImportedErrors() {
  const imported = recognizedImportItems.length ? recognizedImportItems : [{
    section: "词汇 / 语法", title: "场所助词 에 与 에서", focus: "区分存在或到达的地点，与动作发生的地点。",
    reasoning: "先看谓语，再判断地点承担什么作用。", habit: "只记中文意思，没有结合谓语判断。", action: "作答前先圈出谓语。"
  }];
  imported.forEach((item, index) => {
    const reason = $(`[data-import-reason="${index}"]`)?.value || "待完成诊断后确认";
    errorItems.unshift({
      id: `imported-${Date.now()}-${index}`, filter: ["due"], section: item.section || "其他", title: item.title || item.question || `导入错题 ${index + 1}`, source: "从历史错题照片导入 · AI识别", due: true,
      focus: item.focus || "根据题干和正确答案确认考查重点。",
      cause: reason,
      reasoning: item.reasoning || "先定位题干关键信息，再排除不符合条件的选项。",
      habit: item.habit || "作答过程待进一步诊断。",
      action: item.action || "下次作答前圈出关键词，并说出选择依据。",
      progress: "待完成诊断 0 / 3题", reviews: ["current", "", "", ""]
    });
  });
  persistErrorItems();
  showingSampleErrors = false;
  scheduleCloudSave();
  renderErrors();
  $("#errorBadge").textContent = errorItems.filter(item => !item.mastered).length;
  closeModal("importModal");
  showToast("已导入错题集，并安排3道诊断题");
}

function switchView(view) {
  $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach(section => section.classList.remove("active"));
  $("#" + view + "View").classList.add("active");
  if (view === "progress") renderProgressView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyErrorFilter(filter) {
  $$("[data-overview-filter]").forEach(card => {
    const active = card.dataset.overviewFilter === filter;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", String(active));
  });
  renderErrors(filter);
}

function initializeEvents() {
  $$(".tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  $$("[data-view-jump]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewJump)));
  $$("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
  $$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(backdrop.id); }));
  $$("[data-overview-filter]").forEach(card => card.addEventListener("click", () => {
    const filter = card.classList.contains("active") ? "all" : card.dataset.overviewFilter;
    applyErrorFilter(filter);
    $("#errorList").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  $("#saveReflection").addEventListener("click", saveReflection);
  $("#cancelTaskPlan").addEventListener("click", cancelActiveTaskPlan);
  $("#editTaskPlan").addEventListener("click", () => toggleTaskEdit());
  $("#discardTaskEdit").addEventListener("click", () => toggleTaskEdit(false));
  $("#saveTaskEdit").addEventListener("click", saveTaskEdit);
  $("#openPractice").addEventListener("click", () => { const linkedTaskId = activeTaskId; closeModal("taskModal"); startPractice("e1", linkedTaskId); });
  $("#startDueReview").addEventListener("click", () => {
    const dueItem = errorItems.find(item => item.due && !item.mastered);
    if (!dueItem) return showToast("目前没有到期错题");
    startPractice(dueItem.id);
  });
  $("#nextQuestion").onclick = advanceQuestion;
  $("#prevQuestion").addEventListener("click", () => {
    if (questionIndex > 0) { questionIndex -= 1; selectedAnswer = null; questionGraded = false; renderQuestion(); }
  });
  $("#openSettings").addEventListener("click", () => openModal("settingsModal"));
  $("#openAccount").addEventListener("click", () => openModal("accountModal"));
  $("#signUpButton").addEventListener("click", () => authenticateCloud("signup"));
  $("#signInButton").addEventListener("click", () => authenticateCloud("signin"));
  $("#skipLoginButton").addEventListener("click", () => {
    closeModal("accountModal");
    if (!localStorage.getItem("topikPrototypeOnboarded")) openModal("settingsModal");
  });
  $("#syncNowButton").addEventListener("click", () => saveCloudState(true));
  $("#signOutButton").addEventListener("click", async () => {
    if (cloud.session?.access_token) await cloudRequest("/auth/v1/logout", { method: "POST" }).catch(() => null);
    storeCloudSession(null);
    closeModal("accountModal");
    showToast("已退出登录，本机数据仍然保留");
  });
  $$('input[name="exam"]').forEach(input => input.addEventListener("change", () => {
    if (!input.checked) return;
    $$('input[name="weak"]').forEach(item => { item.checked = false; });
    const defaults = input.value === "IELTS" ? ["听力", "阅读", "写作", "口语"] : (input.value === "TOPIK" ? ["听力", "阅读"] : []);
    $$('input[name="weak"]').forEach(item => { item.checked = defaults.includes(item.value); });
    const level = $('input[name="level"]:checked').value;
    updateExamOptions(input.value, level);
  }));
  $$('input[name="level"]').forEach(input => input.addEventListener("change", () => {
    if (input.checked) {
      updateTargetGradeOptions(input.value);
      updateExamOptions($('input[name="exam"]:checked').value, input.value);
    }
  }));
  $$('input[name="intensity"]').forEach(input => input.addEventListener("change", () => {
    const isCustom = input.checked && input.value === "自定义";
    if (input.checked) $("#customDuration").classList.toggle("hidden", !isCustom);
  }));
  $("#openImport").addEventListener("click", () => openModal("importModal"));
  $("#errorFiles").addEventListener("change", event => {
    const files = [...event.target.files];
    if (files.length > importFileLimit) showToast(`一次最多导入${importFileLimit}个文件，已保留前${importFileLimit}个`);
    importFiles = files.slice(0, importFileLimit).map(file => ({
      name: file.name,
      label: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      file
    }));
    delete $("#useSampleImport").dataset.sample;
    renderImportPreviews();
  });
  $("#materialFiles").addEventListener("change", event => {
    const incoming = [...event.target.files];
    const combined = [...learningMaterialFiles, ...incoming].filter((file, index, list) => list.findIndex(item => item.name === file.name && item.size === file.size) === index);
    if (combined.length > learningMaterialLimit) showToast(`本地资料一次最多${learningMaterialLimit}个，已保留前${learningMaterialLimit}个`);
    learningMaterialFiles = combined.slice(0, learningMaterialLimit);
    event.target.value = "";
    renderLearningMaterialFiles();
  });
  $("#useSampleImport").addEventListener("click", () => {
    importFiles = [{ name: "示例错题照片.jpg", label: "示例 · 1张", preview: samplePreview }];
    $("#useSampleImport").dataset.sample = "yes";
    renderImportPreviews();
    showToast("已载入示例照片");
  });
  $("#analyzeImport").addEventListener("click", async () => {
    if (!importFiles.length) return showToast("请先选择照片，或使用示例照片体验");
    if ($("#useSampleImport").dataset.sample) {
      recognizedImportItems = [];
      return showImportResults();
    }
    if (location.protocol === "file:") return showToast("真实识别请使用已发布的在线网址");
    const button = $("#analyzeImport");
    button.disabled = true;
    button.textContent = "正在识别…";
    try {
      const images = await Promise.all(importFiles.map(async item => ({ name: item.name, dataUrl: await compressImage(item.file) })));
      const result = await callStudyAssistant("vision", { images });
      if (!result?.items?.length) throw new Error("未识别到清晰错题");
      showImportResults(result);
      showToast(`已识别 ${result.items.length} 道错题，请确认`);
    } catch (error) {
      showToast(error.message || "照片识别失败，请重试");
    } finally {
      button.disabled = false;
      button.textContent = "识别并整理";
    }
  });
  $("#confirmImport").addEventListener("click", confirmImportedErrors);
  $("#backToSettings").addEventListener("click", () => { closeModal("resourceConfirmModal"); openModal("settingsModal"); });
  $("#confirmPlanSources").addEventListener("click", () => {
    if (!pendingSettings) return;
    const selectedIndexes = $$('[data-confirm-source]:checked').map(input => Number(input.dataset.confirmSource));
    pendingSettings.confirmedSources = (pendingSettings.suggestedSources || []).filter((_, index) => selectedIndexes.includes(index));
    commitPlanSettings(pendingSettings);
  });
  $("#confirmUncertaintyCheck").addEventListener("change", updatePlanConfirmationState);
  $("#dailyReminderEnabled").addEventListener("change", async event => {
    if (event.target.checked && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    writeReminderSettings({ enabled: event.target.checked });
    showToast(event.target.checked ? "已开启每日复盘提醒" : "已关闭每日复盘提醒");
  });
  $("#dailyReminderTime").addEventListener("change", event => {
    writeReminderSettings({ time: event.target.value || "21:30" });
    showToast(`复盘提醒时间已改为 ${readReminderSettings().time}`);
  });
  $("#dailyReminderNotify").addEventListener("click", async () => {
    if (!("Notification" in window)) return showToast("当前浏览器不支持系统通知");
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    renderReminderUI();
    if (permission === "granted") {
      writeReminderSettings({ enabled: true });
      showToast("浏览器通知已开启");
    } else showToast("没有通知权限时，仍会在网页内提醒");
  });
  $$(".import-choice").forEach(button => button.addEventListener("click", () => {
    $$(".import-choice").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
  }));
  $$("[data-calendar-filter]").forEach(button => button.addEventListener("click", () => {
    applyCalendarFilter(button.dataset.calendarFilter);
  }));
  $("#settingsForm").addEventListener("submit", event => {
    event.preventDefault();
    const exam = $('input[name="exam"]:checked').value;
    const level = $('input[name="level"]:checked').value;
    const targetGrade = exam === "TOPIK" ? ($('input[name="targetGrade"]:checked')?.value || (level === "II" ? "4" : "2")) : "";
    const foundation = $('input[name="foundation"]:checked')?.value || "不确定";
    const weak = $$('input[name="weak"]:checked').map(input => input.value);
    const times = $$('input[name="time"]:checked').map(input => input.value);
    const intensity = $('input[name="intensity"]:checked').value;
    const minHours = Number($("#durationMin").value);
    const maxHours = Number($("#durationMax").value);
    const customExamName = exam === "OTHER" ? $("#customExamName").value.trim() : "";
    const customExamGoal = exam === "OTHER" ? $("#customExamGoal").value.trim() : "";
    const studyContent = $("#studyContent").value.trim();
    const examDate = $("#examDate").value;
    const firstRoundWeeks = Number($("#firstRoundWeeks").value);
    const studyDays = $$("input[name=\"studyDay\"]:checked").map(input => input.value);
    const availableStart = $("#availableStart").value;
    const availableEnd = $("#availableEnd").value;
    const resourceLinks = $("#resourceLinks").value.split(/\n+/).map(link => link.trim()).filter(Boolean);
    const materialFiles = learningMaterialFiles.map(file => ({
      name: file.name,
      type: file.type || "未知类型",
      size: file.size,
      sizeLabel: file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
    }));
    const autoResearch = $("#autoResearch").checked;
    if (exam === "OTHER" && !customExamName) return showToast("请填写考试或学习项目名称");
    if (exam === "OTHER" && !studyContent && !resourceLinks.length && !materialFiles.length && !autoResearch) return showToast("请填写补充学习范围、添加资料，或允许AI搜索");
    if (!studyDays.length) return showToast("请至少选择一个学习日");
    if (!firstRoundWeeks) return showToast("请填写第一轮计划用时");
    if (!availableStart || !availableEnd || availableStart >= availableEnd) return showToast("请填写有效的学习时间范围");
    if (intensity === "自定义" && minHours > maxHours) return showToast("每天最少时长不能大于最多时长");
    if (intensity === "自定义" && (!minHours || !maxHours)) return showToast("请填写完整的自定义时长");
    const intensityLabel = intensity === "自定义" ? `${minHours}–${maxHours}小时/天` : (intensity === "高强度" ? "高强度" : `${intensity}强度`);
    const settings = { exam, level, targetGrade, foundation, weak, times, intensity, minHours, maxHours, intensityLabel, customExamName, customExamGoal, studyContent, examDate, firstRoundWeeks, studyDays, availableStart, availableEnd, resourceLinks, materialFiles, autoResearch };
    showResourceConfirmation(settings);
  });
  ["prevWeek", "nextWeek", "todayButton"].forEach(id => $("#" + id).addEventListener("click", () => showToast("原型当前展示第一周计划")));
}

renderCalendar();
renderErrors();
initializeEvents();
const previewRewardId = new URLSearchParams(location.search).get("previewReward");
const savedSettings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null");
if (savedSettings) {
  const savedExam = $(`input[name="exam"][value="${savedSettings.exam || "TOPIK"}"]`);
  if (savedExam) savedExam.checked = true;
  const savedLevel = $(`input[name="level"][value="${savedSettings.level || "I"}"]`);
  if (savedLevel) savedLevel.checked = true;
  const savedIntensity = $(`input[name="intensity"][value="${savedSettings.intensity}"]`);
  if (savedIntensity) savedIntensity.checked = true;
  const savedFoundation = $(`input[name="foundation"][value="${savedSettings.foundation || "不确定"}"]`);
  if (savedFoundation) savedFoundation.checked = true;
  if (savedSettings.weak) $$('input[name="weak"]').forEach(input => { input.checked = savedSettings.weak.includes(input.value); });
  if (savedSettings.times) $$('input[name="time"]').forEach(input => { input.checked = savedSettings.times.includes(input.value); });
  $("#durationMin").value = savedSettings.minHours || 2;
  $("#durationMax").value = savedSettings.maxHours || 4;
  $("#customExamName").value = savedSettings.customExamName || "";
  $("#customExamGoal").value = savedSettings.customExamGoal || "";
  $("#studyContent").value = savedSettings.studyContent || savedSettings.customStudyContent || "";
  $("#examDate").value = savedSettings.examDate || "";
  $("#firstRoundWeeks").value = savedSettings.firstRoundWeeks || 6;
  if (savedSettings.studyDays) $$("input[name=\"studyDay\"]").forEach(input => { input.checked = savedSettings.studyDays.includes(input.value); });
  $("#availableStart").value = savedSettings.availableStart || "11:00";
  $("#availableEnd").value = savedSettings.availableEnd || "21:00";
  $("#resourceLinks").value = (savedSettings.resourceLinks || []).join("\n");
  if (savedSettings.localFileCount) $("#materialFileList").innerHTML = `<div class="source-line">上次使用了 ${savedSettings.localFileCount} 个本地文件；出于安全，刷新后需要重新选择。</div>`;
  $("#autoResearch").checked = savedSettings.autoResearch !== false;
  $("#customDuration").classList.toggle("hidden", savedSettings.intensity !== "自定义");
  $("#profileIntensity").textContent = savedSettings.intensityLabel || "中等强度";
  updateExamOptions(savedSettings.exam || "TOPIK", savedSettings.level || "I");
  updateTargetGradeOptions(savedSettings.level || "I", savedSettings.targetGrade || (savedSettings.level === "II" ? "4" : "2"));
  applyExamBrand(savedSettings.exam || "TOPIK", savedSettings.level || "I", savedSettings.targetGrade);
  if (localStorage.getItem("topikPrototypePlanVersion") !== planSchemaVersion) {
    const upgradedSettings = { exam: savedSettings.exam || "TOPIK", level: savedSettings.level || "I", foundation: savedSettings.foundation || "一般", weak: savedSettings.weak || ["听力", "阅读"], times: savedSettings.times || ["下午", "晚上"], ...savedSettings };
    tasks = generatePlanFromSettings(upgradedSettings);
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
    localStorage.setItem("topikPrototypePlanVersion", planSchemaVersion);
    renderCalendar();
  }
} else {
  updateExamOptions("TOPIK", "I");
}
initializeCloud().finally(() => {
  if (previewRewardId && rewardCatalog[previewRewardId]) return;
  if (localStorage.getItem("topikPrototypeOnboarded")) return;
  if (cloud.session?.access_token) openModal("settingsModal");
  else openModal("accountModal");
});
updateTomorrowFocus();
renderReminderUI();
scheduleDailyReminder();
if (previewRewardId && rewardCatalog[previewRewardId]) setTimeout(() => {
  $$(".modal-backdrop").forEach(backdrop => backdrop.classList.add("hidden"));
  document.body.style.overflow = "";
  showReward(rewardCatalog[previewRewardId]);
}, 450);
