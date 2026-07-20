const categoryMeta = {
  listening: { label: "听力", className: "listening" },
  reading: { label: "阅读", className: "reading" },
  vocab: { label: "词汇 / 语法", className: "vocab" },
  writing: { label: "写作", className: "writing" },
  speaking: { label: "口语", className: "speaking" },
  mock: { label: "模拟测验", className: "mock" },
  dictation: { label: "听写", className: "dictation" },
  consolidation: { label: "巩固练习", className: "consolidation" },
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

function buildCurrentWeekDays(referenceDate = new Date(), featuredReference = new Date()) {
  const [year, month, dayOfMonth] = beijingDateKey(referenceDate).split("-").map(Number);
  const referenceDay = new Date(year, month - 1, dayOfMonth);
  const [featuredYear, featuredMonth, featuredDayOfMonth] = beijingDateKey(featuredReference).split("-").map(Number);
  const featuredDay = new Date(featuredYear, featuredMonth - 1, featuredDayOfMonth);
  const mondayOffset = (referenceDay.getDay() + 6) % 7;
  const monday = new Date(referenceDay);
  monday.setDate(referenceDay.getDate() - mondayOffset);
  return baseDays.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { ...day, date: dateLabel(date), fullDate: date, featured: sameDate(date, featuredDay) };
  });
}

let days = buildCurrentWeekDays();
let displayedWeekIndex = 0;

function normalizedWeekIndex(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function taskWeekIndex(task = {}) {
  return normalizedWeekIndex(task.weekIndex);
}

function configuredPlanWeekCount(settings = readStudySettings()) {
  const configured = Number(settings?.firstRoundWeeks || 0);
  const taskMaximum = tasks?.length ? Math.max(...tasks.map(task => taskWeekIndex(task))) + 1 : 1;
  return Math.max(1, Math.min(24, configured || taskMaximum || 1));
}

function configuredPlanStartDate(settings = readStudySettings()) {
  const fallback = buildCurrentWeekDays()[0].fullDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings?.planStartDate || "")) return fallback;
  const [year, month, day] = settings.planStartDate.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function initialPlanStartDate(settings = readStudySettings()) {
  const currentWeek = buildCurrentWeekDays();
  const todayIndex = Math.max(0, baseDays.findIndex(day => day.key === beijingDayKey()));
  const selectedDays = Array.isArray(settings?.studyDays) && settings.studyDays.length
    ? settings.studyDays
    : baseDays.map(day => day.key);
  const hasRemainingDay = baseDays.some((day, index) => index >= todayIndex && selectedDays.includes(day.key));
  const start = new Date(currentWeek[0].fullDate);
  if (!hasRemainingDay) start.setDate(start.getDate() + 7);
  return beijingDateKey(start);
}

function buildPlanWeekDays(weekIndex = 0, settings = readStudySettings()) {
  const referenceDate = new Date(configuredPlanStartDate(settings));
  referenceDate.setDate(referenceDate.getDate() + normalizedWeekIndex(weekIndex) * 7);
  return buildCurrentWeekDays(referenceDate);
}

function planWeekIndexForDate(date = new Date(), settings = readStudySettings()) {
  const targetKey = beijingDateKey(date);
  const [year, month, day] = targetKey.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const distance = Math.floor((target.getTime() - configuredPlanStartDate(settings).getTime()) / 86400000);
  return Math.max(0, Math.min(configuredPlanWeekCount(settings) - 1, Math.floor(distance / 7)));
}

function taskScheduledDate(task = {}) {
  const weekDays = buildPlanWeekDays(taskWeekIndex(task));
  return weekDays.find(day => day.key === task.day)?.fullDate || weekDays[0].fullDate;
}

function taskScheduledDateKey(task = {}) {
  return beijingDateKey(taskScheduledDate(task));
}
let activeTtsAudio = null;
let activeTtsAudioUrl = "";
let dictationInkStrokes = [];
let dictationHandwritingRecognizer = null;
let wordEliminationResolving = false;
let wordEliminationTimer = null;

const defaultTasks = [
  { id: 1, day: "mon", start: "11:00", end: "11:40", category: "listening", title: "短对话诊断", note: "辨认场所、人物与行动", status: "completed", standards: ["首遍不暂停完成15题", "正确率达到80%", "错题复听并写下漏听关键词", "次日重做错题"] },
  { id: 2, day: "mon", start: "19:30", end: "20:10", category: "vocab", title: "生活场景高频词", note: "交通、购物、时间", status: "completed", standards: ["学习30个高频词", "完成韩中辨认和例句填空", "当天正确率达到90%", "次日无提示回忆率达到85%"] },
  { id: 3, day: "tue", start: "11:00", end: "11:45", category: "reading", title: "助词与句子结构", note: "은/는、이/가、을/를", status: "progress", standards: ["25分钟内完成20题", "正确率达到80%", "错题标注为词汇、语法或理解错误", "在句子中圈出判断依据"] },
  { id: 4, day: "tue", start: "20:00", end: "20:35", category: "consolidation", title: "否定表达巩固练习", note: "안、못、-지 않다", status: "planned", standards: ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "按错因进入后续复盘"] },
  { id: 5, day: "wed", start: "11:00", end: "11:45", category: "listening", title: "场景对话训练", note: "商店、餐厅、医院", status: "planned", standards: ["首遍不暂停完成15题", "每题记录场所关键词", "错题至少复听2遍", "正确率达到80%"] },
  { id: 6, day: "wed", start: "19:30", end: "20:10", category: "reading", title: "短文信息定位", note: "公告、广告、便条", status: "planned", standards: ["30分钟完成4篇短文共16题", "标出每题答案依据", "正确率达到80%", "每篇用一句中文概括主旨"] },
  { id: 7, day: "thu", start: "11:00", end: "11:40", category: "vocab", title: "动词与形容词变形", note: "现在、过去、将来", status: "planned", standards: ["完成24道变形题", "限时25分钟", "正确率达到85%", "错题各造一个新句子"] },
  { id: 8, day: "thu", start: "20:00", end: "20:35", category: "consolidation", title: "词汇隔日回忆", note: "不看词表主动回忆", status: "planned", standards: ["无提示回忆周一30词", "系统统计正确率", "薄弱词放入新语境", "按错因进入后续复盘"] },
  { id: 9, day: "fri", start: "11:00", end: "11:45", category: "listening", title: "说话意图判断", note: "为什么这样说、想表达什么", status: "planned", standards: ["完成15题，首遍不暂停", "写下决定答案的动词", "正确率达到80%", "错题完成近义变式"] },
  { id: 10, day: "fri", start: "19:30", end: "20:15", category: "reading", title: "句子排序与衔接", note: "连接词、指代关系", status: "planned", standards: ["35分钟完成15题", "圈出连接词和指代词", "正确率达到80%", "错题复述排序依据"] },
  { id: 11, day: "sat", start: "14:00", end: "15:40", category: "mock", title: "半套限时模拟", note: "听力15题＋阅读20题", status: "planned", standards: ["全程不中断、不查词", "按规定时间完成35题", "分别记录听力和阅读正确率", "归类全部错题"] },
  { id: 12, day: "sat", start: "20:00", end: "20:35", category: "consolidation", title: "阶段综合检验", note: "只处理最高频两类薄弱点", status: "planned", standards: ["完成本组综合练习", "系统统计正确率", "整理薄弱点", "安排下周强化任务"] },
  { id: 13, day: "sun", start: "11:00", end: "11:40", category: "consolidation", title: "本周知识二次检验", note: "延迟变式题", status: "planned", standards: ["完成10道延迟变式题", "系统统计正确率", "口头解释判断顺序", "仍错知识点标记需重学"] },
  { id: 14, day: "sun", start: "20:00", end: "20:25", category: "vocab", title: "轻量复习与下周预习", note: "只看未掌握内容", status: "planned", standards: ["复习未掌握词汇", "预览下周3个语法点", "写下一个最需要解决的问题", "25分钟到时停止"] }
];

let tasks = JSON.parse(localStorage.getItem("topikPrototypeTasks") || "null") || [];

const studyTemplates = {
  listening: [
    ["听人物和地点", "短对话里先抓谁、在哪里、正在做什么"], ["听力 · 判断下一步行动", "练“接下来做什么”和请求表达"], ["听说话人意图", "判断说话目的和最想传达的信息"], ["听职业与身份", "根据职责、场所和行动判断说话人身份"], ["听说话人态度", "判断赞同、担忧、质疑或坚持等态度"], ["听主题与内容", "概括整段材料主要在说明什么"], ["听说明方式", "判断说话人是在概括、分类、解释还是举例"], ["听对话前文推断", "根据当前回应反推对话前文"], ["听原因和理由", "抓 못 가요、바뀌었어요 等理由线索"], ["听数字和时间", "练日期、价格、时间和数量"], ["听内容一致", "核对选项是否和原文相同"], ["听否定和时态", "听清 안、못、过去和将来"], ["看图听关键词", "先看图中差异，再听对应词"], ["听后复述", "复听、影子跟读、用中文说出大意"]
  ],
  reading: [
    ["通知公告阅读", "练日期、地点、对象和规则"], ["促销广告阅读", "练价格、时间、活动和条件"], ["短文大意理解", "找重复关键词和中心句"], ["题干关键词定位", "先看题干，再回原文找依据"], ["图表信息读取", "读表格、时间表和简单说明"], ["句子连接判断", "看前后句的因果、转折和顺序"], ["限时阅读", "控制速度，同时标出答案依据"]
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
  dictation: [
    ["常见词听写", "听音后写出真题常见词"], ["搭配词听写", "听音后写出常见搭配里的核心词"], ["听错词巩固", "从听力和阅读错题里抽词背写"], ["助词词形听写", "练常见助词相关词形"]
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
  dictation: ["播放后完成手写", "核对原词、搭配和例句", "不熟词标记进复盘", "确认掌握后进入下一条"],
  consolidation: ["完成本组系统练习", "系统统计正确率", "错题产生后进入错题集", "按错因进入后续复盘"],
  review: ["完成全部到期错题", "完成延迟变式题", "正确率达到90%", "能口头说明判断路径"],
  mock: ["全程不中断、不查词", "按规定时间完成", "记录各部分正确率", "归类全部错题"]
};

const weakTokenMap = { "听力": "listening", "阅读": "reading", "词汇": "vocab", "语法": "grammar", "写作": "writing", "口语": "speaking" };
const planSchemaVersion = "24";
const dictationStorageKey = "topikPrototypeDictationState";
const wordEliminationStorageKey = "topikPrototypeWordEliminationState";
const externalStudyStorageKey = "topikPrototypeExternalStudyRecords";
let externalVoiceRecognition = null;
let externalVoiceBaseText = "";
const completeMasteryTopikIReadingSource = "完全掌握 TOPIK I 初级阅读 · 1-2 必背单词";
const dictationItems = [
  { id: "bag", pos: "名", text: "가방", zh: "包", pairing: "가방을 사다", pairingZh: "买包", example: "새 가방을 샀어요.", exampleZh: "我买了新包。", note: "TOPIK I 生活名词", source: completeMasteryTopikIReadingSource },
  { id: "price", pos: "名", text: "값", zh: "价格", pairing: "값이 싸다", pairingZh: "价格便宜", example: "이 옷은 값이 싸요.", exampleZh: "这件衣服价格便宜。", note: "购物场景常见词", source: completeMasteryTopikIReadingSource },
  { id: "building", pos: "名", text: "건물", zh: "建筑 / 楼", pairing: "학교 건물", pairingZh: "学校建筑", example: "저 건물이 도서관입니다.", exampleZh: "那栋楼是图书馆。", note: "地点信息常见词", source: completeMasteryTopikIReadingSource },
  { id: "plan", pos: "名", text: "계획", zh: "计划", pairing: "여행 계획", pairingZh: "旅行计划", example: "주말 계획이 있어요.", exampleZh: "我有周末计划。", note: "日程安排常见词", source: completeMasteryTopikIReadingSource },
  { id: "study", pos: "名/动", text: "공부", zh: "学习", pairing: "한국어 공부", pairingZh: "韩语学习", example: "저는 한국어를 공부해요.", exampleZh: "我学习韩语。", note: "学习场景核心词", source: completeMasteryTopikIReadingSource },
  { id: "traffic", pos: "名", text: "교통", zh: "交通", pairing: "교통이 편리하다", pairingZh: "交通便利", example: "서울은 교통이 편리해요.", exampleZh: "首尔交通很便利。", note: "城市生活常见词", source: completeMasteryTopikIReadingSource },
  { id: "dormitory", pos: "名", text: "기숙사", zh: "宿舍", pairing: "기숙사에 살다", pairingZh: "住在宿舍", example: "친구는 기숙사에 살아요.", exampleZh: "朋友住在宿舍。", note: "学校生活常见词", source: completeMasteryTopikIReadingSource },
  { id: "basketball", pos: "名", text: "농구", zh: "篮球", pairing: "농구를 하다", pairingZh: "打篮球", example: "동생은 농구를 좋아해요.", exampleZh: "弟弟喜欢篮球。", note: "兴趣活动常见词", source: completeMasteryTopikIReadingSource },
  { id: "class", pos: "名", text: "수업", zh: "课 / 上课", pairing: "수업을 듣다", pairingZh: "听课 / 上课", example: "오늘 수업이 있어요.", exampleZh: "今天有课。", note: "课程安排常见词", source: completeMasteryTopikIReadingSource },
  { id: "homework", pos: "名", text: "숙제", zh: "作业", pairing: "숙제를 하다", pairingZh: "做作业", example: "숙제를 다 했어요.", exampleZh: "作业都做完了。", note: "学习任务常见词", source: completeMasteryTopikIReadingSource },
  { id: "movie", pos: "名", text: "영화", zh: "电影", pairing: "영화를 보다", pairingZh: "看电影", example: "주말에 영화를 봤어요.", exampleZh: "周末看了电影。", note: "休闲活动常见词", source: completeMasteryTopikIReadingSource },
  { id: "foreign-language", pos: "名", text: "외국어", zh: "外语", pairing: "외국어를 배우다", pairingZh: "学习外语", example: "외국어 공부가 재미있어요.", exampleZh: "外语学习很有意思。", note: "学习主题常见词", source: completeMasteryTopikIReadingSource },
  { id: "diary", pos: "名", text: "일기", zh: "日记", pairing: "일기를 쓰다", pairingZh: "写日记", example: "매일 일기를 써요.", exampleZh: "我每天写日记。", note: "日常动作常见词", source: completeMasteryTopikIReadingSource },
  { id: "eraser", pos: "名", text: "지우개", zh: "橡皮", pairing: "지우개가 필요하다", pairingZh: "需要橡皮", example: "지우개를 빌려 주세요.", exampleZh: "请借我橡皮。", note: "学习用品常见词", source: completeMasteryTopikIReadingSource },
  { id: "book", pos: "名", text: "책", zh: "书", pairing: "책을 읽다", pairingZh: "读书", example: "도서관에서 책을 읽어요.", exampleZh: "在图书馆读书。", note: "阅读场景核心词", source: completeMasteryTopikIReadingSource },
  { id: "soccer", pos: "名", text: "축구", zh: "足球", pairing: "축구를 하다", pairingZh: "踢足球", example: "친구와 축구를 했어요.", exampleZh: "和朋友踢了足球。", note: "运动活动常见词", source: completeMasteryTopikIReadingSource },
  { id: "taxi", pos: "名", text: "택시", zh: "出租车", pairing: "택시를 타다", pairingZh: "坐出租车", example: "역까지 택시를 탔어요.", exampleZh: "坐出租车到了车站。", note: "交通场景常见词", source: completeMasteryTopikIReadingSource },
  { id: "letter", pos: "名", text: "편지", zh: "信", pairing: "편지를 쓰다", pairingZh: "写信", example: "친구에게 편지를 썼어요.", exampleZh: "给朋友写了信。", note: "交流表达常见词", source: completeMasteryTopikIReadingSource },
  { id: "ticket", pos: "名", text: "표", zh: "票", pairing: "표를 사다", pairingZh: "买票", example: "영화 표를 샀어요.", exampleZh: "买了电影票。", note: "购票场景常见词", source: completeMasteryTopikIReadingSource },
  { id: "meeting", pos: "名", text: "회의", zh: "会议", pairing: "회의에 가다", pairingZh: "去开会", example: "오후에 회의가 있어요.", exampleZh: "下午有会议。", note: "日程安排常见词", source: completeMasteryTopikIReadingSource },
  { id: "cannot-go-meeting", pos: "短句", text: "회의에 못 갈 것 같아요.", zh: "我可能去不了会议。", pairing: "못 가다", pairingZh: "去不了", example: "오늘 동아리 회의에 못 갈 것 같아요.", exampleZh: "今天可能去不了社团会议。", note: "听力理由表达", source: "TOPIK 听力同型短句 · 样板" },
  { id: "send-opinion", pos: "短句", text: "의견을 문자로 보내 주세요.", zh: "请用短信发送意见。", pairing: "문자로 보내다", pairingZh: "用短信发送", example: "내일 오전까지 의견을 문자로 보내 주세요.", exampleZh: "请明天上午前把意见用短信发来。", note: "听力请求表达", source: "TOPIK 听力同型短句 · 样板" }
];

const topik102WordEliminationItems = [
  { id: "topik102-part-time", pos: "名", text: "아르바이트", zh: "兼职 / 打工", pairing: "아르바이트를 하다", pairingZh: "做兼职", example: "아르바이트 시간이 바뀌었어요.", exampleZh: "兼职时间变了。", note: "听力日程场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-application", pos: "名", text: "신청", zh: "申请", pairing: "신청을 하다", pairingZh: "提出申请", example: "재발급 신청을 했어요.", exampleZh: "我申请了补发。", note: "听力办事场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-presentation", pos: "名", text: "발표", zh: "发表 / 演讲", pairing: "발표를 준비하다", pairingZh: "准备演讲", example: "발표 자료를 준비했어요.", exampleZh: "准备了演讲资料。", note: "听力学校场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-material", pos: "名", text: "자료", zh: "资料", pairing: "자료를 복사하다", pairingZh: "复印资料", example: "회의 자료를 복사해 주세요.", exampleZh: "请复印会议资料。", note: "听力办公场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-copier", pos: "名", text: "복사기", zh: "复印机", pairing: "복사기를 사용하다", pairingZh: "使用复印机", example: "복사기가 고장 났어요.", exampleZh: "复印机坏了。", note: "听力办公场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-delivery", pos: "名", text: "택배", zh: "快递", pairing: "택배를 받다", pairingZh: "收快递", example: "택배가 관리실에 있어요.", exampleZh: "快递在管理室。", note: "听力生活场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-message", pos: "名", text: "문자", zh: "短信", pairing: "문자를 보내다", pairingZh: "发短信", example: "의견을 문자로 보내 주세요.", exampleZh: "请用短信发送意见。", note: "听力请求表达", source: "第102届 TOPIK II 听力" },
  { id: "topik102-club", pos: "名", text: "동아리", zh: "社团", pairing: "동아리 회의", pairingZh: "社团会议", example: "오늘 동아리 회의가 있어요.", exampleZh: "今天有社团会议。", note: "听力学校场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-office", pos: "名", text: "관리실", zh: "管理室", pairing: "관리실에 맡기다", pairingZh: "寄放在管理室", example: "관리실에 물어보세요.", exampleZh: "请去管理室问问。", note: "听力居住场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-service", pos: "名", text: "서비스", zh: "服务", pairing: "서비스를 이용하다", pairingZh: "使用服务", example: "상담 서비스를 이용했어요.", exampleZh: "使用了咨询服务。", note: "听力咨询场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-tax-accountant", pos: "名", text: "세무사", zh: "税务师", pairing: "세무사와 상담하다", pairingZh: "向税务师咨询", example: "세무사에게 서류를 보냈어요.", exampleZh: "把材料发给了税务师。", note: "听力职业场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-consultation", pos: "名", text: "상담", zh: "咨询", pairing: "상담을 받다", pairingZh: "接受咨询", example: "전화로 상담을 받았어요.", exampleZh: "通过电话接受了咨询。", note: "听力咨询场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-document", pos: "名", text: "서류", zh: "文件 / 材料", pairing: "서류를 제출하다", pairingZh: "提交材料", example: "필요한 서류를 준비하세요.", exampleZh: "请准备所需材料。", note: "听力办事场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-rule", pos: "名", text: "규정", zh: "规定", pairing: "규정을 확인하다", pairingZh: "确认规定", example: "회사 규정을 확인했어요.", exampleZh: "确认了公司规定。", note: "听力职场场景", source: "第102届 TOPIK II 听力" },
  { id: "topik102-income", pos: "名", text: "소득", zh: "收入", pairing: "소득을 신고하다", pairingZh: "申报收入", example: "소득 관련 서류가 필요해요.", exampleZh: "需要收入相关材料。", note: "听力生活信息", source: "第102届 TOPIK II 听力" },
  { id: "topik102-blackout", pos: "名", text: "정전", zh: "停电", pairing: "정전이 발생하다", pairingZh: "发生停电", example: "갑자기 정전이 발생했어요.", exampleZh: "突然停电了。", note: "听力说明材料", source: "第102届 TOPIK II 听力" },
  { id: "topik102-power-output", pos: "名", text: "발전량", zh: "发电量", pairing: "발전량이 늘다", pairingZh: "发电量增加", example: "태양광 발전량이 늘었어요.", exampleZh: "太阳能发电量增加了。", note: "听力讲座材料", source: "第102届 TOPIK II 听力" },
  { id: "topik102-volunteer-group", pos: "名", text: "봉사단", zh: "志愿团", pairing: "봉사단에 참여하다", pairingZh: "参加志愿团", example: "해외 봉사단을 모집합니다.", exampleZh: "正在招募海外志愿团。", note: "听力公益主题", source: "第102届 TOPIK II 听力" },
  { id: "topik102-childcare", pos: "名", text: "보육원", zh: "儿童福利院", pairing: "보육원을 방문하다", pairingZh: "访问儿童福利院", example: "봉사단이 보육원을 방문했어요.", exampleZh: "志愿团访问了儿童福利院。", note: "听力公益主题", source: "第102届 TOPIK II 听力" },
  { id: "topik102-stamp", pos: "名", text: "우표", zh: "邮票", pairing: "우표를 모으다", pairingZh: "收集邮票", example: "박물관에서 옛날 우표를 봤어요.", exampleZh: "在博物馆看到了旧邮票。", note: "阅读博物馆主题", source: "第102届 TOPIK II 阅读" }
];

const completeMasteryWordEliminationItems = [
  { id: "mastery-audience-seat", pos: "名", text: "객석", zh: "观众席", pairing: "객석을 채우다", pairingZh: "坐满观众席", example: "관객들이 객석에 앉았어요.", exampleZh: "观众们坐在观众席上。", note: "场所名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-guest-room", pos: "名", text: "객실", zh: "客房", pairing: "객실 관리", pairingZh: "客房管理", example: "객실이 크고 깨끗해요.", exampleZh: "客房又大又干净。", note: "住宿场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-street", pos: "名", text: "거리", zh: "距离 / 街道", pairing: "거리가 가깝다", pairingZh: "距离近", example: "집에서 학교까지 거리가 가까워요.", exampleZh: "从家到学校距离很近。", note: "位置表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-spider", pos: "名", text: "거미", zh: "蜘蛛", pairing: "거미줄", pairingZh: "蜘蛛网", example: "창문에 거미줄이 있어요.", exampleZh: "窗户上有蜘蛛网。", note: "动物名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-turtle", pos: "名", text: "거북이", zh: "乌龟", pairing: "거북이처럼 느리다", pairingZh: "像乌龟一样慢", example: "거북이가 천천히 걸어요.", exampleZh: "乌龟慢慢地走。", note: "动物名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-change", pos: "名", text: "거스름돈", zh: "找零", pairing: "거스름돈을 받다", pairingZh: "拿找零", example: "거스름돈은 오천 원입니다.", exampleZh: "找零是五千韩元。", note: "购物场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-living-room", pos: "名", text: "거실", zh: "客厅", pairing: "거실에서 텔레비전을 보다", pairingZh: "在客厅看电视", example: "가족이 거실에 모였어요.", exampleZh: "家人聚在客厅。", note: "居住场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-mirror", pos: "名", text: "거울", zh: "镜子", pairing: "거울을 보다", pairingZh: "照镜子", example: "거울을 보고 머리를 정리했어요.", exampleZh: "照着镜子整理了头发。", note: "生活用品", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-beggar", pos: "名", text: "거지", zh: "乞丐", pairing: "거지를 돕다", pairingZh: "帮助乞丐", example: "길에서 거지를 보았어요.", exampleZh: "在路上看到了乞丐。", note: "人物名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-lie", pos: "名", text: "거짓말", zh: "谎话", pairing: "거짓말을 하다", pairingZh: "说谎", example: "친구에게 거짓말을 하지 마세요.", exampleZh: "不要对朋友说谎。", note: "交流表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-foam", pos: "名", text: "거품", zh: "泡沫", pairing: "거품이 일다", pairingZh: "起泡沫", example: "비누에서 거품이 많이 나요.", exampleZh: "肥皂起了很多泡沫。", note: "生活名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-worry", pos: "名", text: "걱정", zh: "担心 / 忧愁", pairing: "걱정이 없다", pairingZh: "没有担心的事", example: "시험 때문에 걱정이 많아요.", exampleZh: "因为考试很担心。", note: "情绪表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-health", pos: "名", text: "건강", zh: "健康", pairing: "건강 검진", pairingZh: "体检", example: "운동은 건강에 좋아요.", exampleZh: "运动有益健康。", note: "健康主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-opposite", pos: "名", text: "건너편", zh: "对面", pairing: "맞은편", pairingZh: "正对面", example: "우리 집 건너편에 마트가 있어요.", exampleZh: "我家对面有超市。", note: "位置表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-construction", pos: "名", text: "건축", zh: "建筑 / 建造", pairing: "건축 회사", pairingZh: "建筑公司", example: "새 도서관을 건축하고 있어요.", exampleZh: "正在建造新图书馆。", note: "建筑主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-step", pos: "名", text: "걸음", zh: "脚步", pairing: "걸음이 빠르다", pairingZh: "脚步快", example: "걸음을 천천히 옮겼어요.", exampleZh: "慢慢地挪动脚步。", note: "动作名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-inspection", pos: "名", text: "검사", zh: "检查", pairing: "건강 검사", pairingZh: "健康检查", example: "병원에서 검사를 받았어요.", exampleZh: "在医院接受了检查。", note: "医疗场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-search", pos: "名", text: "검색", zh: "搜索 / 检索", pairing: "인터넷 검색", pairingZh: "网络搜索", example: "인터넷에서 정보를 검색했어요.", exampleZh: "在网上搜索了信息。", note: "信息主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-fear", pos: "名", text: "겁", zh: "害怕 / 胆怯", pairing: "겁이 나다", pairingZh: "感到害怕", example: "혼자 가려니 겁이 났어요.", exampleZh: "一个人去有点害怕。", note: "情绪表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-board", pos: "名", text: "게시판", zh: "公告栏", pairing: "게시판에 붙이다", pairingZh: "贴在公告栏上", example: "게시판에서 공지를 확인했어요.", exampleZh: "在公告栏确认了通知。", note: "学校场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-game", pos: "名", text: "게임", zh: "游戏 / 比赛", pairing: "게임을 하다", pairingZh: "玩游戏", example: "친구와 게임을 했어요.", exampleZh: "和朋友玩了游戏。", note: "休闲活动", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-result", pos: "名", text: "결과", zh: "结果", pairing: "시험 결과", pairingZh: "考试结果", example: "검사 결과가 나왔어요.", exampleZh: "检查结果出来了。", note: "结果表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-decision", pos: "名", text: "결정", zh: "决定", pairing: "결정을 내리다", pairingZh: "作出决定", example: "회의에서 중요한 결정을 했어요.", exampleZh: "在会议上作了重要决定。", note: "决策表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-marriage", pos: "名", text: "결혼", zh: "结婚", pairing: "결혼을 하다", pairingZh: "结婚", example: "두 사람은 내년에 결혼해요.", exampleZh: "两个人明年结婚。", note: "家庭主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-wedding", pos: "名", text: "결혼식", zh: "婚礼", pairing: "결혼식에 참석하다", pairingZh: "参加婚礼", example: "친구의 결혼식에 갔어요.", exampleZh: "参加了朋友的婚礼。", note: "家庭主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-match", pos: "名", text: "경기", zh: "比赛 / 竞技", pairing: "축구 경기", pairingZh: "足球比赛", example: "경기가 끝났어요.", exampleZh: "比赛结束了。", note: "运动主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-career", pos: "名", text: "경력", zh: "经历 / 工作经验", pairing: "경력이 부족하다", pairingZh: "经验不足", example: "이 일은 경력이 필요해요.", exampleZh: "这份工作需要经验。", note: "求职主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-expense", pos: "名", text: "경비", zh: "经费 / 费用", pairing: "출장 경비", pairingZh: "出差费用", example: "여행 경비를 계산했어요.", exampleZh: "计算了旅行费用。", note: "费用表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-competition", pos: "名", text: "경쟁", zh: "竞争", pairing: "경쟁이 치열하다", pairingZh: "竞争激烈", example: "두 회사의 경쟁이 치열해요.", exampleZh: "两家公司的竞争很激烈。", note: "社会主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-police", pos: "名", text: "경찰", zh: "警察", pairing: "경찰에 신고하다", pairingZh: "报警", example: "길을 경찰에게 물어봤어요.", exampleZh: "向警察问了路。", note: "公共服务", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-scenery", pos: "名", text: "경치", zh: "景色 / 风景", pairing: "경치가 아름답다", pairingZh: "风景优美", example: "산에서 보는 경치가 좋아요.", exampleZh: "从山上看到的景色很好。", note: "旅行主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-tendency", pos: "名", text: "경향", zh: "倾向 / 趋势", pairing: "새로운 경향", pairingZh: "新趋势", example: "소비 경향이 달라졌어요.", exampleZh: "消费趋势发生了变化。", note: "社会主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-experience", pos: "名", text: "경험", zh: "经验 / 经历", pairing: "경험이 많다", pairingZh: "经验丰富", example: "한국 생활 경험이 있어요.", exampleZh: "有在韩国生活的经历。", note: "经历表达", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-stairs", pos: "名", text: "계단", zh: "楼梯", pairing: "계단을 오르다", pairingZh: "上楼梯", example: "계단으로 올라가세요.", exampleZh: "请走楼梯上去。", note: "场所名词", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-egg", pos: "名", text: "계란", zh: "鸡蛋", pairing: "계란을 삶다", pairingZh: "煮鸡蛋", example: "아침에 계란을 먹었어요.", exampleZh: "早上吃了鸡蛋。", note: "饮食主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-payment", pos: "名", text: "계산", zh: "计算 / 结账", pairing: "계산을 하다", pairingZh: "计算 / 结账", example: "식사가 끝나고 계산했어요.", exampleZh: "吃完饭后结了账。", note: "消费场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-deposit", pos: "名", text: "계약금", zh: "定金", pairing: "계약금을 내다", pairingZh: "支付定金", example: "집 계약금을 먼저 냈어요.", exampleZh: "先支付了房屋定金。", note: "合同场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-season", pos: "名", text: "계절", zh: "季节", pairing: "계절이 바뀌다", pairingZh: "季节更替", example: "제가 좋아하는 계절은 봄이에요.", exampleZh: "我喜欢的季节是春天。", note: "天气主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-customer", pos: "名", text: "고객", zh: "顾客", pairing: "고객에게 친절하다", pairingZh: "热情待客", example: "고객의 의견을 들었어요.", exampleZh: "听取了顾客的意见。", note: "服务场景", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" },
  { id: "mastery-meat", pos: "名", text: "고기", zh: "肉", pairing: "고기를 굽다", pairingZh: "烤肉", example: "저녁에 고기를 구웠어요.", exampleZh: "晚上烤了肉。", note: "饮食主题", source: "完全掌握 TOPIK I 初级词汇 · Unit 2" }
];

function readDictationState() {
  const fallback = { index: 0, revealed: false, inputText: "", weakIds: [], knownIds: [], taskSession: null };
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(dictationStorageKey) || "null") || {}) };
  } catch {
    return fallback;
  }
}

function writeDictationState(patch = {}) {
  const current = readDictationState();
  const next = { ...current, ...patch };
  localStorage.setItem(dictationStorageKey, JSON.stringify(next));
  return next;
}

function normalizedDictationAnswerState(state = readDictationState(), item = currentDictationItem(state), taskSession = dictationTaskSession(state)) {
  const savedAnswer = taskSession?.answers?.[item?.id];
  const inputText = String(savedAnswer?.inputText ?? state.inputText ?? "");
  return {
    inputText,
    revealed: taskSession
      ? Boolean(savedAnswer && inputText.trim())
      : Boolean(state.revealed && inputText.trim())
  };
}

function dictationPracticeItems() {
  return dictationItems.filter(item => item.pos !== "短句" && !/\s/.test(item.text));
}

function wordEliminationPracticeItems() {
  return [...dictationPracticeItems(), ...topik102WordEliminationItems, ...completeMasteryWordEliminationItems];
}

function wordEliminationBatches() {
  const items = wordEliminationPracticeItems();
  return Array.from({ length: Math.ceil(items.length / 20) }, (_, index) => items.slice(index * 20, (index + 1) * 20));
}

function readWordEliminationState() {
  const fallback = {
    selectedWordId: "",
    selectedMeaningId: "",
    clearedIds: [],
    batchIndex: 0,
    mode: "batch",
    reviewIds: [],
    reviewedWeakIds: [],
    mistakeIds: [],
    completedBatchIds: [],
    roundsCompleted: 0
  };
  try {
    const saved = JSON.parse(localStorage.getItem(wordEliminationStorageKey) || "null") || {};
    const batches = wordEliminationBatches();
    return {
      ...fallback,
      ...saved,
      batchIndex: Math.max(0, Math.min(batches.length - 1, Number(saved.batchIndex) || 0)),
      mode: saved.mode === "review" ? "review" : "batch"
    };
  } catch {
    return fallback;
  }
}

function writeWordEliminationState(patch = {}) {
  const current = readWordEliminationState();
  const next = { ...current, ...patch };
  localStorage.setItem(wordEliminationStorageKey, JSON.stringify(next));
  return next;
}

function readExternalStudyRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(externalStudyStorageKey) || "[]");
    if (!Array.isArray(records)) return [];
    let repaired = false;
    const normalizedRecords = records.map(record => {
      const note = normalizeExternalStudyNote(record?.note || "");
      const parsedActivities = externalStudyActivitiesFromText(note);
      const parsedSeconds = parsedActivities.reduce((sum, activity) => sum + activity.actualSeconds, 0);
      const actualSeconds = parsedSeconds || Math.max(0, Number(record?.actualSeconds || 0));
      const parsedCategory = externalStudyRecordCategory(parsedActivities);
      const category = parsedCategory !== "other"
        ? parsedCategory
        : (record?.category && record.category !== "other" ? record.category : externalStudyCategory(note));
      const activities = parsedActivities.length ? parsedActivities : (Array.isArray(record?.activities) ? record.activities : []);
      const unchanged = note === record?.note
        && actualSeconds === Number(record?.actualSeconds || 0)
        && category === record?.category
        && JSON.stringify(activities) === JSON.stringify(record?.activities || []);
      if (unchanged) return record;
      repaired = true;
      return {
        ...record,
        note,
        actualSeconds,
        category,
        activities,
        planningImpact: actualSeconds
          ? `已重新识别并计入${externalStudyActivitySummary(activities, actualSeconds)}；当前任务会据此重新判断。`
          : record?.planningImpact
      };
    });
    if (repaired) localStorage.setItem(externalStudyStorageKey, JSON.stringify(normalizedRecords.slice(0, 100)));
    return normalizedRecords;
  } catch {
    return [];
  }
}

function writeExternalStudyRecords(records = []) {
  const safeRecords = Array.isArray(records) ? records.slice(0, 100) : [];
  localStorage.setItem(externalStudyStorageKey, JSON.stringify(safeRecords));
  return safeRecords;
}

function chineseStudyNumber(value = "") {
  const source = String(value || "").trim();
  if (/^\d+(?:\.\d+)?$/.test(source)) return Number(source);
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (source === "十") return 10;
  if (source.includes("十")) {
    const [tens, ones] = source.split("十");
    return (tens ? digits[tens] || 0 : 1) * 10 + (ones ? digits[ones] || 0 : 0);
  }
  return digits[source] || 0;
}

function normalizeExternalStudyNote(text = "") {
  return String(text || "")
    .replace(/(?:被|备)了(?=[^，。！？]{0,16}(?:单词|词汇|生词))/g, "背了")
    .replace(/\s+/g, " ")
    .trim();
}

function externalStudySecondsFromText(text = "") {
  return externalStudyActivitiesFromText(text).reduce((sum, activity) => sum + activity.actualSeconds, 0);
}

function externalStudyDurationMatches(text = "") {
  const source = String(text || "");
  const numberPattern = "(?:\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]+)";
  const patterns = [
    {
      regex: new RegExp(`(${numberPattern})\\s*个?\\s*半\\s*(小时|小時)`, "gi"),
      seconds: match => Math.round((chineseStudyNumber(match[1]) + 0.5) * 3600)
    },
    {
      regex: /半\s*个?\s*(小时|小時)/gi,
      seconds: () => 30 * 60
    },
    {
      regex: /一\s*刻\s*钟/gi,
      seconds: () => 15 * 60
    },
    {
      regex: new RegExp(`(${numberPattern})\\s*个?\\s*(小时|小時|h\\b|分钟|分鐘|分\\b|min\\b)`, "gi"),
      seconds: match => {
        const amount = chineseStudyNumber(match[1]);
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        return /小时|小時|h\b/i.test(match[2]) ? Math.round(amount * 3600) : Math.round(amount * 60);
      }
    }
  ];
  const matches = [];
  patterns.forEach(({ regex, seconds }) => {
    for (const match of source.matchAll(regex)) {
      const actualSeconds = seconds(match);
      if (!actualSeconds) continue;
      const start = match.index || 0;
      const end = start + match[0].length;
      if (matches.some(existing => start < existing.end && existing.start < end)) continue;
      matches.push({ start, end, actualSeconds });
    }
  });
  return matches.sort((first, second) => first.start - second.start);
}

function externalStudyActivitiesFromText(text = "") {
  const source = String(text || "");
  const durations = externalStudyDurationMatches(source);
  const categoryPatterns = [
    { category: "listening", regex: /听力|听写|듣기|listening/gi },
    { category: "reading", regex: /阅读|读题|읽기|reading/gi },
    { category: "vocab", regex: /单词|词汇|语法|生词|vocab|grammar/gi },
    { category: "writing", regex: /写作|作文|쓰기|writing/gi }
  ];
  const categoryMentions = categoryPatterns.flatMap(({ category, regex }) => [...source.matchAll(regex)].map(match => ({
    category,
    start: match.index || 0,
    end: (match.index || 0) + match[0].length
  })));
  const clauseBoundaries = [0];
  for (const match of source.matchAll(/[，,。；;！？!?\n]/g)) {
    clauseBoundaries.push((match.index || 0) + match[0].length);
  }
  clauseBoundaries.push(source.length + 1);
  return durations.map(duration => {
    const durationCenter = (duration.start + duration.end) / 2;
    const clauseStart = [...clauseBoundaries].reverse().find(boundary => boundary <= duration.start) || 0;
    const clauseEnd = clauseBoundaries.find(boundary => boundary > duration.end) || source.length + 1;
    const clauseMentions = categoryMentions.filter(mention => mention.start >= clauseStart && mention.end <= clauseEnd);
    const nearestCategory = (clauseMentions.length ? clauseMentions : categoryMentions)
      .map(mention => ({ ...mention, distance: Math.abs(((mention.start + mention.end) / 2) - durationCenter) }))
      .sort((first, second) => first.distance - second.distance)[0];
    return {
      category: nearestCategory?.category || "other",
      actualSeconds: duration.actualSeconds
    };
  });
}

function externalStudyCategory(text = "") {
  const source = String(text || "");
  if (/听力|听写|듣기|listening/i.test(source)) return "listening";
  if (/阅读|读题|읽기|reading/i.test(source)) return "reading";
  if (/单词|词汇|语法|vocab|grammar/i.test(source)) return "vocab";
  if (/写作|作文|쓰기|writing/i.test(source)) return "writing";
  return "other";
}

function externalStudyCategoryLabel(category = "other") {
  return ({
    listening: "听力",
    reading: "阅读",
    vocab: "词汇语法",
    writing: "写作",
    mixed: "多项学习"
  })[category] || "站外学习";
}

function externalStudyRecordCategory(activities = []) {
  const categories = [...new Set(activities.map(activity => activity.category).filter(category => category && category !== "other"))];
  if (categories.length > 1) return "mixed";
  return categories[0] || "other";
}

function externalStudyActivitySummary(activities = [], fallbackSeconds = 0) {
  const recognized = activities.filter(activity => activity.actualSeconds > 0);
  if (!recognized.length) return formatActualStudyTime(fallbackSeconds);
  const details = recognized.map(activity => `${externalStudyCategoryLabel(activity.category)}${formatActualStudyTime(activity.actualSeconds)}`);
  const total = recognized.reduce((sum, activity) => sum + activity.actualSeconds, 0);
  return recognized.length > 1 ? `${details.join("、")}，共${formatActualStudyTime(total)}` : details[0];
}

function todayExternalStudyByCategory(records = readExternalStudyRecords()) {
  const todayKey = beijingDateKey();
  return records.reduce((summary, record) => {
    if (!record.createdAt || beijingDateKey(new Date(record.createdAt)) !== todayKey) return summary;
    const activities = Array.isArray(record.activities) && record.activities.length
      ? record.activities
      : [{ category: record.category || "other", actualSeconds: record.actualSeconds || 0 }];
    activities.forEach(activity => {
      const category = String(activity.category || "other");
      summary[category] = (summary[category] || 0) + Math.max(0, Number(activity.actualSeconds || 0));
    });
    return summary;
  }, {});
}

function stableEliminationRank(value = "") {
  return [...String(value)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

function wordEliminationTiles(items = wordEliminationPracticeItems()) {
  return items
    .flatMap(item => ([
      { key: `word-${item.id}`, id: item.id, type: "word", label: item.text, language: "韩文" },
      { key: `meaning-${item.id}`, id: item.id, type: "meaning", label: item.zh, language: "中文" }
    ]))
    .sort((a, b) => stableEliminationRank(`v2-${a.key}`) - stableEliminationRank(`v2-${b.key}`));
}

function currentWordEliminationItems(state = readWordEliminationState()) {
  const pool = wordEliminationPracticeItems();
  if (state.mode === "review") {
    const reviewIds = new Set(state.reviewIds || []);
    return pool.filter(item => reviewIds.has(item.id));
  }
  return wordEliminationBatches()[state.batchIndex] || wordEliminationBatches()[0] || [];
}

function pendingWordEliminationReviewIds(state = readWordEliminationState()) {
  const poolIds = new Set(wordEliminationPracticeItems().map(item => item.id));
  const reviewedIds = new Set(state.reviewedWeakIds || []);
  const dictationWeakIds = readDictationState().weakIds || [];
  return [...new Set([...(state.mistakeIds || []), ...dictationWeakIds])]
    .filter(id => poolIds.has(id) && !reviewedIds.has(id));
}

function nextRegularWordEliminationBatchIndex(state = readWordEliminationState()) {
  const completedIds = new Set(state.completedBatchIds || []);
  const batches = wordEliminationBatches();
  return batches.findIndex((_, index) => index !== state.batchIndex && !completedIds.has(`batch-${index + 1}`));
}

function wordEliminationCompletionAction(state = readWordEliminationState()) {
  const completedIds = new Set(state.completedBatchIds || []);
  if (state.mode === "batch") completedIds.add(`batch-${state.batchIndex + 1}`);
  const normalizedState = { ...state, completedBatchIds: [...completedIds] };
  if (state.mode !== "review") {
    const reviewIds = pendingWordEliminationReviewIds(normalizedState);
    if (reviewIds.length) return { type: "review", ids: reviewIds, label: `先复习 ${reviewIds.length} 个不熟词` };
  }
  const nextIndex = nextRegularWordEliminationBatchIndex(normalizedState);
  if (nextIndex >= 0) return { type: "batch", batchIndex: nextIndex, label: "开始下一组" };
  return { type: "restart", batchIndex: 0, label: "从第一组重新巩固" };
}

function currentDictationItem(state = readDictationState()) {
  const items = dictationPracticeItems();
  const session = state.taskSession;
  if (session?.itemIds?.length) {
    const position = Math.max(0, Math.min(session.itemIds.length - 1, Number(session.currentPosition) || 0));
    return items.find(item => item.id === session.itemIds[position]) || items[0];
  }
  const index = Math.max(0, Math.min(items.length - 1, Number(state.index) || 0));
  return items[index] || items[0];
}

function dictationTaskSession(state = readDictationState()) {
  const session = state.taskSession;
  if (!session?.taskId || !Array.isArray(session.itemIds) || !session.itemIds.length) return null;
  const task = tasks.find(item => String(item.id) === String(session.taskId));
  if (!task || task.category !== "dictation" || hasPracticeRecord(task) || task.status === "cancelled") return null;
  return { ...session, task };
}

function dictationSessionState(session = {}) {
  const { task, ...serializable } = session;
  return serializable;
}

function dictationSessionSeconds(session = {}) {
  const startedAt = new Date(session.lastStartedAt || "").getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

function pauseDictationTaskSession({ refresh = true } = {}) {
  const state = readDictationState();
  const session = dictationTaskSession(state);
  if (!session?.lastStartedAt) return;
  const elapsed = dictationSessionSeconds(session);
  const task = session.task;
  task.status = Object.keys(session.answers || {}).length ? "partial" : "in_progress";
  task.checkin = {
    ...(task.checkin || {}),
    startedAt: task.checkin?.startedAt || session.startedAt,
    lastPausedAt: new Date().toISOString(),
    partialAnswered: Object.keys(session.answers || {}).length,
    partialCorrect: Object.values(session.answers || {}).filter(answer => answer.correct).length,
    actualSeconds: taskActualStudySeconds(task) + elapsed,
    planningImpact: Object.keys(session.answers || {}).length
      ? recordPartialPlanImpact(task, Object.keys(session.answers || {}).length, session.itemIds.length)
      : "听写已开始，系统已保存本次用时；再次进入可继续本组。"
  };
  writeDictationState({ taskSession: { ...dictationSessionState(session), lastStartedAt: "" } });
  if (refresh) persistTasksAndRefresh();
  else localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
}

function startDictationTask(task = {}) {
  if (!task?.id || task.category !== "dictation") return switchView("dictation");
  const state = readDictationState();
  const existing = dictationTaskSession(state);
  let session = existing && String(existing.taskId) === String(task.id) ? existing : null;
  if (!session) {
    const items = dictationPracticeItems();
    const requested = Math.min(items.length, recommendedQuestionCountForTask(task));
    const startIndex = Math.max(0, Math.min(items.length - 1, Number(state.index) || 0));
    const itemIds = Array.from({ length: requested }, (_, offset) => items[(startIndex + offset) % items.length].id);
    const startedAt = new Date().toISOString();
    session = { taskId: task.id, startedAt, lastStartedAt: startedAt, itemIds, currentPosition: 0, answers: {} };
  } else if (!session.lastStartedAt) {
    session = { ...session, lastStartedAt: new Date().toISOString() };
  }
  activeTaskId = task.id;
  task.status = Object.keys(session.answers || {}).length ? "partial" : "in_progress";
  task.checkin = {
    ...(task.checkin || {}),
    startedAt: task.checkin?.startedAt || session.startedAt
  };
  writeDictationState({ taskSession: dictationSessionState(session), revealed: false, inputText: "" });
  persistTasksAndRefresh();
  switchView("dictation");
}

function completeDictationTaskSession() {
  const state = readDictationState();
  const session = dictationTaskSession(state);
  if (!session) return;
  const answers = Object.values(session.answers || {});
  if (answers.length < session.itemIds.length) return showToast(`还剩 ${session.itemIds.length - answers.length} 个词未核对`);
  const task = session.task;
  const completedAt = new Date().toISOString();
  const correct = answers.filter(answer => answer.correct).length;
  const total = session.itemIds.length;
  const wrongCount = total - correct;
  const weakWordIds = session.itemIds.filter(id => (state.weakIds || []).includes(id));
  const knownWordIds = session.itemIds.filter(id => (state.knownIds || []).includes(id));
  task.status = "completed";
  task.checkin = {
    ...(task.checkin || {}),
    correct,
    total,
    note: wrongCount
      ? `AI自动记录：${wrongCount} 个词听写错误，${weakWordIds.length} 个保留在不熟词复习。`
      : "AI自动记录：本组听写全部正确。",
    source: "听写模块自动统计",
    startedAt: task.checkin?.startedAt || session.startedAt,
    completedAt,
    updatedAt: completedAt,
    actualSeconds: taskActualStudySeconds(task) + dictationSessionSeconds(session),
    weakWordIds,
    knownWordIds
  };
  applyPracticeResultToPlan(task, { correct, total });
  writeDictationState({
    taskSession: null,
    revealed: false,
    inputText: "",
    index: Math.max(0, dictationPracticeItems().findIndex(item => item.id === session.itemIds.at(-1)))
  });
  activeTaskId = null;
  persistTasksAndRefresh();
  recordCheckinReward(task);
  switchView("calendar");
  showToast(`听写已完成：${correct} / ${total} 个正确，保留 ${weakWordIds.length} 个不熟词`);
}

function normalizeDictationAnswer(value = "") {
  return String(value)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?！？。、“”‘’'"()[\]{}·…~\-—_\s]/g, "");
}

function isDictationAnswerCorrect(input = "", answer = "") {
  return Boolean(input.trim()) && normalizeDictationAnswer(input) === normalizeDictationAnswer(answer);
}

function selectedStudyTokens(settings = {}, fallbackTokens = []) {
  const selected = [...new Set((settings.weak || []).map(item => weakTokenMap[item]).filter(Boolean))];
  return selected.length ? selected : fallbackTokens;
}

function userSelectedStudyTokens(settings = {}) {
  return [...new Set((settings.weak || []).map(item => weakTokenMap[item]).filter(Boolean).map(normalizeStudyCategory))];
}

function normalizeStudyCategory(token) {
  return token === "grammar" ? "vocab" : token;
}

function categoryLabel(category) {
  return categoryMeta[normalizeStudyCategory(category)]?.label || "练习";
}

function taskWrongCount(task = {}) {
  return Math.max(0, Number(task.checkin?.total || 0) - Number(task.checkin?.correct || 0));
}

function studyPerformanceProfile(records = completedPracticeTasks()) {
  const stats = {};
  records.forEach(task => {
    const category = normalizeStudyCategory(task.category);
    if (["review", "consolidation", "mock"].includes(category)) return;
    stats[category] ||= { category, total: 0, correct: 0, wrong: 0 };
    stats[category].total += Number(task.checkin?.total || 0);
    stats[category].correct += Number(task.checkin?.correct || 0);
    stats[category].wrong += taskWrongCount(task);
  });
  const weak = Object.values(stats)
    .filter(item => item.total > 0)
    .sort((a, b) => {
      const accuracyDiff = (a.correct / a.total) - (b.correct / b.total);
      if (accuracyDiff !== 0) return accuracyDiff;
      return b.wrong - a.wrong;
    })[0] || null;
  const today = beijingDateKey();
  const todayWrongTask = [...records].reverse().find(task =>
    taskWrongCount(task) > 0 &&
    task.checkin?.updatedAt &&
    beijingDateKey(new Date(task.checkin.updatedAt)) === today
  ) || null;
  return {
    records,
    weakCategory: weak?.category || "",
    weakAccuracy: weak ? Math.round((weak.correct / weak.total) * 100) : null,
    weakWrong: weak?.wrong || 0,
    todayWrongTask
  };
}

function prioritizedStudyTokens(tokens = [], profile = studyPerformanceProfile()) {
  const normalized = [...new Set(tokens.map(normalizeStudyCategory))];
  if (!profile.weakCategory || !normalized.includes(profile.weakCategory)) return normalized;
  // Keep one extra occurrence for the weakest category so real answer data
  // increases its weekly frequency instead of only moving it to the front.
  return [profile.weakCategory, ...normalized];
}

function defaultStudyTokens(settings = {}) {
  if (settings.exam === "IELTS") return ["listening", "reading", "writing", "speaking"];
  if (settings.exam === "OTHER") return ["reading", "vocab", "writing"];
  if (settings.level === "II") return ["listening", "reading", "writing"];
  return ["listening", "reading"];
}

function hasActualReviewNeed() {
  return errorItems.some(item => String(item.id || "").startsWith("practice-") || String(item.id || "").startsWith("imported-"));
}

function taskMentionsUnselectedScope(task = {}, selectedTokens = []) {
  if (!selectedTokens.length) return false;
  const selected = new Set(selectedTokens.map(normalizeStudyCategory));
  const text = `${task.title || ""} ${task.note || ""} ${(task.standards || []).join(" ")}`;
  const moduleKeywords = {
    listening: /听力|听懂|听人|听下一步|听原因|听数字|听内容|듣기/i,
    reading: /阅读|公告|广告|短文|图表|信息读取|읽기/i,
    vocab: /词汇|语法|助词|语尾|单词|grammar|vocab/i,
    writing: /写作|作文|句子补全|短文逻辑|图表说明|议论文|쓰기/i,
    speaking: /口语|说话|speaking/i
  };
  return Object.entries(moduleKeywords).some(([token, matcher]) => !selected.has(token) && matcher.test(text));
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

function scopedStudyTokens(settings = readStudySettings()) {
  const defaults = defaultStudyTokens(settings);
  const explicit = userSelectedStudyTokens(settings);
  return [...new Set((explicit.length ? explicit : selectedStudyTokens(settings, defaults)).map(normalizeStudyCategory))];
}

function allowedTaskCategories(settings = readStudySettings(), hasReviewNeed = hasActualReviewNeed()) {
  const tokens = scopedStudyTokens(settings);
  return new Set([
    ...tokens,
    ...(hasReviewNeed ? ["consolidation", "review"] : [])
  ]);
}

function constrainTasksToStudyScope(sourceTasks = [], settings = readStudySettings(), hasReviewNeed = hasActualReviewNeed()) {
  const scopedTokens = scopedStudyTokens(settings);
  const allowedCategories = allowedTaskCategories(settings, hasReviewNeed);
  const cleaned = (sourceTasks || []).filter(task => {
    const category = normalizeStudyCategory(task.category);
    if (!allowedCategories.has(category)) return false;
    if (taskMentionsUnselectedScope(task, scopedTokens)) return false;
    return true;
  }).map(task => ({ ...task, weekIndex: taskWeekIndex(task), category: normalizeStudyCategory(task.category) }));
  if (cleaned.length) return cleaned;
  const fallbackTasks = generatePlanFromSettings(settings);
  return (fallbackTasks || []).filter(task => {
    const category = normalizeStudyCategory(task.category);
    if (!allowedCategories.has(category)) return false;
    if (taskMentionsUnselectedScope(task, scopedTokens)) return false;
    return true;
  }).map(task => ({ ...task, weekIndex: taskWeekIndex(task), category: normalizeStudyCategory(task.category) }));
}

function syncTasksToStudyScope(settings = readStudySettings()) {
  const hasUserPlan = Boolean(
    localStorage.getItem("topikPrototypeSettings") || localStorage.getItem("topikPrototypeOnboarded")
  );
  if (!hasUserPlan) {
    if (!tasks.length) return false;
    tasks = [];
    localStorage.setItem("topikPrototypeTasks", "[]");
    return true;
  }
  const scopedTasks = constrainTasksToStudyScope(tasks, settings);
  if (JSON.stringify(scopedTasks) === JSON.stringify(tasks)) {
    writePlanScope(settings);
    return false;
  }
  tasks = scopedTasks;
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  writePlanScope(settings);
  return true;
}

function planScopeSignature(settings = readStudySettings()) {
  const weak = scopedStudyTokens(settings);
  const studyDays = Array.isArray(settings.studyDays) ? [...settings.studyDays].sort() : [];
  return JSON.stringify({
    exam: settings.exam || "TOPIK",
    level: settings.level || "I",
    targetGrade: settings.targetGrade || "",
    intensity: settings.intensity || "",
    weak,
    studyDays,
    availableStart: settings.availableStart || "",
    availableEnd: settings.availableEnd || "",
    firstRoundWeeks: Number(settings.firstRoundWeeks || 0),
    planStartDate: settings.planStartDate || ""
  });
}

function writePlanScope(settings = readStudySettings()) {
  localStorage.setItem("topikPrototypePlanScope", planScopeSignature(settings));
}

function savedPlanScopeMatches(settings = readStudySettings()) {
  return localStorage.getItem("topikPrototypePlanScope") === planScopeSignature(settings);
}

function readStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null");
  } catch {
    return null;
  }
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
  return 45;
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
  const windows = preferredStudyWindows(settings, blockMinutes);
  const candidates = [];
  windows.forEach(window => {
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
  const weakTokens = scopedStudyTokens(settings);
  const templateSource = exam === "IELTS" ? ieltsTemplates : (exam === "OTHER" ? genericTemplates : studyTemplates);
  const rotation = prioritizedStudyTokens(weakTokens);
  const foundationOffset = { "入门": 0, "一般": 1, "较好": 2, "不确定": 0 }[settings.foundation] || 0;
  let sequence = 0;
  const categoryCounts = {};
  const generated = [];

  const selectedDayKeys = settings.studyDays?.length ? new Set(settings.studyDays) : new Set(baseDays.map(day => day.key));
  const weekCount = Math.max(1, Math.min(24, Number(settings.firstRoundWeeks || 1)));
  const todayKey = beijingDayKey();
  const todayIndex = Math.max(0, baseDays.findIndex(day => day.key === todayKey));
  const currentWeekStartKey = beijingDateKey(buildCurrentWeekDays()[0].fullDate);
  const firstWeekIsCurrent = !settings.planStartDate || settings.planStartDate === currentWeekStartKey;
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    baseDays.filter((day, dayIndex) => selectedDayKeys.has(day.key) && (weekIndex > 0 || !firstWeekIsCurrent || dayIndex >= todayIndex)).forEach(day => {
      const dayIndex = baseDays.findIndex(item => item.key === day.key);
      const globalDayIndex = weekIndex * baseDays.length + dayIndex;
      const starts = dailyStudyStarts(settings, blocksPerDay, blockMinutes, globalDayIndex);
      starts.forEach((start, blockIndex) => {
      // Move each module to a different study window on the next day.
      // Advancing by blocksPerDay repeats the same slot whenever the number
      // of daily blocks equals the number of selected modules.
      let token = rotation[(globalDayIndex + blockIndex) % rotation.length];
      const category = normalizeStudyCategory(token);
      const templates = exam === "IELTS" && level === "II" && token === "writing"
        ? ieltsGeneralWriting
        : token === "consolidation"
          ? scopedConsolidationTemplates(weakTokens)
          : (templateSource[token] || studyTemplates[token]);
      const categoryIndex = categoryCounts[category] || 0;
      categoryCounts[category] = categoryIndex + 1;
      const template = templates[(categoryIndex + foundationOffset) % templates.length];
      const templateCycle = Math.floor((categoryIndex + foundationOffset) / templates.length);
      const cycleLabel = templateCycle ? ["复测", "强化", "迁移"][Math.min(templateCycle - 1, 2)] : "";
      generated.push({
        id: 1000 + sequence,
        weekIndex,
        day: day.key,
        start: minutesToClock(start),
        end: minutesToClock(start + blockMinutes),
        category,
        displayIndex: categoryIndex,
        title: cycleLabel ? `${template[0]} · ${cycleLabel}` : template[0],
        note: `${settings.studyContent ? `${settings.studyContent.slice(0, 22)} · ` : ""}${template[1]}${weakTokens.map(normalizeStudyCategory).includes(category) ? " · 薄弱项加练" : ""}`,
        status: "planned",
        standards: completionStandards[category] || completionStandards.vocab
      });
      sequence += 1;
      });
    });
  }
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
    <div><label class="import-include"><input type="checkbox" data-import-include="${index}" checked />导入这题</label><span class="tiny-label">${escapeImportText(item.section || "其他")}</span><span class="confidence ${item.confidence === "high" ? "high" : "low"}">${item.confidence === "high" ? "识别清晰" : "需要确认"}</span></div>
    <label>题目
      <textarea rows="2" data-import-field="question" data-import-index="${index}" placeholder="请补全当前题目">${escapeImportText(item.question || item.title || "")}</textarea>
    </label>
    ${Array.isArray(item.options) && item.options.length ? `<ol class="import-options">${item.options.map((option, optionIndex) => `<li><b>${answerLetter(optionIndex)}.</b>${escapeImportText(option)}</li>`).join("")}</ol>` : ""}
    <div class="import-answer-fields">
      <label>你的答案<input data-import-field="userAnswer" data-import-index="${index}" value="${escapeImportText(item.userAnswer || "")}" placeholder="看不清可留空" /></label>
      <label>正确答案<input data-import-field="correctAnswer" data-import-index="${index}" value="${escapeImportText(item.correctAnswer || "")}" placeholder="不确定可留空" /></label>
    </div>
    <label>你当时为什么会错？
      <select class="import-reason" data-import-reason="${index}"><option>不理解知识点</option><option>凭熟悉感猜答案</option><option>看漏关键信息</option><option>不记得</option></select>
    </label>
  </article>`).join("")}<p class="prototype-note">${escapeImportText(result?.summary || "请确认识别结果后再导入错题集。识别不清的内容不会自动补猜。")}</p>`;
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
const realMaterialQuestionBank = [
  {
    id: "topik-ii-listening-102-pictures-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：看图与图表理解",
    skillLabel: "看图与图表理解",
    matchTerms: ["看图听关键词", "看图与图表理解"],
    trainingPoint: "先听音频，再根据场景动作、人物关系和图表数据选择最符合的一项",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "1-3题 · 图片/图表选择样本",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q001",
        materialImage: "assets/materials/topik102-listening/question/q001.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-01.mp3",
        stem: "다음을 듣고 가장 알맞은 그림 또는 그래프를 고르십시오.",
        stemZh: "听音频，选择最符合内容的图画或图表。",
        options: ["그림 ①", "그림 ②", "그림 ③", "그림 ④"],
        optionTranslations: ["图1", "图2", "图3", "图4"],
        answer: 1,
        answerZh: "图2",
        transcript: "남자: 이 책을 소포로 보내고 싶은데요. 소포 상자 살 수 있지요? 여자: 네. 손님, 상자는 이쪽에서 고르시면 돼요. 남자: 네, 한번 볼게요.",
        transcriptZh: "男：我想把这本书寄包裹。可以买包裹箱吧？女：可以，客人，箱子在这边选就行。男：好，我看一下。",
        explanation: "남자는 책을 소포로 보내려고 하고, 여자는 상자를 고르라고 안내합니다.",
        explanationZh: "音频里男生想寄书，需要买包裹箱；女生指引他去选择箱子。图2最符合“在邮局柜台前选包裹箱”的场景。",
        source: "第102届 TOPIK II 听力 1题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q002",
        materialImage: "assets/materials/topik102-listening/question/q002.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-02.mp3",
        stem: "다음을 듣고 가장 알맞은 그림 또는 그래프를 고르십시오.",
        stemZh: "听音频，选择最符合内容的图画或图表。",
        options: ["그림 ①", "그림 ②", "그림 ③", "그림 ④"],
        optionTranslations: ["图1", "图2", "图3", "图4"],
        answer: 0,
        answerZh: "图1",
        transcript: "여자: 어, 낚싯대가 움직인다. 물고기 잡은 것 같아. 남자: 그래? 낚싯대 잘 잡고 천천히 당겨서 올려 봐. 여자: 응. 그런데 진짜 무겁다.",
        transcriptZh: "女：啊，鱼竿在动。好像钓到鱼了。男：是吗？把鱼竿抓稳，慢慢拉上来看看。女：嗯，可是真的很重。",
        explanation: "여자는 낚싯대가 움직인다고 말하고, 남자는 낚싯대를 잡고 천천히 당기라고 합니다.",
        explanationZh: "对话中女生正在钓鱼，鱼竿动了，男生让她抓稳鱼竿慢慢拉上来。图1最符合“女生正在拉鱼竿，男生在旁边指导”的场景。",
        source: "第102届 TOPIK II 听力 2题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q003",
        materialImage: "assets/materials/topik102-listening/question/q003.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-03.mp3",
        stem: "다음을 듣고 가장 알맞은 그림 또는 그래프를 고르십시오.",
        stemZh: "听音频，选择最符合内容的图画或图表。",
        options: ["그래프 ①", "그래프 ②", "그래프 ③", "그래프 ④"],
        optionTranslations: ["图表1", "图表2", "图表3", "图表4"],
        answer: 2,
        answerZh: "图表3",
        transcript: "남자: 안전한 먹거리에 대한 소비자들의 관심이 높아지면서 최근 1년간 친환경 농산물을 구매한 적이 있다는 응답이 76%로 나타났습니다. 친환경 농산물 구매 이유로는 '건강을 위해서'가 1위를 차지했으며, '환경 보호를 위해서', '품질이 좋아서'가 그 뒤를 이었습니다.",
        transcriptZh: "男：随着消费者对安全食品的关注提高，调查显示最近一年购买过环保农产品的回答占76%。购买环保农产品的理由中，“为了健康”排第一，其后是“为了保护环境”和“因为品质好”。",
        explanation: "구매 경험은 있다는 응답이 76%이고, 구매 이유는 건강, 환경 보호, 품질 순서입니다.",
        explanationZh: "音频说最近一年买过环保农产品的人占76%，并且购买理由排序是：为了健康、为了保护环境、因为品质好。图表3同时符合这两个关键信息。",
        source: "第102届 TOPIK II 听力 3题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-dialogue-actions-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：对话续句与下一步行动",
    skillLabel: "对话续句与下一步行动",
    matchTerms: ["听力 · 判断下一步行动"],
    trainingPoint: "听清对话中的请求、建议和行动线索，判断最自然的续句或女生下一步行动",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "4-12、23题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q004",
        materialImage: "assets/materials/topik102-listening/question/q004.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-04.mp3",
        stem: "다음을 듣고 이어질 수 있는 말로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最自然的下一句话。",
        options: ["카페를 찾고 있어.", "같이 들어가 보자.", "벌써 만난 것 같아.", "차를 마시기로 했어."],
        optionTranslations: ["我正在找咖啡馆。", "一起进去看看吧。", "好像已经见过了。", "已经决定喝茶了。"],
        answer: 1,
        answerZh: "一起进去看看吧。",
        transcript: "남자: 우리 차 한잔할까? 저 카페 어때? 여자: 그래. 분위기 좋아 보인다.",
        transcriptZh: "男：我们喝杯茶吗？那家咖啡馆怎么样？女：好啊，看起来氛围不错。",
        explanation: "두 사람이 카페 분위기가 좋다고 했으므로 같이 들어가 보자는 말이 자연스럽습니다.",
        explanationZh: "两人都认可这家咖啡馆，所以下一句最自然的是“一起进去看看吧”。",
        source: "第102届 TOPIK II 听力 4题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q005",
        materialImage: "assets/materials/topik102-listening/question/q005.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-05.mp3",
        stem: "다음을 듣고 이어질 수 있는 말로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最自然的下一句话。",
        options: ["신발장에서 꺼내 줄게.", "이게 네 운동화였구나.", "하얀색 신발이면 좋겠어.", "아까 찾을 때는 없었는데."],
        optionTranslations: ["我从鞋柜里拿给你。", "原来这是你的运动鞋。", "如果是白色鞋子就好了。", "刚才找的时候还没有呢。"],
        answer: 3,
        answerZh: "刚才找的时候还没有呢。",
        transcript: "여자: 민수야, 내 하얀색 운동화 못 봤어? 아무리 찾아도 안 보여. 남자: 그거 신발장 위쪽에 있던데.",
        transcriptZh: "女：民秀，你看到我的白色运动鞋了吗？怎么找也找不到。男：那个在鞋柜上面呢。",
        explanation: "여자는 이미 운동화를 찾았지만 못 봤다고 했으므로 아까는 없었다는 반응이 자연스럽습니다.",
        explanationZh: "女生刚才一直没找到，男生却说鞋在鞋柜上面，因此“刚才找的时候还没有呢”最符合语境。",
        source: "第102届 TOPIK II 听力 5题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q006",
        materialImage: "assets/materials/topik102-listening/question/q006.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-06.mp3",
        stem: "다음을 듣고 이어질 수 있는 말로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最自然的下一句话。",
        options: ["그럼 관심이 없는 거네요.", "아르바이트 경험이 다양해요.", "그럼 사무실에 한번 가 보세요.", "좋은 곳을 구했다니 다행이에요."],
        optionTranslations: ["那就是没有兴趣了。", "兼职经验很丰富。", "那去办公室看看吧。", "找到好地方真是太好了。"],
        answer: 2,
        answerZh: "那去办公室看看吧。",
        transcript: "남자: 학과 사무실에서 아르바이트할 사람을 찾던데 혹시 관심 있어요? 여자: 네. 그렇지 않아도 아르바이트를 하고 싶어서 알아보고 있었어요.",
        transcriptZh: "男：系办公室正在找兼职的人，你有兴趣吗？女：有。我正好也想做兼职，一直在找。",
        explanation: "여자가 아르바이트에 관심이 있다고 했으므로 사무실에 가 보라는 제안이 자연스럽습니다.",
        explanationZh: "女生明确说自己正在找兼职，因此建议她去系办公室了解最自然。",
        source: "第102届 TOPIK II 听力 6题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q007",
        materialImage: "assets/materials/topik102-listening/question/q007.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-07.mp3",
        stem: "다음을 듣고 이어질 수 있는 말로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最自然的下一句话。",
        options: ["곧 개봉할 예정이래.", "올해는 작품상을 받을 거야.", "영화감독이 되려고 준비한대.", "요즘 영화는 소재가 다 비슷해."],
        optionTranslations: ["听说马上就要上映了。", "今年会获得作品奖。", "听说正在准备当电影导演。", "最近电影的题材都差不多。"],
        answer: 0,
        answerZh: "听说马上就要上映了。",
        transcript: "여자: 김민수 감독 영화가 유명한 국제 영화제에서 작품상을 받았대. 남자: 맞아. 소재도 참신하고 재미있다던데 국내에선 언제쯤 볼 수 있을까?",
        transcriptZh: "女：听说金民秀导演的电影在著名国际电影节获得了作品奖。男：是啊，听说题材新颖又有趣，在国内什么时候能看到呢？",
        explanation: "남자가 국내 상영 시기를 물었으므로 곧 개봉할 예정이라는 답이 자연스럽습니다.",
        explanationZh: "男生问的是国内什么时候能看到，所以回答“马上要上映了”直接对应。",
        source: "第102届 TOPIK II 听力 7题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q008",
        materialImage: "assets/materials/topik102-listening/question/q008.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-08.mp3",
        stem: "다음을 듣고 이어질 수 있는 말로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最自然的下一句话。",
        options: ["네, 받으실 주소를 말씀해 주세요.", "네, 카드를 신청하시는 분이 많네요.", "네, 언제 받으셨는지 확인해 볼게요.", "네, 재발급 신청서를 작성하시면 돼요."],
        optionTranslations: ["好的，请告诉我收件地址。", "好的，申请卡的人很多呢。", "好的，我确认一下您什么时候收到的。", "好的，填写补发申请表即可。"],
        answer: 0,
        answerZh: "好的，请告诉我收件地址。",
        transcript: "남자: 고객님, 오늘 재발급 신청하신 카드는 직접 받으셔야 합니다. 여자: 그러면 직장으로 배송해 주시겠어요?",
        transcriptZh: "男：顾客，您今天申请补发的卡需要本人签收。女：那么可以配送到我的单位吗？",
        explanation: "여자가 직장 배송을 요청했으므로 받을 주소를 묻는 답이 자연스럽습니다.",
        explanationZh: "女生请求寄到单位，工作人员下一步应确认收件地址。",
        source: "第102届 TOPIK II 听力 8题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q009",
        materialImage: "assets/materials/topik102-listening/question/q009.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-09.mp3",
        stem: "다음을 듣고 여자가 이어서 할 행동으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择女生接下来最可能做的事。",
        options: ["물을 마신다.", "의자에 앉는다.", "놀이기구를 탄다.", "음료수를 사러 간다."],
        optionTranslations: ["喝水。", "坐在椅子上。", "乘坐游乐设施。", "去买饮料。"],
        answer: 3,
        answerZh: "去买饮料。",
        transcript: "여자: 놀이기구는 많이 탔으니까 이제 잠깐 쉬는 게 어때? 남자: 좋아. 다리도 아프니까 시원한 거 마시면서 좀 쉬자. 여자: 그래. 음료수는 내가 사 올 테니까 너는 여기 잠깐 앉아 있어. 남자: 고마워. 나는 물 한 병만 부탁해.",
        transcriptZh: "女：游乐设施已经坐了很多了，现在休息一下怎么样？男：好，腿也疼，喝点凉的休息吧。女：好，我去买饮料，你先坐在这里。男：谢谢，给我一瓶水就好。",
        explanation: "여자가 음료수를 사 오겠다고 했으므로 이어서 음료수를 사러 갑니다.",
        explanationZh: "女生明确说自己去买饮料，所以她的下一步行动是去买饮料。",
        source: "第102届 TOPIK II 听力 9题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q010",
        materialImage: "assets/materials/topik102-listening/question/q010.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-10.mp3",
        stem: "다음을 듣고 여자가 이어서 할 행동으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择女生接下来最可能做的事。",
        options: ["창고에 간다.", "다른 옷을 구경한다.", "티셔츠를 입어 본다.", "직원에게 영수증을 받는다."],
        optionTranslations: ["去仓库。", "看其他衣服。", "试穿T恤。", "向店员拿收据。"],
        answer: 1,
        answerZh: "看其他衣服。",
        transcript: "여자: 이 티셔츠, 여기서 샀는데 교환하려고요. 입어 보니까 좀 작네요. 남자: 영수증 주시고요. 잠깐 기다리시면 한 사이즈 큰 걸로 갖다드릴게요. 여자: 네, 영수증 여기 있어요. 저는 다른 옷들도 좀 볼게요. 남자: 네, 금방 창고에 다녀오겠습니다. 천천히 보고 계세요.",
        transcriptZh: "女：这件T恤是在这里买的，我想换一下，穿上后有点小。男：请给我收据，稍等，我拿大一码的来。女：好，收据在这里。我看看其他衣服。男：好，我马上去仓库，您慢慢看。",
        explanation: "여자가 다른 옷들도 보겠다고 했으므로 이어서 다른 옷을 구경합니다.",
        explanationZh: "女生说等待时会看看其他衣服，所以她的下一步行动是浏览其他衣服。",
        source: "第102届 TOPIK II 听力 10题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q011",
        materialImage: "assets/materials/topik102-listening/question/q011.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-11.mp3",
        stem: "다음을 듣고 여자가 이어서 할 행동으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择女生接下来最可能做的事。",
        options: ["수업에 들어간다.", "발표 자료를 복사한다.", "복사기의 전원을 켠다.", "복사기에 종이를 넣는다."],
        optionTranslations: ["进入课堂。", "复印发表资料。", "打开复印机电源。", "往复印机里放纸。"],
        answer: 3,
        answerZh: "往复印机里放纸。",
        transcript: "여자: 민수야, 발표 자료 다 복사했어? 이제 수업 들어가야 하는데. 남자: 벌써 시간이 그렇게 됐어? 복사기가 고장 났나 봐. 복사가 안 돼. 여자: 아, 종이가 없네. 내가 종이 넣어 줄게. 남자: 그렇구나. 전원을 껐다 켰는데도 안 되더라고.",
        transcriptZh: "女：民秀，发表资料都复印好了吗？现在要进教室了。男：已经这么晚了吗？复印机好像坏了，不能复印。女：啊，是没纸了。我来放纸。男：原来如此，我还把电源关了又开也不行。",
        explanation: "여자가 복사기에 종이를 넣어 주겠다고 했으므로 이어서 종이를 넣습니다.",
        explanationZh: "女生发现复印机没纸，并说自己来放纸，所以她的下一步行动是往复印机里放纸。",
        source: "第102届 TOPIK II 听力 11题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q012",
        materialImage: "assets/materials/topik102-listening/question/q012.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-12.mp3",
        stem: "다음을 듣고 여자가 이어서 할 행동으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择女生接下来最可能做的事。",
        options: ["명함의 연락처로 연락한다.", "워크숍 장소를 예약한다.", "부장님을 만나러 간다.", "강사의 명함을 준다."],
        optionTranslations: ["按名片上的联系方式联系。", "预约研讨会场地。", "去见部长。", "把讲师的名片交出去。"],
        answer: 0,
        answerZh: "按名片上的联系方式联系。",
        transcript: "남자: 김 대리, 신입 사원 워크숍 준비는 어떻게 되고 있어요? 여자: 장소 예약은 완료했고 부장님께 사회도 부탁드렸습니다. 그런데 특강해 주실 분을 아직 못 찾았습니다. 남자: 그럼 특강 강사로 이분께 한번 연락해 보세요. 여기 명함 있어요. 여자: 네, 가능하신지 지금 확인해 보겠습니다.",
        transcriptZh: "男：金代理，新员工研讨会准备得怎么样？女：场地已经订好，也请部长主持了，但还没找到做特讲的人。男：那联系这位看看吧，这是名片。女：好，我现在确认他是否有时间。",
        explanation: "여자가 명함을 받고 지금 가능 여부를 확인하겠다고 했으므로 명함의 연락처로 연락합니다.",
        explanationZh: "女生接过名片并说现在确认是否可以，所以她的下一步行动是按名片上的联系方式联系。",
        source: "第102届 TOPIK II 听力 12题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q023",
        materialImage: "assets/materials/topik102-listening/question/q023.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-23.mp3",
        stem: "남자는 무엇을 하고 있는지 고르십시오.",
        stemZh: "听对话，选择最能概括男方正在做什么的一项。",
        options: ["체육 대회 용품의 대여 일정을 변경하고 있다.", "체육 대회 용품 대여의 자격과 기간을 문의하고 있다.", "대여 가능한 체육 대회 용품의 종류를 알아보고 있다.", "대여한 체육 대회 용품의 반납 장소를 확인하고 있다."],
        optionTranslations: ["正在更改体育大会用品租借日程。", "正在咨询体育大会用品的租借资格和期限。", "正在了解可以租借的体育大会用品种类。", "正在确认已租用品的归还地点。"],
        answer: 1,
        answerZh: "正在咨询体育大会用品的租借资格和期限。",
        transcript: "남자: 시청이죠? 체육 대회 용품을 빌릴 수 있다고 해서 연락드렸습니다. 회사나 학교에서 주로 빌리는 것 같던데 동호회도 대여가 가능한가요? 여자: 그럼요. 대여하시는 분이 인주시 시민이면 됩니다. 전화로 먼저 예약하신 후에 받으러 오실 때 신분증 가지고 오시면 돼요. 남자: 네, 알겠습니다. 저희가 이번 주 금요일쯤 빌리려고 하는데요. 금요일에 빌리면 반납은 언제까지 하면 될까요? 여자: 일주일 안에만 반납하시면 됩니다. 반납은 다른 분이 하셔도 되고요.",
        transcriptZh: "男：这里是市政府吧？听说可以借体育大会用品，所以打电话咨询。好像主要是公司或学校借，社团也可以租借吗？女：当然。借用人只要是仁州市市民就可以。先电话预约，来领取时带身份证即可。男：好的。我们打算本周五左右借，如果周五借，最晚什么时候归还？女：一周内归还即可，也可以由其他人代还。",
        explanation: "남자는 동호회도 대여할 수 있는지 먼저 묻고, 금요일에 빌리면 언제까지 반납해야 하는지도 묻고 있습니다.",
        explanationZh: "男方先问社团是否有租借资格，再询问周五借出后的归还期限，因此是在咨询租借资格和期限。",
        source: "第102届 TOPIK II 听力 23题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-content-match-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：听内容一致",
    skillLabel: "听内容一致",
    matchTerms: ["听内容一致"],
    trainingPoint: "逐项核对人物、时间、行动和条件，选择与原文一致的一项",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "13-16、22、24、26、28、30、34、36、38、40、42、44、45、47题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q013",
        materialImage: "assets/materials/topik102-listening/question/q013.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-13.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听对话，选择与原文内容一致的一项。",
        options: ["남자는 택배를 주문하지 않았다.", "여자는 택배 도착 문자를 받지 못했다.", "여자가 주문한 택배는 동아리 방에 있다.", "남자는 여자와 함께 관리실에 갈 것이다."],
        optionTranslations: ["男生没有订快递。", "女生没有收到快递送达短信。", "女生订的快递在社团活动室。", "男生会和女生一起去管理室。"],
        answer: 3,
        answerZh: "男生会和女生一起去管理室。",
        transcript: "여자: 동아리 방으로 주문한 택배, 왔다는 문자는 받았는데 안 보이네. 남자: 택배는 이제 일 층 관리실에서 찾는 걸로 바뀌었어. 여자: 그래? 그럼 지금 관리실에 가 봐야겠다. 남자: 같이 가. 나도 택배 시킨 거 있어.",
        transcriptZh: "女：订到社团活动室的快递，收到了送达短信，但没看到。男：现在改成去一楼管理室取快递了。女：是吗？那我现在去管理室看看。男：一起去吧，我也订了快递。",
        explanation: "남자가 여자에게 같이 관리실에 가자고 했으므로 ④가 들은 내용과 같습니다.",
        explanationZh: "男生最后明确说“一起去吧”，所以“男生会和女生一起去管理室”与原文一致。",
        source: "第102届 TOPIK II 听力 13题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q014",
        materialImage: "assets/materials/topik102-listening/question/q014.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-14.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听广播，选择与原文内容一致的一项。",
        options: ["입장권 문의는 온라인으로 할 수 있다.", "구입한 입장권은 환불이 불가능하다.", "내일 경기는 오전에 열릴 예정이다.", "비가 그쳐 경기가 다시 시작되었다."],
        optionTranslations: ["可以在线咨询门票。", "购买的门票不能退款。", "明天的比赛预计上午举行。", "雨停后比赛重新开始了。"],
        answer: 0,
        answerZh: "可以在线咨询门票。",
        transcript: "여자: 이주 야구장을 찾아 주신 관중 여러분, 갑자기 내리는 비로 오늘 경기는 더 이상 진행이 어렵습니다. 경기는 내일 오후 두 시에 다시 열릴 예정이며 구입하신 입장권은 내일 그대로 사용하시거나 환불 받으실 수 있습니다. 입장권 관련 문의는 홈페이지나 야구장 내 안내소를 이용해 주십시오.",
        transcriptZh: "女：各位来到李州棒球场的观众，由于突降大雨，今天的比赛无法继续。比赛预计明天下午两点重新举行，已购买的门票明天可以继续使用，也可以退款。门票相关咨询请使用官网或球场内服务台。",
        explanation: "입장권 문의는 홈페이지에서도 할 수 있다고 했으므로 ①이 맞습니다.",
        explanationZh: "广播说明门票问题可通过官网或球场服务台咨询，所以“可以在线咨询门票”正确。",
        source: "第102届 TOPIK II 听力 14题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q015",
        materialImage: "assets/materials/topik102-listening/question/q015.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-15.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听说明，选择与原文内容一致的一项。",
        options: ["정부는 이 교통 카드를 지난달에 출시했다.", "실물 카드와 모바일 카드 중 선택할 수 있다.", "수익금의 일부가 기후 관련 단체로 전달된다.", "공공 자전거 요금 할인은 포함되어 있지 않다."],
        optionTranslations: ["政府上个月推出了这张交通卡。", "可以在实体卡和手机卡中选择。", "部分收益会捐给气候相关团体。", "不包含公共自行车费用优惠。"],
        answer: 2,
        answerZh: "部分收益会捐给气候相关团体。",
        transcript: "남자: 정부는 지구 온도 내리기 운동의 하나로 '기후교통카드'를 다음 달 출시합니다. 이 카드는 실물 카드 대신 모바일 카드로만 발급되며 대중교통뿐만 아니라 공공 자전거 요금도 할인을 받을 수 있습니다. 카드 판매 수익금의 일부는 기후 관련 단체에 기부될 예정입니다.",
        transcriptZh: "男：作为降低地球温度行动的一部分，政府将于下月推出“气候交通卡”。该卡不发行实体卡，只以手机卡形式发放，不仅公共交通，公共自行车费用也可享受优惠。部分售卡收益将捐给气候相关团体。",
        explanation: "카드 판매 수익금의 일부를 기후 관련 단체에 기부한다고 했으므로 ③이 맞습니다.",
        explanationZh: "原文明确说部分售卡收益将捐给气候相关团体，因此选第三项。",
        source: "第102届 TOPIK II 听力 15题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q016",
        materialImage: "assets/materials/topik102-listening/question/q016.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-16.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["여자의 업무는 전공과 관련이 없다.", "여자는 작업에 클래식 음악을 활용한다.", "여자의 업무는 제품 완성 후에 시작된다.", "여자는 소리에 대한 전문 지식이 부족하다."],
        optionTranslations: ["女生的工作与专业无关。", "女生会在工作中运用古典音乐。", "女生的工作在产品完成后才开始。", "女生缺乏声音方面的专业知识。"],
        answer: 1,
        answerZh: "女生会在工作中运用古典音乐。",
        transcript: "남자: 가전제품에 쓰이는 작동음, 경고음 같은 소리를 만드신다고요? 여자: 네. 에어컨 온도를 바꾸거나 세탁이 끝났을 때 나는 소리를 개발하는 거예요. 이때 클래식 음악을 활용하기도 합니다. 제품에 맞는 소리를 찾기 위해 제품 개발 초기 단계부터 개발팀과 함께 일하고 있는데요. 소리에 대한 전문 지식이 필요해서 제가 음악을 전공한 게 도움이 돼요.",
        transcriptZh: "男：听说您制作家电使用的操作音、警告音等声音？女：是的，比如开发调节空调温度或洗衣结束时发出的声音，有时也会运用古典音乐。为了找到适合产品的声音，我从产品开发初期就和开发团队一起工作。因为需要声音方面的专业知识，我的音乐专业背景很有帮助。",
        explanation: "여자가 소리를 만들 때 클래식 음악을 활용하기도 한다고 했으므로 ②가 맞습니다.",
        explanationZh: "女生明确说制作提示音时有时会运用古典音乐，因此第二项与原文一致。",
        source: "第102届 TOPIK II 听力 16题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q022",
        materialImage: "assets/materials/topik102-listening/question/q022.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-22.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听对话，选择与原文内容一致的一项。",
        options: ["이 회사는 새 커피의 출시를 앞두고 있다.", "이 회사의 커피는 해외에서 많이 팔리고 있다.", "이 회사의 커피를 신뢰하지 않는 소비자가 많다.", "이 회사의 커피 모델은 드라마에 나온 적이 없다."],
        optionTranslations: ["这家公司即将推出新咖啡。", "这家公司的咖啡在海外销量很大。", "很多消费者不信任这家公司的咖啡。", "这家公司的咖啡模特没有出演过电视剧。"],
        answer: 0,
        answerZh: "这家公司即将推出新咖啡。",
        transcript: "여자: 오랜만에 새로 출시할 커피인데 모델을 계속 이민우 씨로 할지 고민이 되네요. 게다가 이번엔 처음으로 해외 판매도 준비 중이잖아요. 남자: 이민우 씨가 나오는 드라마가 해외에서도 인기가 많은데 고민할 필요가 있을까요? 부드러운 이미지가 우리 제품과도 잘 맞고요. 여자: 그렇긴 한데 새 제품은 젊은 층을 대상으로 출시할 커피니까 새로운 얼굴로 광고 모델을 바꿔 보는 것도 좋을 것 같아요. 남자: 이민우 씨 덕분에 우리 회사 커피를 신뢰하는 소비자가 많아요. 이렇게 다양한 연령층에서 사랑을 받는 모델은 찾기 어려울 겁니다.",
        transcriptZh: "女：这是时隔很久要推出的新咖啡，我在犹豫是否继续让李敏宇担任代言人，而且这次还首次准备海外销售。男：李敏宇出演的电视剧在海外也很受欢迎，有必要犹豫吗？他温和的形象也很符合我们的产品。女：话虽如此，新产品面向年轻群体，也可以考虑换个新面孔做广告模特。男：因为李敏宇，很多消费者信任我们公司的咖啡。像这样受到不同年龄层喜爱的模特很难找到。",
        explanation: "대화 첫 문장에서 새 커피를 출시할 예정이라고 했고, 해외 판매는 아직 준비 중이라고 했습니다.",
        explanationZh: "对话第一句明确说明公司即将推出新咖啡；海外销售仍在准备中，因此第一项与原文一致。",
        source: "第102届 TOPIK II 听力 22题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q024",
        materialImage: "assets/materials/topik102-listening/question/q024.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-24.mp3",
        stem: "다음을 듣고 들은 내용과 같은 것을 고르십시오.",
        stemZh: "听对话，选择与原文内容一致的一项。",
        options: ["대여한 용품은 이용 당일에 반납해야 한다.", "남자는 오늘 체육 대회 용품을 받으러 갈 예정이다.", "체육 대회 용품을 대여하려면 전화로 예약해야 한다.", "인주 시민이 아니어도 체육 대회 용품 대여가 가능하다."],
        optionTranslations: ["租借用品须在使用当天归还。", "男方计划今天去领取体育大会用品。", "租借体育大会用品必须先电话预约。", "非仁州市民也可以租借体育大会用品。"],
        answer: 2,
        answerZh: "租借体育大会用品必须先电话预约。",
        transcript: "남자: 시청이죠? 체육 대회 용품을 빌릴 수 있다고 해서 연락드렸습니다. 회사나 학교에서 주로 빌리는 것 같던데 동호회도 대여가 가능한가요? 여자: 그럼요. 대여하시는 분이 인주시 시민이면 됩니다. 전화로 먼저 예약하신 후에 받으러 오실 때 신분증 가지고 오시면 돼요. 남자: 네, 알겠습니다. 저희가 이번 주 금요일쯤 빌리려고 하는데요. 금요일에 빌리면 반납은 언제까지 하면 될까요? 여자: 일주일 안에만 반납하시면 됩니다. 반납은 다른 분이 하셔도 되고요.",
        transcriptZh: "男：这里是市政府吧？听说可以借体育大会用品，所以打电话咨询。好像主要是公司或学校借，社团也可以租借吗？女：当然。借用人只要是仁州市市民就可以。先电话预约，来领取时带身份证即可。男：好的。我们打算本周五左右借，如果周五借，最晚什么时候归还？女：一周内归还即可，也可以由其他人代还。",
        explanation: "여자가 전화로 먼저 예약한 뒤 신분증을 가지고 오라고 안내했습니다.",
        explanationZh: "工作人员明确说明要先通过电话预约；用品可在一周内归还，且借用人必须是仁州市民。",
        source: "第102届 TOPIK II 听力 24题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q026",
        materialImage: "assets/materials/topik102-listening/question/q026.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-26.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["이 합창단의 자격은 나이와 상관없다.", "이 합창단은 정기적으로 노래 연습을 한다.", "이 합창단은 이번에 첫 번째 공연을 마쳤다.", "이 합창단 공연에 대한 반응이 좋지 않았다."],
        optionTranslations: ["这个合唱团的资格与年龄无关。", "这个合唱团定期进行歌唱练习。", "这个合唱团这次完成了第一次演出。", "大家对这个合唱团演出的反响不好。"],
        answer: 1,
        answerZh: "这个合唱团定期进行歌唱练习。",
        transcript: "여자: 교수님께서 운영하시는 어르신 합창단은 70대 이상의 어르신으로 이루어져 있다면서요? 남자: 네. 어르신들은 사람들과 어울릴 기회가 적고 자존감이 떨어지기 쉬운데요. 합창이 이분들께 삶의 원동력과 행복을 주고 있습니다. 매주 한 번씩 만나 화음을 맞추며 노래하는 가운데 소속감도 느끼고 삶의 에너지도 얻는 거죠. 얼마 전 여덟 번째 공연을 성공적으로 마쳤는데요. 이런 성취감이 어르신들의 정체성 회복에도 도움이 됩니다. 저는 이게 합창의 힘이라고 생각합니다.",
        transcriptZh: "女：听说您运营的老年合唱团由70岁以上的老人组成？男：是的。老人们与人相处的机会较少，也容易失去自信。合唱给他们生活的动力和幸福。大家每周见一次，在配合和声、唱歌的过程中感到归属，也获得生活能量。不久前成功结束了第八次演出，这种成就感也有助于老人恢复自我认同。我认为这就是合唱的力量。",
        explanation: "매주 한 번씩 만나 노래한다고 했으므로 합창단은 정기적으로 연습합니다.",
        explanationZh: "原文明确说成员每周见一次、配合和声并唱歌，所以“定期进行歌唱练习”与原文一致。",
        source: "第102届 TOPIK II 听力 26题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q028",
        materialImage: "assets/materials/topik102-listening/question/q028.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-28.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听对话，选择与原文内容一致的一项。",
        options: ["여자는 창업을 해 본 적이 없다.", "이 서비스는 이용 대상에 제한이 없다.", "이 서비스는 비용을 내야 이용할 수 있다.", "남자는 최근 세무사를 만나서 상담을 받았다."],
        optionTranslations: ["女方没有创业经历。", "这项服务的使用对象没有限制。", "这项服务需要付费才能使用。", "男方最近见过税务师并接受了咨询。"],
        answer: 3,
        answerZh: "男方最近见过税务师并接受了咨询。",
        transcript: "남자: 수미야, 세무사가 청년 사업자들을 만나서 무료로 세금 상담을 해 주는 서비스가 있더라. 내가 얼마 전에 해 봤는데 도움이 많이 됐어. 여자: 그런 서비스가 있어? 나도 창업하고 나서 세금 때문에 정말 머리가 아팠는데 무료로 세무사하고 상담을 할 수 있다니 좋다. 남자: 응. 청년 사업자를 위한 세금 혜택도 많이 알려 주고 세금 관련 서류 작성까지 도와줬어. 덕분에 세금과 관련된 규정들도 잘 알게 됐고. 여자: 그렇구나. 나도 한번 이용해 보고 싶다. 그건 어떻게 하면 되는 거야? 남자: 이메일로 신청하면 돼. 연 소득이 5천만 원 이하면 신청할 수 있어.",
        transcriptZh: "男：秀美，有一项税务师与青年经营者见面、免费提供税务咨询的服务。我不久前用过，帮助很大。女：还有这种服务？我创业后也一直为税务头疼，能免费咨询税务师真好。男：是的，他们还介绍了很多面向青年经营者的税收优惠，并帮助填写税务文件，我也因此更清楚相关规定。女：原来如此，我也想试试，怎么申请？男：通过电子邮件申请即可，年收入不超过五千万韩元就能申请。",
        explanation: "남자가 얼마 전에 이 서비스를 이용해 세무사와 상담했다고 했으므로 ④가 맞습니다.",
        explanationZh: "男方说自己“不久前用过”这项服务，并具体说明税务师提供的帮助，因此第四项与原文一致。",
        source: "第102届 TOPIK II 听力 28题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q030",
        materialImage: "assets/materials/topik102-listening/question/q030.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-30.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["남자는 주로 혼자서 이 일을 한다.", "남자의 일은 야간에 할 수 없는 일이다.", "남자의 일에는 기상 자료 분석이 포함된다.", "남자는 전기 관련 시설을 찾아다니며 일한다."],
        optionTranslations: ["男方主要独自完成这项工作。", "男方的工作不能在夜间进行。", "男方的工作包括分析气象资料。", "男方走访电力相关设施开展工作。"],
        answer: 2,
        answerZh: "男方的工作包括分析气象资料。",
        transcript: "여자: 팀장님, 전국의 전기 사용 현황을 여기 있는 화면으로 확인하는군요. 남자: 네. 이 센터에서 팀원들과 함께 실시간 전기 사용량을 보면서 정전이 발생하지 않도록 지역별 수요에 맞춰 전기 공급을 분배합니다. 매일 24시간 해야 하는 업무라서 여섯 개 팀이 교대로 일하고 있어요. 여자: 그렇군요. 전기 공급을 안정적으로 유지하려면 매일 활용 가능한 전기 발전량을 파악하는 것도 필요할 텐데 일이 쉽지 않을 것 같습니다. 남자: 맞아요. 특히 풍력이나 태양광 발전은 날씨 영향을 많이 받거든요. 그래서 기상 자료를 분석해 발전량을 정확히 예측하고 있습니다.",
        transcriptZh: "女：组长，原来全国的用电情况都通过这里的屏幕确认。男：是的。我们在中心与组员一起观察实时用电量，并按照各地区需求分配供电，避免发生停电。这项工作每天24小时都要进行，所以六个组轮班。女：要稳定供电，似乎还要掌握每天可用的发电量，工作不容易。男：是的，尤其风力和太阳能发电受天气影响很大，所以我们分析气象资料，准确预测发电量。",
        explanation: "남자가 기상 자료를 분석해 발전량을 예측한다고 직접 말했으므로 ③이 맞습니다.",
        explanationZh: "男方明确说明会分析气象资料来预测发电量，所以第三项与原文一致。",
        source: "第102届 TOPIK II 听力 30题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q034",
        materialImage: "assets/materials/topik102-listening/question/q034.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-34.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听说明，选择与原文内容一致的一项。",
        options: ["이 탑에는 그 시대의 불교와 관련된 물건이 들어 있었다.", "이 탑이 위치한 곳은 물자 수송에 어려움이 많았다.", "이 탑은 통일 신라의 가장 남쪽에 세워졌다.", "이 탑은 너비가 넓어 안정감이 느껴진다."],
        optionTranslations: ["塔内有与当时佛教有关的物品。", "塔所在地区运输物资非常困难。", "这座塔建在统一新罗最南端。", "这座塔宽度大，给人稳定感。"],
        answer: 0,
        answerZh: "塔内有与当时佛教有关的物品。",
        transcript: "여자: 지금 보시는 탑평리 석탑은 통일 신라의 대표적인 석탑인 다보탑보다 먼저 국보로 지정됐습니다. 어떻게 가능했을까요? 이 탑은 현재 남아 있는 통일 신라의 석탑 중 가장 높습니다. 이 지역이 당시 물자 수송에 중요한 역할을 했고 국토의 중심인 걸 상징하려고 가장 높이 탑을 쌓은 거죠. 지리적으로 통일 신라의 정중앙에 위치해 ‘중앙탑’이라고도 불렸는데요. 높이에 비해 너비는 좁아 안정감은 덜하지만 웅장하고 우아한 느낌이 돋보입니다. 또 탑 안에서 당시 불교 사상을 엿볼 수 있는 유물들도 발견돼 그 가치를 인정받았던 겁니다.",
        transcriptZh: "女：眼前的塔坪里石塔比统一新罗代表性石塔多宝塔更早被指定为国宝。为什么呢？它是现存统一新罗石塔中最高的。当时这一地区在物资运输中发挥重要作用，为象征国土中心而把塔建得最高。它位于统一新罗正中央，也被称为‘中央塔’。塔身相对高度较窄，稳定感略弱，但雄伟优雅。塔内还发现了能了解当时佛教思想的文物，因此其价值得到认可。",
        explanation: "탑 안에서 당시 불교 사상을 엿볼 수 있는 유물이 발견됐다고 했으므로 ①이 맞습니다.",
        explanationZh: "原文明确说明塔内发现了可反映当时佛教思想的文物，因此第一项与原文一致。",
        source: "第102届 TOPIK II 听力 34题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q036",
        materialImage: "assets/materials/topik102-listening/question/q036.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-36.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听发言，选择与原文内容一致的一项。",
        options: ["이 봉사단은 작년에 조직되었다.", "이 봉사단은 지난주부터 활동을 시작했다.", "이 봉사단은 거주 공간을 고치는 일을 한다.", "이 봉사단의 단원은 시청 직원들로 한정되어 있다."],
        optionTranslations: ["该志愿团去年成立。", "该志愿团从上周开始活动。", "该志愿团负责修缮居住空间。", "该志愿团成员仅限市政府职员。"],
        answer: 2,
        answerZh: "该志愿团负责修缮居住空间。",
        transcript: "남자: 여러분, 반갑습니다. 우리 ‘사랑의 집 고치기’ 봉사단은 우리 지역의 낙후된 거주 공간을 개선하기 위해 이 자리에 모였습니다. 지난 십 년간 인주대 건축과 학생들을 비롯해 시청 직원들, 지역 주민까지 봉사에 참가해 주고 계십니다. 힘든 일을 마다하지 않고 참가해 주신 여러분께 감사의 말씀과 함께 힘내시라는 응원의 박수를 보냅니다. 이번엔 낡은 집들을 포함해 난방 시설이 열악한 보육원까지 수리합니다. 우리가 쌓은 다년간의 경험은 이번에도 많은 분에게 새로운 보금자리를 마련해 줄 거라 믿습니다. 일주일 동안 열심히 해 봅시다.",
        transcriptZh: "男：大家好。‘爱心修房’志愿团为了改善本地区落后的居住空间而聚集。过去十年间，仁州大学建筑系学生、市政府职员和当地居民都参与了志愿活动。感谢大家不辞辛苦参加，并为大家加油。这次除了老旧住宅，还要修理供暖设施较差的保育院。相信多年积累的经验会再次为许多人打造新的家园。让我们这一周努力干吧。",
        explanation: "봉사단이 낙후된 거주 공간과 낡은 집, 보육원의 난방 시설을 수리한다고 했으므로 ③이 맞습니다.",
        explanationZh: "原文说明志愿团改善落后的居住空间并修理旧房和保育院设施，因此第三项与原文一致。",
        source: "第102届 TOPIK II 听力 36题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q038",
        materialImage: "assets/materials/topik102-listening/question/q038.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-38.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["국가 영유아 검진이 의무적으로 실시되고 있다.", "신경 발달은 3세 이후부터 활발하게 이루어진다.", "진단을 받으면 나이와 상관없이 장애 등록이 된다.", "발달 장애 검사가 국가 영유아 검진에 포함되어 있다."],
        optionTranslations: ["国家婴幼儿体检属于强制实施。", "神经发育从3岁以后才进入活跃期。", "只要确诊，不论年龄都能登记残障。", "发育障碍检查已包含在国家婴幼儿体检中。"],
        answer: 3,
        answerZh: "发育障碍检查已包含在国家婴幼儿体检中。",
        transcript: "남자: 교수님, 우리나라는 영유아 발달 장애의 조기 진단율이 낮은 편이라고요. 여자: 네. 아기들의 신경 발달은 3세 전까지 가장 활발히 이루어지기 때문에 그 전에 발달 장애를 발견하는 게 중요한데요. 우리나라의 경우 국가 영유아 검진에 발달 장애 검사가 포함돼 있긴 하지만 영유아 검진 자체가 의무 사항이 아니라서 검진을 안 받는 경우가 꽤 많습니다. 또 2세 미만은 진단을 받더라도 장애 등록이 안 돼서 비용을 지원받지 못하는데 이것도 진단 시기를 늦추는 원인이죠. 하지만 진단이 빠를수록 치료 효과가 좋으니 아기가 또래에 비해 성장이 느리다고 느껴지면 즉시 병원을 찾아 검사를 해야 합니다.",
        transcriptZh: "男：教授，听说我国婴幼儿发育障碍的早期诊断率偏低。女：是的。婴儿的神经发育在3岁以前最活跃，因此在此之前发现发育障碍很重要。我国国家婴幼儿体检虽已包含发育障碍检查，但体检本身并非强制，仍有不少人不参加。未满2岁即使确诊也无法登记残障、得不到费用支持，这也会推迟诊断。不过越早诊断，治疗效果越好；发现孩子比同龄人发育慢时，应立即去医院检查。",
        explanation: "국가 영유아 검진에 발달 장애 검사가 포함돼 있다고 했으므로 ④가 들은 내용과 같습니다.",
        explanationZh: "原文明确说国家婴幼儿体检已经包含发育障碍检查，因此第四项与原文一致。",
        source: "第102届 TOPIK II 听力 38题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q040",
        materialImage: "assets/materials/topik102-listening/question/q040.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-40.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["내부의 전문 기자는 단기간 육성이 가능하다.", "전문 기자의 보도는 언론에 큰 영향을 미친다.", "비용 절감을 위해 외부 전문가 영입을 늘렸다.", "기자가 자유롭게 취재 분야를 선택할 수 있다."],
        optionTranslations: ["内部专业记者可以在短期内培养。", "专业记者的报道会对舆论产生很大影响。", "为节省费用而增加了外部专家招聘。", "记者可以自由选择采访领域。"],
        answer: 1,
        answerZh: "专业记者的报道会对舆论产生很大影响。",
        transcript: "여자: 전문 기자의 보도가 언론에 미치는 영향이 큰데도 전문 기자 제도는 아직까지 자리를 잡지 못하고 있군요. 남자: 네. 인적 자원의 확보가 어렵기 때문입니다. 언론사는 외부 전문가를 영입하거나 내부 기자를 육성해 전문 기자를 확보하는데요. 외부 전문가 영입은 비용이 많이 들고 내부 기자 육성은 시간이 오래 걸립니다. 대개의 언론사에서는 기자 본인의 의사와 상관없이 취재 분야를 매년 바꾸고 있어 역량을 쌓기가 힘듭니다. 기자 스스로 전문성을 갖추려 해도 교육 시스템이 부족해서 해결이 쉽진 않습니다.",
        transcriptZh: "女：专业记者的报道对舆论影响很大，但专业记者制度至今仍未站稳脚跟。男：是的，因为很难确保人才资源。媒体通过引进外部专家或培养内部记者来获得专业记者；外聘成本高，内部培养又耗时。多数媒体每年不顾记者本人意愿更换采访领域，很难积累能力。记者即使想自行提升专业性，也因教育体系不足而不易解决。",
        explanation: "전문 기자의 보도가 언론에 미치는 영향이 크다고 첫 문장에서 밝혔으므로 ②가 맞습니다.",
        explanationZh: "开头明确说明专业记者的报道对舆论影响很大，因此第二项与原文一致。",
        source: "第102届 TOPIK II 听力 40题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q042",
        materialImage: "assets/materials/topik102-listening/question/q042.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-42.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听讲解，选择与原文内容一致的一项。",
        options: ["이 책은 조선 시대 이전부터 유통되었다.", "이 책은 원본의 모습을 그대로 유지하고 있다.", "이 책에는 그림과 그림에 대한 비평이 실려 있다.", "이 책은 김광국이 직접 그린 그림으로 제작되었다."],
        optionTranslations: ["这本书在朝鲜时代以前就已流传。", "这本书完整保留了原本面貌。", "书中收录了画作以及对画作的评论。", "这本书由金光国亲自绘制的画作编成。"],
        answer: 2,
        answerZh: "书中收录了画作以及对画作的评论。",
        transcript: "여자: 이 책은 조선 후기에 발간된 ‘석농화원’이라는 화첩입니다. 18세기 의관이자 서화 애호가였던 김광국이 평생 수집한 그림들로 엮은 책이죠. 여기엔 고려부터 조선 시대에 이르는 화가들의 작품과 동서양의 작품도 담겨 있는데요. 책에는 그림과 함께 그림에 대한 비평이 실려 있습니다. 여기 비평을 보면 작품에 대한 예술적 평가는 물론 다른 나라의 작품과 비교한 내용도 보이는데요. 오랜 세월을 거치면서 그림이 없거나 훼손된 게 있기는 하지만 당시 국내외 미술 작품의 특징을 알 수 있는 자료로 평가받고 있습니다.",
        transcriptZh: "女：这本书是朝鲜后期刊行的画册《石农画苑》，由18世纪医官兼书画爱好者金光国用其一生收藏的画作编成。书中既有从高丽到朝鲜时代画家的作品，也收录东西方作品；画作旁还附有评论，不仅包含艺术评价，也有与其他国家作品的比较。历经岁月，部分画作缺失或受损，但它仍被视为了解当时国内外美术特点的重要资料。",
        explanation: "그림과 함께 그림에 대한 비평이 실려 있다고 했으므로 ③이 맞습니다.",
        explanationZh: "讲解明确说书中同时收录画作和对画作的评论，因此第三项与原文一致。",
        source: "第102届 TOPIK II 听力 42题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q044",
        materialImage: "assets/materials/topik102-listening/question/q044.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-44.mp3",
        stem: "반구대 암각화에 대한 설명으로 맞는 것을 고르십시오.",
        stemZh: "听讲解，选择关于盘龟台岩刻画的正确说明。",
        options: ["문자로 된 설명이 새겨져 있다.", "강가의 암벽에서 확인할 수 있다.", "그림에 다양한 색이 칠해져 있다.", "유사한 암각화가 많이 발견되었다."],
        optionTranslations: ["刻有文字说明。", "可以在河边的岩壁上看到。", "画面涂有多种颜色。", "已发现许多相似的岩刻画。"],
        answer: 1,
        answerZh: "可以在河边的岩壁上看到。",
        transcript: "남자: 강 언저리, 굽이치는 강물을 따라 병풍처럼 펼쳐진 암벽에 새겨진 수십 마리 고래들. 물결이 암벽에 부딪히자 암각화 속 고래들이 수면 위로 뛰어오른다. 줄무늬가 새겨진 혹등고래, 새끼를 등에 업은 귀신고래. 색칠도, 문자로 된 설명도 하나 없는 그림들이지만 세밀한 묘사에 고래들의 정체가 단번에 구별된다. 고래들 사이로 지나가는 한 척의 배. 배 위에서 던진 작살을 맞은 고래 하나가 힘없이 끌려간다. 뭍으로 끌고 온 고래 앞에서 춤을 추는 사내. 어느 암각화에서도 유례를 찾아볼 수 없는 사실적인 모습들. 반구대 암각화엔 고대인들이 보고 겪은 그들의 바다가 생생히 펼쳐져 있다.",
        transcriptZh: "男：河岸附近，沿着蜿蜒河水如屏风展开的岩壁上刻着数十头鲸鱼。水浪撞击岩壁，岩画中的鲸鱼仿佛跃出水面。有带条纹的座头鲸、背着幼鲸的灰鲸。画面没有着色，也没有文字说明，但细致描绘让各种鲸一眼可辨。鲸群之间有一艘船，一头被船上投出的鱼叉击中的鲸无力地被拖走；男人在拖到水边的鲸前跳舞。这些写实景象在其他岩画中难寻先例。盘龟台岩刻画鲜活呈现了古人亲眼所见、亲身经历的海洋。",
        explanation: "강물을 따라 펼쳐진 암벽에 고래들이 새겨져 있다고 했으므로 ②가 맞습니다.",
        explanationZh: "开头明确说鲸鱼刻在沿河展开的岩壁上，因此第二项与原文一致。",
        source: "第102届 TOPIK II 听力 44题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q045",
        materialImage: "assets/materials/topik102-listening/question/q045.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-45.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听说明，选择与原文内容一致的一项。",
        options: ["이 기술은 우주 자원 탐사에 사용되고 있다.", "이 기술은 굴착 속도를 높이는 데 사용된다.", "이 기술은 인공 지능으로 지진계의 자료를 종합한다.", "이 기술은 땅속 깊은 곳에 설치된 지진계를 활용한다."],
        optionTranslations: ["这项技术已用于太空资源勘探。", "这项技术用于提高开挖速度。", "这项技术利用人工智能综合地震仪资料。", "这项技术使用安装在地下深处的地震仪。"],
        answer: 2,
        answerZh: "这项技术利用人工智能综合地震仪资料。",
        transcript: "여자: 지하자원 탐사엔 땅속 깊은 곳까지 구멍을 뚫는 시추 방식이 널리 사용돼 왔는데요. 이러한 굴착 방식은 조사 범위가 좁고 경제성이 떨어집니다. 환경 파괴의 우려도 크죠. 최근 지진계와 인공위성을 활용한 기술이 대안으로 떠오르고 있는데요. 우선 지상에 설치한 지진계를 활용해 광물 매장이 추정되는 곳의 파동을 측정해서 지하 구조를 도식화합니다. 이 자료를 상공의 인공위성으로 전송하면 인공 지능이 종합해 해당 지역의 광물 매장량을 분석하고 정밀 지하 구조 모델을 생성하죠. 굴착이 필요 없는 이 기술은 앞으로 달의 지질 연구에도 활용될 전망입니다.",
        transcriptZh: "女：地下资源勘探过去广泛采用钻孔深入地下的钻探方式，但这种开挖方式调查范围窄、经济性低，且有较大环境破坏风险。最近，利用地震仪和人造卫星的技术成为替代方案。先用安装在地面的地震仪测量推定有矿藏地点的波动并绘制地下结构，再将资料传给空中卫星，由人工智能综合分析当地矿藏量并生成精密地下结构模型。这项无需开挖的技术未来还可能用于月球地质研究。",
        explanation: "지진계 자료를 인공위성으로 전송하면 인공 지능이 종합한다고 했으므로 ③이 맞습니다.",
        explanationZh: "原文明确说人工智能会综合地震仪传来的资料，因此第三项正确。",
        source: "第102届 TOPIK II 听力 45题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q047",
        materialImage: "assets/materials/topik102-listening/question/q047.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-47.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听访谈，选择与原文内容一致的一项。",
        options: ["개인 통관 번호는 국내 물품의 해외 발송 시에 필요하다.", "개인 통관 번호가 불법 수입에 악용되는 사례가 증가했다.", "예전에는 사용자에 의한 개인 통관 번호 해지가 가능했다.", "앞으로는 개인 통관 번호의 유효 기간이 폐지될 예정이다."],
        optionTranslations: ["国内物品寄往海外时需要个人通关号码。", "个人通关号码被滥用于非法进口的案例增加了。", "过去用户可以自行注销个人通关号码。", "今后将取消个人通关号码的有效期。"],
        answer: 1,
        answerZh: "个人通关号码被滥用于非法进口的案例增加了。",
        transcript: "여자: 소비자가 해외 제품을 온라인으로 직접 살 때는 관세청에서 발급받은 개인 통관 번호를 입력해야 하는데요. 지금까지는 한 번 발급받으면 평생 사용할 수 있었는데 이번 개편으로 매년 갱신해야 한다고요. 남자: 네. 개인 통관 번호를 도용한 불법 수입 증가가 문제인데요. 오랫동안 사용하지 않는 번호들이 도용된 겁니다. 그래서 발급일로부터 1년이 지날 때마다 새 번호로 재발급을 받도록 개편했죠. 도용이 어려워지면 불법 수입도 차단이 될 겁니다. 또 전과 달리 사용자의 직접 해지도 가능해졌는데요. 더 이상 사용하지 않는 번호를 바로 해지함으로써 도용 가능성도 미연에 방지할 수 있을 것으로 기대됩니다.",
        transcriptZh: "女：消费者在线直接购买海外产品时，需要输入海关签发的个人通关号码。以前一次签发可终身使用，这次改革后要每年更新。男：是的，盗用个人通关号码进行非法进口的增加是问题，长期未使用的号码被盗用。因此改为自签发日起每满一年重新签发新号码。盗用变难后，非法进口也将被阻断。与过去不同，现在用户还可自行注销号码；立即注销不再使用的号码，有望事先防止被盗用。",
        explanation: "개인 통관 번호를 도용한 불법 수입이 증가했다고 했으므로 ②가 맞습니다.",
        explanationZh: "男方明确指出盗用个人通关号码进行非法进口的情况增加，因此第二项正确。",
        source: "第102届 TOPIK II 听力 47题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q049",
        materialImage: "assets/materials/topik102-listening/question/q049.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-49.mp3",
        stem: "들은 내용과 같은 것을 고르십시오.",
        stemZh: "听讲解，选择与原文内容一致的一项。",
        options: ["원형 감옥에서는 많은 죄수를 하나의 수용실에 가둔다.", "원형 감옥의 수용실은 여러 감시대들로 둘러싸여 있다.", "원형 감옥의 개념을 적용한 교도소가 실제하지 않는다.", "원형 감옥의 감시대 안은 수용실에서 잘 보이지 않는다."],
        optionTranslations: ["圆形监狱把许多囚犯关在同一间牢房。", "圆形监狱的牢房被多个瞭望塔包围。", "现实中不存在采用圆形监狱理念的监狱。", "从牢房内看不清圆形监狱瞭望塔内部。"],
        answer: 3,
        answerZh: "从牢房内看不清圆形监狱瞭望塔内部。",
        transcript: "남자: 최대 다수의 최대 행복을 주장하며 효율성을 극대화하고자 했던 공리주의. 이 공리주의를 토대로 구현된 것 중 하나가 원형 감옥인데요. 이 감옥은 최소한의 감시로 죄수들의 행동을 효율적으로 통제할 수 있어 실제 교도소에도 차용된 바 있죠. 구조를 보면 중앙엔 감시대가 하나 세워져 있고요. 죄수들이 한 명씩 갇혀 있는 수용실들은 감시대를 중심으로 둥글게 배치돼 있습니다. 죄수들을 감시하는 간수들은 감시대 꼭대기에서 빛을 등지고 수용실을 내려다보는데요. 수용실에서는 역광 때문에 감시대 안이 어둡게 보이죠. 이러한 원리로 죄수들은 실제로 간수가 있건 없건 늘 감시당하고 있다고 의식해 규율에 벗어난 돌발 행동을 스스로 하지 않는 모습을 보입니다.",
        transcriptZh: "男：功利主义主张‘最大多数人的最大幸福’，试图把效率最大化。圆形监狱就是以功利主义为基础实现的设计之一。它能以最少的监视高效控制囚犯行为，也曾被实际监狱采用。其中央只设一个瞭望塔，单人牢房环绕瞭望塔呈圆形排列。狱警在塔顶背光俯视牢房，牢房里的人因逆光只能看到黑暗的塔内。这样一来，不论狱警是否真的在场，囚犯都会意识到自己一直可能被监视，因而主动避免违反纪律的突发行为。",
        explanation: "수용실에서는 역광 때문에 감시대 안이 어둡게 보인다고 했으므로 ④가 들은 내용과 같습니다.",
        explanationZh: "原文明确说牢房里因逆光看见的瞭望塔内部是黑暗的，因此第四项与原文一致。",
        source: "第102届 TOPIK II 听力 49题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-prior-context-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：对话前文推断",
    skillLabel: "对话前文推断",
    matchTerms: ["听对话前文推断"],
    trainingPoint: "根据当前对话提到的问题、原因和制度现状，反推双方在此之前谈论的内容",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "39题 · 原题图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q039",
        materialImage: "assets/materials/topik102-listening/question/q039.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-39.mp3",
        stem: "이 대화 전의 내용으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，根据当前内容推断双方此前最可能谈到的话题。",
        options: ["전문 기자는 현장 취재를 나가기 어렵다.", "전문 기자를 희망하는 기자들이 줄고 있다.", "전문 기자가 보도한 기사가 신뢰를 잃고 있다.", "전문 기자 제도가 현장에 정착되지 못하고 있다."],
        optionTranslations: ["专业记者难以外出进行现场采访。", "希望成为专业记者的人正在减少。", "专业记者报道的新闻正在失去信任。", "专业记者制度尚未在实际工作中扎根。"],
        answer: 3,
        answerZh: "专业记者制度尚未在实际工作中扎根。",
        transcript: "여자: 전문 기자의 보도가 언론에 미치는 영향이 큰데도 전문 기자 제도는 아직까지 자리를 잡지 못하고 있군요. 남자: 네. 인적 자원의 확보가 어렵기 때문입니다. 언론사는 외부 전문가를 영입하거나 내부 기자를 육성해 전문 기자를 확보하는데요. 외부 전문가 영입은 비용이 많이 들고 내부 기자 육성은 시간이 오래 걸립니다. 대개의 언론사에서는 기자 본인의 의사와 상관없이 취재 분야를 매년 바꾸고 있어 역량을 쌓기가 힘듭니다. 기자 스스로 전문성을 갖추려 해도 교육 시스템이 부족해서 해결이 쉽진 않습니다.",
        transcriptZh: "女：专业记者的报道对舆论影响很大，但专业记者制度至今仍未站稳脚跟。男：是的，因为很难确保人才资源。媒体通过引进外部专家或培养内部记者来获得专业记者；外聘成本高，内部培养又耗时。多数媒体每年不顾记者本人意愿更换采访领域，很难积累能力。记者即使想自行提升专业性，也因教育体系不足而不易解决。",
        explanation: "여자가 전문 기자 제도가 아직 자리를 잡지 못했다고 전제한 뒤 남자가 그 이유를 설명하므로, 앞에서는 제도가 현장에 정착되지 못한 상황을 이야기했을 가능성이 가장 높습니다.",
        explanationZh: "女方先承接“专业记者制度尚未站稳脚跟”这一现状，男方随后解释原因，因此此前最可能谈的是该制度未能在实际工作中扎根。",
        source: "第102届 TOPIK II 听力 39题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-main-idea-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：中心思想",
    skillLabel: "中心思想",
    matchTerms: ["听后复述"],
    trainingPoint: "先概括说话人或整段讲解最想表达的结论，再排除只复述细节的选项",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "17-21、25、31、37、41题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q017",
        materialImage: "assets/materials/topik102-listening/question/q017.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-17.mp3",
        stem: "다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["신청한 책을 빨리 받고 싶다.", "도서관 이용 교육이 필요하다.", "책을 빌릴 수 있는 기간을 늘려야 한다.", "신청 가능한 책의 수가 많아지면 좋겠다."],
        optionTranslations: ["希望尽快收到申请的书。", "需要进行图书馆使用教育。", "应该延长图书借阅期限。", "希望可以申请的书数量增加。"],
        answer: 3,
        answerZh: "希望可以申请的书数量增加。",
        transcript: "남자: 도서관에 없는 책을 신청하고 싶은데 세 권밖에 못하네. 좀 아쉽다. 여자: 도서 구입 비용이 정해져 있으니까 그럴 거야. 남자: 요즘 새로 나오는 책들도 많은데 세 권은 너무 적은 것 같아.",
        transcriptZh: "男：我想申请图书馆没有的书，但只能申请三本，有点遗憾。女：可能因为购书预算是固定的。男：最近新书也很多，我觉得三本太少了。",
        explanation: "남자는 신청 가능한 세 권이 너무 적다고 반복해서 말하므로 신청 권수가 늘어나기를 바랍니다.",
        explanationZh: "男生两次强调只能申请三本太少，中心意思是希望增加可申请图书的数量。",
        source: "第102届 TOPIK II 听力 17题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q018",
        materialImage: "assets/materials/topik102-listening/question/q018.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-18.mp3",
        stem: "다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["거실에 맞는 크기의 소파를 골라야 한다.", "마음에 드는 색의 소파를 찾기가 어렵다.", "관리하기 쉬운 소파를 구입하는 것이 좋다.", "거실이 넓어 보이는 밝은색의 소파를 사고 싶다."],
        optionTranslations: ["应该选择适合客厅大小的沙发。", "很难找到喜欢颜色的沙发。", "最好购买易于打理的沙发。", "想买让客厅显得宽敞的浅色沙发。"],
        answer: 3,
        answerZh: "想买让客厅显得宽敞的浅色沙发。",
        transcript: "남자: 이 소파로 살까? 우리 집 거실이 넓지 않으니까 밝은색이 좋겠지? 여자: 그렇긴 한데 밝은 건 관리가 힘드니까 어두운 걸로 하는 건 어때? 남자: 거실도 작은데 색까지 어두우면 더 좁아 보이면서 안 좋을 것 같아.",
        transcriptZh: "男：买这张沙发怎么样？我们家客厅不大，浅色更好吧？女：是这样，但浅色不好打理，选深色怎么样？男：客厅已经小了，颜色再深会显得更窄，不太好。",
        explanation: "남자는 어두운색보다 거실이 넓어 보이는 밝은색 소파를 원합니다.",
        explanationZh: "男生担心深色让小客厅显得更窄，所以他的核心想法是买让客厅显得宽敞的浅色沙发。",
        source: "第102届 TOPIK II 听力 18题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q019",
        materialImage: "assets/materials/topik102-listening/question/q019.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-19.mp3",
        stem: "다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["적극적인 직원이 들어오면 좋겠다.", "능력이 뛰어난 직원을 뽑아야 한다.", "업무 경력이 많은 직원이 필요하다.", "일을 실수 없이 하는 것이 중요하다."],
        optionTranslations: ["希望招到积极主动的员工。", "应该选拔能力出众的员工。", "需要工作经验丰富的员工。", "工作不出错最重要。"],
        answer: 0,
        answerZh: "希望招到积极主动的员工。",
        transcript: "여자: 우리 회사, 신입 직원 채용하는 거 이번에 어떤 사람들이 들어올까? 남자: 난 업무에 관심도 있고 의욕도 넘치는 사람들이 오면 좋겠어. 여자: 의욕만 앞서면 실수가 많지 않을까? 남자: 업무가 잘 돌아가려면 일을 좀 나서서 해야 빨리 익힐 수 있지.",
        transcriptZh: "女：我们公司这次招聘新人，会有什么样的人进来呢？男：我希望来的是对工作有兴趣、干劲十足的人。女：只顾干劲会不会容易出错？男：工作要顺利推进，就得主动做事才能更快熟悉。",
        explanation: "남자는 관심과 의욕이 있고 먼저 나서서 일하는 직원을 원합니다.",
        explanationZh: "男生反复强调有干劲、主动做事，因此希望招到积极主动的员工。",
        source: "第102届 TOPIK II 听力 19题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q020",
        materialImage: "assets/materials/topik102-listening/question/q020.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-20.mp3",
        stem: "다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["진로 결정 전에 다양한 체험을 해야 한다.", "학생들 대상의 진로 교육이 강화되어야 한다.", "새로 개발한 교육 자료에 대한 검토가 필요하다.", "흥미로운 자료를 만들어야 교육 효과를 높일 수 있다."],
        optionTranslations: ["决定职业方向前应该进行多种体验。", "应加强面向学生的职业教育。", "需要审查新开发的教学资料。", "制作有趣的资料才能提高教育效果。"],
        answer: 3,
        answerZh: "制作有趣的资料才能提高教育效果。",
        transcript: "여자: 경찰관님이 진행하시는 진로 교육이 학생들에게 반응이 아주 좋습니다. 남자: 네. 학생들에게 경찰이라는 직업을 설명하는 일을 맡게 됐는데요. 글로만 쓰인 기존 자료로는 흥미를 느끼기 어렵겠더라고요. 그래서 일을 하는 경찰들의 모습을 생생하고 재미있게 담아서 영상을 만들었죠. 수업 집중도도 높아지고 경찰에 대한 관심도 많아져서 아주 뿌듯해요.",
        transcriptZh: "女：您主持的职业教育在学生中反响很好。男：是的，我负责向学生介绍警察这一职业。只用文字写成的原有资料很难让学生感兴趣，所以我把警察工作的样子生动有趣地拍成了视频。课堂专注度提高了，学生对警察也更感兴趣，我很欣慰。",
        explanation: "남자는 흥미로운 영상 자료를 만든 뒤 집중도와 관심이 높아졌다고 강조합니다.",
        explanationZh: "男生强调把资料做得生动有趣后，课堂专注和兴趣都提高了，中心思想是有趣的资料能提升教育效果。",
        source: "第102届 TOPIK II 听力 20题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q021",
        materialImage: "assets/materials/topik102-listening/question/q021.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-21.mp3",
        stem: "다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["해외 판매를 위한 새로운 전략이 필요하다.", "제품의 이미지는 시대에 따라 달라져야 한다.", "현재 광고 모델을 그대로 유지하는 것이 좋다.", "소비자 설문을 통해 광고 모델을 정해야 한다."],
        optionTranslations: ["海外销售需要新的策略。", "产品形象应随时代变化。", "最好继续使用现有广告模特。", "应通过消费者调查决定广告模特。"],
        answer: 2,
        answerZh: "最好继续使用现有广告模特。",
        transcript: "여자: 오랜만에 새로 출시할 커피인데 모델을 계속 이민우 씨로 할지 고민이 되네요. 게다가 이번엔 처음으로 해외 판매도 준비 중이잖아요. 남자: 이민우 씨가 나오는 드라마가 해외에서도 인기가 많은데 고민할 필요가 있을까요? 부드러운 이미지가 우리 제품과도 잘 맞고요. 여자: 그렇긴 한데 새 제품은 젊은 층을 대상으로 출시할 커피니까 새로운 얼굴로 광고 모델을 바꿔 보는 것도 좋을 것 같아요. 남자: 이민우 씨 덕분에 우리 회사 커피를 신뢰하는 소비자가 많아요. 이렇게 다양한 연령층에서 사랑을 받는 모델은 찾기 어려울 겁니다.",
        transcriptZh: "女：这是时隔很久要推出的新咖啡，我在犹豫是否继续让李敏宇担任代言人，而且这次还首次准备海外销售。男：李敏宇出演的电视剧在海外也很受欢迎，有必要犹豫吗？他温和的形象也很符合我们的产品。女：话虽如此，新产品面向年轻群体，也可以考虑换个新面孔做广告模特。男：因为李敏宇，很多消费者信任我们公司的咖啡。像这样受到不同年龄层喜爱的模特很难找到。",
        explanation: "남자는 현재 모델의 해외 인지도, 제품 이미지와의 적합성, 소비자 신뢰를 근거로 모델을 유지해야 한다고 말합니다.",
        explanationZh: "男方反复强调现有模特的海外知名度、形象匹配、消费者信任和跨年龄层受欢迎，因此主张继续使用现有广告模特。",
        source: "第102届 TOPIK II 听力 21题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q025",
        materialImage: "assets/materials/topik102-listening/question/q025.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-25.mp3",
        stem: "남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听访谈，选择最能概括男方中心思想的一项。",
        options: ["합창단을 체계적으로 관리할 필요가 있다.", "합창은 노인들의 삶에 긍정적인 영향을 준다.", "합창은 오랜 기간 함께 연습하는 것이 중요하다.", "합창단원의 연령대를 다양하게 구성하는 것이 좋다."],
        optionTranslations: ["有必要系统管理合唱团。", "合唱对老年人的生活产生积极影响。", "合唱最重要的是长期一起练习。", "最好让合唱团成员的年龄层更加多样。"],
        answer: 1,
        answerZh: "合唱对老年人的生活产生积极影响。",
        transcript: "여자: 교수님께서 운영하시는 어르신 합창단은 70대 이상의 어르신으로 이루어져 있다면서요? 남자: 네. 어르신들은 사람들과 어울릴 기회가 적고 자존감이 떨어지기 쉬운데요. 합창이 이분들께 삶의 원동력과 행복을 주고 있습니다. 매주 한 번씩 만나 화음을 맞추며 노래하는 가운데 소속감도 느끼고 삶의 에너지도 얻는 거죠. 얼마 전 여덟 번째 공연을 성공적으로 마쳤는데요. 이런 성취감이 어르신들의 정체성 회복에도 도움이 됩니다. 저는 이게 합창의 힘이라고 생각합니다.",
        transcriptZh: "女：听说您运营的老年合唱团由70岁以上的老人组成？男：是的。老人们与人相处的机会较少，也容易失去自信。合唱给他们生活的动力和幸福。大家每周见一次，在配合和声、唱歌的过程中感到归属，也获得生活能量。不久前成功结束了第八次演出，这种成就感也有助于老人恢复自我认同。我认为这就是合唱的力量。",
        explanation: "남자는 합창이 어르신들에게 원동력, 행복, 소속감, 삶의 에너지와 성취감을 준다고 강조합니다.",
        explanationZh: "男方列举了动力、幸福、归属感、生活能量和成就感，中心思想是合唱对老年人的生活有积极影响。",
        source: "第102届 TOPIK II 听力 25题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q031",
        materialImage: "assets/materials/topik102-listening/question/q031.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-31.mp3",
        stem: "남자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最能概括男方中心思想的一项。",
        options: ["편의점의 의약품 판매 실태를 조사해야 한다.", "의약품의 정확한 사용에 대한 교육이 필요하다.", "편의점에서 판매하는 의약품 품목을 확대해야 한다.", "의약품 판매 편의점에 대한 정부의 관리가 필요하다."],
        optionTranslations: ["应该调查便利店药品销售现状。", "需要开展正确用药教育。", "应该扩大便利店销售的药品种类。", "政府需要管理售药便利店。"],
        answer: 2,
        answerZh: "应该扩大便利店销售的药品种类。",
        transcript: "남자: 휴일이나 야간에 문을 여는 약국이 점점 줄고 있습니다. 편의점에서 더 많은 의약품을 판매하도록 해서 의약품 접근성을 높여야 합니다. 여자: 취지는 이해하지만 의약품은 정확한 사용이 중요한데 아무런 제재 없이 구입할 수 있는 품목을 지금보다 늘리는 건 좀 우려가 됩니다. 남자: 그간 편의점 의약품은 부정확한 사용으로 인한 문제가 없었고 판매량도 계속 증가하고 있는데 이런 소비자들의 수요를 간과할 순 없죠. 여자: 수요만 고려해서 품목 확대를 결정할 일은 아닌 것 같아요. 큰 문제가 없었던 건 위험성이 매우 낮은 의약품만 판매해 왔기 때문이죠.",
        transcriptZh: "男：节假日或夜间营业的药店越来越少。应该让便利店销售更多药品，提高药品可及性。女：理解这个出发点，但正确用药很重要，无限制地增加可购买品种令人担忧。男：便利店药品至今没有因不当使用出现问题，销量也持续增加，不能忽视消费者需求。女：不能只考虑需求就决定扩大品种。此前没出大问题，是因为只销售危险性很低的药品。",
        explanation: "남자는 약국 접근성이 낮아진 상황과 소비자 수요를 근거로 편의점 판매 의약품을 늘려야 한다고 일관되게 주장합니다.",
        explanationZh: "男方以药店减少和消费者需求为依据，始终主张扩大便利店销售的药品品种。",
        source: "第102届 TOPIK II 听力 31题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q037",
        materialImage: "assets/materials/topik102-listening/question/q037.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-37.mp3",
        stem: "여자의 중심 생각으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听访谈，选择最能概括女方中心思想的一项。",
        options: ["영유아 발달 장애는 빠른 진단이 중요하다.", "영유아 발달 장애의 진단 도구를 개발해야 한다.", "발달 장애 영유아를 위한 전문 병원이 필요하다.", "영유아 발달 장애에 대한 연구가 더 이루어져야 한다."],
        optionTranslations: ["婴幼儿发育障碍需要尽早诊断。", "应开发婴幼儿发育障碍诊断工具。", "需要面向发育障碍婴幼儿的专门医院。", "应进一步开展婴幼儿发育障碍研究。"],
        answer: 0,
        answerZh: "婴幼儿发育障碍需要尽早诊断。",
        transcript: "남자: 교수님, 우리나라는 영유아 발달 장애의 조기 진단율이 낮은 편이라고요. 여자: 네. 아기들의 신경 발달은 3세 전까지 가장 활발히 이루어지기 때문에 그 전에 발달 장애를 발견하는 게 중요한데요. 우리나라의 경우 국가 영유아 검진에 발달 장애 검사가 포함돼 있긴 하지만 영유아 검진 자체가 의무 사항이 아니라서 검진을 안 받는 경우가 꽤 많습니다. 또 2세 미만은 진단을 받더라도 장애 등록이 안 돼서 비용을 지원받지 못하는데 이것도 진단 시기를 늦추는 원인이죠. 하지만 진단이 빠를수록 치료 효과가 좋으니 아기가 또래에 비해 성장이 느리다고 느껴지면 즉시 병원을 찾아 검사를 해야 합니다.",
        transcriptZh: "男：教授，听说我国婴幼儿发育障碍的早期诊断率偏低。女：是的。婴儿的神经发育在3岁以前最活跃，因此在此之前发现发育障碍很重要。我国国家婴幼儿体检虽已包含发育障碍检查，但体检本身并非强制，仍有不少人不参加。未满2岁即使确诊也无法登记残障、得不到费用支持，这也会推迟诊断。不过越早诊断，治疗效果越好；发现孩子比同龄人发育慢时，应立即去医院检查。",
        explanation: "여자는 조기 진단을 막는 원인을 설명한 뒤 진단이 빠를수록 치료 효과가 좋으니 즉시 검사해야 한다고 강조합니다.",
        explanationZh: "女方说明阻碍早期诊断的原因后，强调越早诊断治疗效果越好、发现异常应立即检查，因此中心思想是尽早诊断。",
        source: "第102届 TOPIK II 听力 37题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q041",
        materialImage: "assets/materials/topik102-listening/question/q041.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-41.mp3",
        stem: "이 강연의 중심 내용으로 가장 알맞은 것을 고르십시오.",
        stemZh: "听讲解，选择最能概括整段中心内容的一项。",
        options: ["석농화원을 복원하려는 움직임이 활발하다.", "석농화원은 회화사 연구에 중요한 자료이다.", "석농화원의 우수성을 밝히려는 노력이 필요하다.", "석농화원에 실린 작품들이 새롭게 해석되고 있다."],
        optionTranslations: ["修复《石农画苑》的行动很活跃。", "《石农画苑》是研究绘画史的重要资料。", "有必要努力揭示《石农画苑》的优秀价值。", "《石农画苑》中的作品正在得到全新解读。"],
        answer: 1,
        answerZh: "《石农画苑》是研究绘画史的重要资料。",
        transcript: "여자: 이 책은 조선 후기에 발간된 ‘석농화원’이라는 화첩입니다. 18세기 의관이자 서화 애호가였던 김광국이 평생 수집한 그림들로 엮은 책이죠. 여기엔 고려부터 조선 시대에 이르는 화가들의 작품과 동서양의 작품도 담겨 있는데요. 책에는 그림과 함께 그림에 대한 비평이 실려 있습니다. 여기 비평을 보면 작품에 대한 예술적 평가는 물론 다른 나라의 작품과 비교한 내용도 보이는데요. 오랜 세월을 거치면서 그림이 없거나 훼손된 게 있기는 하지만 당시 국내외 미술 작품의 특징을 알 수 있는 자료로 평가받고 있습니다.",
        transcriptZh: "女：这本书是朝鲜后期刊行的画册《石农画苑》，由18世纪医官兼书画爱好者金光国用其一生收藏的画作编成。书中既有从高丽到朝鲜时代画家的作品，也收录东西方作品；画作旁还附有评论，不仅包含艺术评价，也有与其他国家作品的比较。历经岁月，部分画作缺失或受损，但它仍被视为了解当时国内外美术特点的重要资料。",
        explanation: "작품과 비평, 국내외 비교 내용을 통해 당시 미술의 특징을 알 수 있는 자료라는 점을 중심으로 설명합니다.",
        explanationZh: "讲解围绕画作、评论和国内外比较展开，最终指出它是了解当时美术特征的重要资料，因此第二项最能概括中心内容。",
        source: "第102届 TOPIK II 听力 41题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-speaker-intent-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：说话人意图",
    skillLabel: "说话人意图",
    matchTerms: ["听说话人意图"],
    trainingPoint: "区分说话人是在说明、请求、抱怨还是分享经历，抓住整段话的交际目的",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "27、35题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q027",
        materialImage: "assets/materials/topik102-listening/question/q027.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-27.mp3",
        stem: "남자가 말하는 의도로 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最符合男方说话意图的一项。",
        options: ["서비스 이용 시간을 알리려고", "서비스 이용 신청을 부탁하려고", "서비스를 이용한 경험을 공유하려고", "서비스 이용의 불편 사항을 말하려고"],
        optionTranslations: ["为了告知服务使用时间。", "为了请求申请使用服务。", "为了分享使用服务的经验。", "为了说明使用服务时的不便。"],
        answer: 2,
        answerZh: "为了分享使用服务的经验。",
        transcript: "남자: 수미야, 세무사가 청년 사업자들을 만나서 무료로 세금 상담을 해 주는 서비스가 있더라. 내가 얼마 전에 해 봤는데 도움이 많이 됐어. 여자: 그런 서비스가 있어? 나도 창업하고 나서 세금 때문에 정말 머리가 아팠는데 무료로 세무사하고 상담을 할 수 있다니 좋다. 남자: 응. 청년 사업자를 위한 세금 혜택도 많이 알려 주고 세금 관련 서류 작성까지 도와줬어. 덕분에 세금과 관련된 규정들도 잘 알게 됐고. 여자: 그렇구나. 나도 한번 이용해 보고 싶다. 그건 어떻게 하면 되는 거야? 남자: 이메일로 신청하면 돼. 연 소득이 5천만 원 이하면 신청할 수 있어.",
        transcriptZh: "男：秀美，有一项税务师与青年经营者见面、免费提供税务咨询的服务。我不久前用过，帮助很大。女：还有这种服务？我创业后也一直为税务头疼，能免费咨询税务师真好。男：是的，他们还介绍了很多面向青年经营者的税收优惠，并帮助填写税务文件，我也因此更清楚相关规定。女：原来如此，我也想试试，怎么申请？男：通过电子邮件申请即可，年收入不超过五千万韩元就能申请。",
        explanation: "남자는 자신이 서비스를 이용해 도움을 받은 경험과 신청 방법을 여자에게 알려 주고 있습니다.",
        explanationZh: "男方从“我不久前用过”开始，主要分享自己接受咨询、获得帮助的经历；申请方式只是女方追问后的补充。",
        source: "第102届 TOPIK II 听力 27题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q035",
        materialImage: "assets/materials/topik102-listening/question/q035.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-35.mp3",
        stem: "남자가 무엇을 하고 있는지 고르십시오.",
        stemZh: "听发言，判断男方正在做什么。",
        options: ["봉사단원의 선발 기준과 방법을 소개하고 있다.", "봉사 활동을 시작하면서 봉사자들을 격려하고 있다.", "봉사 활동의 문제점을 밝히며 해결을 촉구하고 있다.", "봉사단에 대한 지속적인 관심과 지원을 호소하고 있다."],
        optionTranslations: ["介绍志愿团员的选拔标准和方法。", "开始志愿活动时鼓励志愿者。", "指出志愿活动的问题并敦促解决。", "呼吁持续关注和支持志愿团。"],
        answer: 1,
        answerZh: "开始志愿活动时鼓励志愿者。",
        transcript: "남자: 여러분, 반갑습니다. 우리 ‘사랑의 집 고치기’ 봉사단은 우리 지역의 낙후된 거주 공간을 개선하기 위해 이 자리에 모였습니다. 지난 십 년간 인주대 건축과 학생들을 비롯해 시청 직원들, 지역 주민까지 봉사에 참가해 주고 계십니다. 힘든 일을 마다하지 않고 참가해 주신 여러분께 감사의 말씀과 함께 힘내시라는 응원의 박수를 보냅니다. 이번엔 낡은 집들을 포함해 난방 시설이 열악한 보육원까지 수리합니다. 우리가 쌓은 다년간의 경험은 이번에도 많은 분에게 새로운 보금자리를 마련해 줄 거라 믿습니다. 일주일 동안 열심히 해 봅시다.",
        transcriptZh: "男：大家好。‘爱心修房’志愿团为了改善本地区落后的居住空间而聚集。过去十年间，仁州大学建筑系学生、市政府职员和当地居民都参与了志愿活动。感谢大家不辞辛苦参加，并为大家加油。这次除了老旧住宅，还要修理供暖设施较差的保育院。相信多年积累的经验会再次为许多人打造新的家园。让我们这一周努力干吧。",
        explanation: "남자는 봉사 활동을 시작하는 자리에서 참가자들에게 감사를 전하고 힘내자고 격려합니다.",
        explanationZh: "男方在活动开始时感谢参与者并号召大家一周内努力完成工作，因此是在鼓励志愿者。",
        source: "第102届 TOPIK II 听力 35题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-speaker-attitude-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：说话人态度",
    skillLabel: "说话人态度",
    matchTerms: ["听说话人态度"],
    trainingPoint: "根据回应方式判断说话人是在担忧、部分认同、质疑还是坚持主张",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "32、48题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q032",
        materialImage: "assets/materials/topik102-listening/question/q032.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-32.mp3",
        stem: "남자의 태도로 가장 알맞은 것을 고르십시오.",
        stemZh: "听对话，选择最符合男方态度的一项。",
        options: ["예상되는 문제점을 우려하고 있다.", "상대의 반론을 일부 인정하고 있다.", "상대가 제시한 근거를 의심하고 있다.", "자신의 의견을 일관되게 주장하고 있다."],
        optionTranslations: ["担忧预期会出现的问题。", "部分承认对方的反驳。", "怀疑对方提出的依据。", "始终坚持自己的意见。"],
        answer: 3,
        answerZh: "始终坚持自己的意见。",
        transcript: "남자: 휴일이나 야간에 문을 여는 약국이 점점 줄고 있습니다. 편의점에서 더 많은 의약품을 판매하도록 해서 의약품 접근성을 높여야 합니다. 여자: 취지는 이해하지만 의약품은 정확한 사용이 중요한데 아무런 제재 없이 구입할 수 있는 품목을 지금보다 늘리는 건 좀 우려가 됩니다. 남자: 그간 편의점 의약품은 부정확한 사용으로 인한 문제가 없었고 판매량도 계속 증가하고 있는데 이런 소비자들의 수요를 간과할 순 없죠. 여자: 수요만 고려해서 품목 확대를 결정할 일은 아닌 것 같아요. 큰 문제가 없었던 건 위험성이 매우 낮은 의약품만 판매해 왔기 때문이죠.",
        transcriptZh: "男：节假日或夜间营业的药店越来越少。应该让便利店销售更多药品，提高药品可及性。女：理解这个出发点，但正确用药很重要，无限制地增加可购买品种令人担忧。男：便利店药品至今没有因不当使用出现问题，销量也持续增加，不能忽视消费者需求。女：不能只考虑需求就决定扩大品种。此前没出大问题，是因为只销售危险性很低的药品。",
        explanation: "남자는 여자의 우려에도 판매 품목 확대가 필요하다는 자신의 의견을 계속 주장합니다.",
        explanationZh: "面对女方两次提出风险和反驳，男方仍用销售量和需求支持原主张，因此态度是始终坚持自己的意见。",
        source: "第102届 TOPIK II 听力 32题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q048",
        materialImage: "assets/materials/topik102-listening/question/q048.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-48.mp3",
        stem: "남자의 태도로 알맞은 것을 고르십시오.",
        stemZh: "听访谈，选择最符合男方态度的一项。",
        options: ["제도 개편에 따른 결과에 대해서 낙관하고 있다.", "제도 개편에 대한 국민의 협조를 당부하고 있다.", "제도 개편을 위한 정부의 노력을 촉구하고 있다.", "제도 개편이 미칠 영향에 대해서 비판하고 있다."],
        optionTranslations: ["对制度改革将带来的结果持乐观态度。", "呼吁国民配合制度改革。", "敦促政府为制度改革作出努力。", "批评制度改革将造成的影响。"],
        answer: 0,
        answerZh: "对制度改革将带来的结果持乐观态度。",
        transcript: "여자: 소비자가 해외 제품을 온라인으로 직접 살 때는 관세청에서 발급받은 개인 통관 번호를 입력해야 하는데요. 지금까지는 한 번 발급받으면 평생 사용할 수 있었는데 이번 개편으로 매년 갱신해야 한다고요. 남자: 네. 개인 통관 번호를 도용한 불법 수입 증가가 문제인데요. 오랫동안 사용하지 않는 번호들이 도용된 겁니다. 그래서 발급일로부터 1년이 지날 때마다 새 번호로 재발급을 받도록 개편했죠. 도용이 어려워지면 불법 수입도 차단이 될 겁니다. 또 전과 달리 사용자의 직접 해지도 가능해졌는데요. 더 이상 사용하지 않는 번호를 바로 해지함으로써 도용 가능성도 미연에 방지할 수 있을 것으로 기대됩니다.",
        transcriptZh: "女：消费者在线直接购买海外产品时，需要输入海关签发的个人通关号码。以前一次签发可终身使用，这次改革后要每年更新。男：是的，盗用个人通关号码进行非法进口的增加是问题，长期未使用的号码被盗用。因此改为自签发日起每满一年重新签发新号码。盗用变难后，非法进口也将被阻断。与过去不同，现在用户还可自行注销号码；立即注销不再使用的号码，有望事先防止被盗用。",
        explanation: "남자는 새 제도로 도용과 불법 수입을 막을 수 있을 것이라고 기대하므로 개편 결과를 낙관하고 있습니다.",
        explanationZh: "男方连续使用“将被阻断”“有望防止”等正面预期，说明他对改革结果持乐观态度。",
        source: "第102届 TOPIK II 听力 48题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-topic-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：主题与内容",
    skillLabel: "主题与内容",
    matchTerms: ["听主题与内容"],
    trainingPoint: "先概括说明对象，再判断整段材料主要解释的是原因、背景、过程还是时间",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "33、43题 · 逐题原图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q033",
        materialImage: "assets/materials/topik102-listening/question/q033.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-33.mp3",
        stem: "무엇에 대한 내용인지 알맞은 것을 고르십시오.",
        stemZh: "听说明，选择整段内容的主题。",
        options: ["탑평리 석탑이 국보로 지정된 이유", "탑평리 석탑이 훼손된 역사적 배경", "탑평리 석탑을 복원하는 과정", "탑평리 석탑을 발굴한 시기"],
        optionTranslations: ["塔坪里石塔被指定为国宝的原因。", "塔坪里石塔受损的历史背景。", "修复塔坪里石塔的过程。", "发现塔坪里石塔的时期。"],
        answer: 0,
        answerZh: "塔坪里石塔被指定为国宝的原因。",
        transcript: "여자: 지금 보시는 탑평리 석탑은 통일 신라의 대표적인 석탑인 다보탑보다 먼저 국보로 지정됐습니다. 어떻게 가능했을까요? 이 탑은 현재 남아 있는 통일 신라의 석탑 중 가장 높습니다. 이 지역이 당시 물자 수송에 중요한 역할을 했고 국토의 중심인 걸 상징하려고 가장 높이 탑을 쌓은 거죠. 지리적으로 통일 신라의 정중앙에 위치해 ‘중앙탑’이라고도 불렸는데요. 높이에 비해 너비는 좁아 안정감은 덜하지만 웅장하고 우아한 느낌이 돋보입니다. 또 탑 안에서 당시 불교 사상을 엿볼 수 있는 유물들도 발견돼 그 가치를 인정받았던 겁니다.",
        transcriptZh: "女：眼前的塔坪里石塔比统一新罗代表性石塔多宝塔更早被指定为国宝。为什么呢？它是现存统一新罗石塔中最高的。当时这一地区在物资运输中发挥重要作用，为象征国土中心而把塔建得最高。它位于统一新罗正中央，也被称为‘中央塔’。塔身相对高度较窄，稳定感略弱，但雄伟优雅。塔内还发现了能了解当时佛教思想的文物，因此其价值得到认可。",
        explanation: "석탑의 높이, 위치, 형태와 출토 유물을 차례로 설명하며 국보 지정 이유를 밝히고 있습니다.",
        explanationZh: "整段依次说明石塔的高度、地理位置、外形和出土文物，都是在解释它被指定为国宝的原因。",
        source: "第102届 TOPIK II 听力 33题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q043",
        materialImage: "assets/materials/topik102-listening/question/q043.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-43.mp3",
        stem: "무엇에 대한 내용인지 알맞은 것을 고르십시오.",
        stemZh: "听讲解，选择整段内容的主题。",
        options: ["반구대 암각화에 표현된 내용", "반구대 암각화를 보존한 방식", "반구대 암각화를 제작한 연대", "반구대 암각화가 발견된 과정"],
        optionTranslations: ["盘龟台岩刻画中表现的内容。", "保存盘龟台岩刻画的方式。", "盘龟台岩刻画的制作年代。", "盘龟台岩刻画被发现的过程。"],
        answer: 0,
        answerZh: "盘龟台岩刻画中表现的内容。",
        transcript: "남자: 강 언저리, 굽이치는 강물을 따라 병풍처럼 펼쳐진 암벽에 새겨진 수십 마리 고래들. 물결이 암벽에 부딪히자 암각화 속 고래들이 수면 위로 뛰어오른다. 줄무늬가 새겨진 혹등고래, 새끼를 등에 업은 귀신고래. 색칠도, 문자로 된 설명도 하나 없는 그림들이지만 세밀한 묘사에 고래들의 정체가 단번에 구별된다. 고래들 사이로 지나가는 한 척의 배. 배 위에서 던진 작살을 맞은 고래 하나가 힘없이 끌려간다. 뭍으로 끌고 온 고래 앞에서 춤을 추는 사내. 어느 암각화에서도 유례를 찾아볼 수 없는 사실적인 모습들. 반구대 암각화엔 고대인들이 보고 겪은 그들의 바다가 생생히 펼쳐져 있다.",
        transcriptZh: "男：河岸附近，沿着蜿蜒河水如屏风展开的岩壁上刻着数十头鲸鱼。水浪撞击岩壁，岩画中的鲸鱼仿佛跃出水面。有带条纹的座头鲸、背着幼鲸的灰鲸。画面没有着色，也没有文字说明，但细致描绘让各种鲸一眼可辨。鲸群之间有一艘船，一头被船上投出的鱼叉击中的鲸无力地被拖走；男人在拖到水边的鲸前跳舞。这些写实景象在其他岩画中难寻先例。盘龟台岩刻画鲜活呈现了古人亲眼所见、亲身经历的海洋。",
        explanation: "고래의 종류와 포경 장면 등 암각화에 새겨진 모습을 구체적으로 설명하고 있습니다.",
        explanationZh: "整段具体描述岩刻画里的鲸鱼种类、捕鲸和舞蹈场景，因此主题是岩刻画表现了什么内容。",
        source: "第102届 TOPIK II 听力 43题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-speaking-method-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：说明方式",
    skillLabel: "说明方式",
    matchTerms: ["听说明方式"],
    trainingPoint: "判断说话人是在概括策略、分类类型、解释原理与优点，还是列举应用实例",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "46、50题 · 原题图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q046",
        materialImage: "assets/materials/topik102-listening/question/q046.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-46.mp3",
        stem: "여자가 말하는 방식으로 알맞은 것을 고르십시오.",
        stemZh: "听说明，选择最符合女方说明方式的一项。",
        options: ["신기술의 보급 전략을 요약하고 있다.", "신기술의 여러 유형을 분류하고 있다.", "신기술의 원리와 장점을 설명하고 있다.", "신기술이 적용된 예시를 나열하고 있다."],
        optionTranslations: ["概括新技术的推广策略。", "分类介绍新技术的多种类型。", "说明新技术的原理和优点。", "列举新技术的应用实例。"],
        answer: 2,
        answerZh: "说明新技术的原理和优点。",
        transcript: "여자: 지하자원 탐사엔 땅속 깊은 곳까지 구멍을 뚫는 시추 방식이 널리 사용돼 왔는데요. 이러한 굴착 방식은 조사 범위가 좁고 경제성이 떨어집니다. 환경 파괴의 우려도 크죠. 최근 지진계와 인공위성을 활용한 기술이 대안으로 떠오르고 있는데요. 우선 지상에 설치한 지진계를 활용해 광물 매장이 추정되는 곳의 파동을 측정해서 지하 구조를 도식화합니다. 이 자료를 상공의 인공위성으로 전송하면 인공 지능이 종합해 해당 지역의 광물 매장량을 분석하고 정밀 지하 구조 모델을 생성하죠. 굴착이 필요 없는 이 기술은 앞으로 달의 지질 연구에도 활용될 전망입니다.",
        transcriptZh: "女：地下资源勘探过去广泛采用钻孔深入地下的钻探方式，但这种开挖方式调查范围窄、经济性低，且有较大环境破坏风险。最近，利用地震仪和人造卫星的技术成为替代方案。先用安装在地面的地震仪测量推定有矿藏地点的波动并绘制地下结构，再将资料传给空中卫星，由人工智能综合分析当地矿藏量并生成精密地下结构模型。这项无需开挖的技术未来还可能用于月球地质研究。",
        explanation: "지진계, 인공위성, 인공 지능이 작동하는 순서를 설명하고 굴착이 필요 없다는 장점을 함께 제시합니다.",
        explanationZh: "女方先按步骤解释地震仪、卫星和人工智能如何协作，再指出无需开挖等优点，所以是在说明原理和优势。",
        source: "第102届 TOPIK II 听力 46题"
      },
      {
        materialQuestionId: "topik-ii-listening-102-q050",
        materialImage: "assets/materials/topik102-listening/question/q050.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-50.mp3",
        stem: "남자가 말하는 방식으로 알맞은 것을 고르십시오.",
        stemZh: "听讲解，选择最符合男方说明方式的一项。",
        options: ["사상이 가진 문제의 원인을 유추하고 있다.", "사상에 대한 전문가의 의견을 인용하고 있다.", "사상에 새롭게 등장한 핵심 개념을 정의하고 있다.", "사상에 대한 이해를 돕기 위해 사례를 분석하고 있다."],
        optionTranslations: ["推测该思想所存在问题的原因。", "引用专家对该思想的意见。", "定义该思想中新出现的核心概念。", "为帮助理解该思想而分析具体案例。"],
        answer: 3,
        answerZh: "为帮助理解该思想而分析具体案例。",
        transcript: "남자: 최대 다수의 최대 행복을 주장하며 효율성을 극대화하고자 했던 공리주의. 이 공리주의를 토대로 구현된 것 중 하나가 원형 감옥인데요. 이 감옥은 최소한의 감시로 죄수들의 행동을 효율적으로 통제할 수 있어 실제 교도소에도 차용된 바 있죠. 구조를 보면 중앙엔 감시대가 하나 세워져 있고요. 죄수들이 한 명씩 갇혀 있는 수용실들은 감시대를 중심으로 둥글게 배치돼 있습니다. 죄수들을 감시하는 간수들은 감시대 꼭대기에서 빛을 등지고 수용실을 내려다보는데요. 수용실에서는 역광 때문에 감시대 안이 어둡게 보이죠. 이러한 원리로 죄수들은 실제로 간수가 있건 없건 늘 감시당하고 있다고 의식해 규율에 벗어난 돌발 행동을 스스로 하지 않는 모습을 보입니다.",
        transcriptZh: "男：功利主义主张‘最大多数人的最大幸福’，试图把效率最大化。圆形监狱就是以功利主义为基础实现的设计之一。它能以最少的监视高效控制囚犯行为，也曾被实际监狱采用。其中央只设一个瞭望塔，单人牢房环绕瞭望塔呈圆形排列。狱警在塔顶背光俯视牢房，牢房里的人因逆光只能看到黑暗的塔内。这样一来，不论狱警是否真的在场，囚犯都会意识到自己一直可能被监视，因而主动避免违反纪律的突发行为。",
        explanation: "공리주의를 토대로 구현된 원형 감옥의 구조와 감시 원리를 구체적으로 분석해 사상에 대한 이해를 돕고 있으므로 ④가 맞습니다.",
        explanationZh: "男方通过分析以功利主义为基础设计的圆形监狱及其监视原理，帮助听者理解这种思想，因此第四项正确。",
        source: "第102届 TOPIK II 听力 50题"
      }
    ]
  },
  {
    id: "topik-ii-listening-102-speaker-role-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "listening",
    title: "TOPIK II 听力：职业与身份",
    skillLabel: "职业与身份",
    matchTerms: ["听职业与身份"],
    trainingPoint: "根据工作职责、场所、工具和协作方式判断说话人的职业或身份",
    sourceTitle: "第102届 TOPIK II 听力真题",
    sourceDetail: "29题 · 原题图与原始音频",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-listening-102-q029",
        materialImage: "assets/materials/topik102-listening/question/q029.png",
        audioSrc: "assets/materials/topik102-listening/audio/2-29.mp3",
        stem: "남자가 누구인지 고르십시오.",
        stemZh: "听访谈，根据工作内容判断男方身份。",
        options: ["정전 신고를 처리하는 사람", "전기 공급량을 관리하는 사람", "지역 발전소를 운영하는 사람", "전기 시설 안전을 점검하는 사람"],
        optionTranslations: ["处理停电报修的人。", "管理供电量的人。", "运营地区发电站的人。", "检查电力设施安全的人。"],
        answer: 1,
        answerZh: "管理供电量的人。",
        transcript: "여자: 팀장님, 전국의 전기 사용 현황을 여기 있는 화면으로 확인하는군요. 남자: 네. 이 센터에서 팀원들과 함께 실시간 전기 사용량을 보면서 정전이 발생하지 않도록 지역별 수요에 맞춰 전기 공급을 분배합니다. 매일 24시간 해야 하는 업무라서 여섯 개 팀이 교대로 일하고 있어요. 여자: 그렇군요. 전기 공급을 안정적으로 유지하려면 매일 활용 가능한 전기 발전량을 파악하는 것도 필요할 텐데 일이 쉽지 않을 것 같습니다. 남자: 맞아요. 특히 풍력이나 태양광 발전은 날씨 영향을 많이 받거든요. 그래서 기상 자료를 분석해 발전량을 정확히 예측하고 있습니다.",
        transcriptZh: "女：组长，原来全国的用电情况都通过这里的屏幕确认。男：是的。我们在中心与组员一起观察实时用电量，并按照各地区需求分配供电，避免发生停电。这项工作每天24小时都要进行，所以六个组轮班。女：要稳定供电，似乎还要掌握每天可用的发电量，工作不容易。男：是的，尤其风力和太阳能发电受天气影响很大，所以我们分析气象资料，准确预测发电量。",
        explanation: "남자는 지역별 수요에 맞춰 전기 공급을 분배하고 실시간 사용량을 관리합니다.",
        explanationZh: "男方的核心职责是根据地区需求分配电力、管理实时用电量，因此身份是管理供电量的人。",
        source: "第102届 TOPIK II 听力 29题"
      }
    ]
  },
  {
    id: "topik-ii-reading-102-short-info-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "reading",
    title: "TOPIK II 阅读：短信息与流程理解",
    skillLabel: "短信息与流程理解",
    matchTerms: ["通知公告阅读", "促销广告阅读", "图表信息读取"],
    trainingPoint: "从广告、标语和操作步骤中判断主题、场所或用途",
    sourceTitle: "第102届 TOPIK II 阅读真题",
    sourceDetail: "5-8题 · 原题图与答案核对",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-reading-102-q005",
        materialImage: "assets/materials/topik102-reading/question/q005.png",
        instruction: "다음은 무엇에 대한 글인지 고르십시오.",
        instructionZh: "选择这则广告介绍的物品。",
        passage: "걸을 때 발이 편하게~ 가볍고 디자인도 예뻐요.",
        stemZh: "走路时让脚更舒适，轻便而且设计也漂亮。",
        passageZh: "走路时让脚更舒适，轻便而且设计也漂亮。",
        options: ["구두", "우산", "자전거", "선풍기"],
        optionTranslations: ["鞋", "雨伞", "自行车", "电风扇"],
        answer: 0,
        answerZh: "鞋",
        explanation: "걸을 때 발이 편하다는 표현은 구두에 대한 광고입니다.",
        explanationZh: "“走路时脚舒服”直接描述鞋的穿着体验，所以答案是鞋。",
        source: "第102届 TOPIK II 阅读 5题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q006",
        materialImage: "assets/materials/topik102-reading/question/q006.png",
        instruction: "다음은 무엇에 대한 글인지 고르십시오.",
        instructionZh: "选择这则广告对应的场所。",
        passage: "더러워진 옷을 새 옷처럼! 두꺼운 이불도 맡겨 주세요.",
        stemZh: "让脏衣服像新衣服一样！厚被子也可以交给我们。",
        passageZh: "让脏衣服像新衣服一样！厚被子也可以交给我们。",
        options: ["은행", "시장", "세탁소", "가구점"],
        optionTranslations: ["银行", "市场", "洗衣店", "家具店"],
        answer: 2,
        answerZh: "洗衣店",
        explanation: "옷과 이불을 맡겨 깨끗하게 하는 곳은 세탁소입니다.",
        explanationZh: "可以把衣服和厚被子交去清洗的场所是洗衣店。",
        source: "第102届 TOPIK II 阅读 6题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q007",
        materialImage: "assets/materials/topik102-reading/question/q007.png",
        instruction: "다음은 무엇에 대한 글인지 고르십시오.",
        instructionZh: "选择这则标语倡导的主题。",
        passage: "달리기, 지금 바로 시작하세요. 활기찬 내일이 기다립니다.",
        stemZh: "跑步，现在就开始吧。充满活力的明天在等着你。",
        passageZh: "跑步，现在就开始吧。充满活力的明天在等着你。",
        options: ["전기 절약", "건강 관리", "생활 예절", "환경 보호"],
        optionTranslations: ["节约用电", "健康管理", "生活礼仪", "环境保护"],
        answer: 1,
        answerZh: "健康管理",
        explanation: "달리기를 시작해 활기찬 생활을 하자는 내용이므로 건강 관리에 대한 글입니다.",
        explanationZh: "标语鼓励开始跑步、拥有充满活力的生活，主题是健康管理。",
        source: "第102届 TOPIK II 阅读 7题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q008",
        materialImage: "assets/materials/topik102-reading/question/q008.png",
        instruction: "다음은 무엇에 대한 글인지 고르십시오.",
        instructionZh: "选择这段操作步骤说明的内容。",
        passage: "1. 공연 날짜, 인원을 선택하고 다음 버튼을 누르세요.\n2. 원하는 좌석을 선택한 후 결제하세요.",
        stemZh: "先选择演出日期和人数并点击下一步，再选择想要的座位并付款。",
        passageZh: "先选择演出日期和人数并点击下一步，再选择想要的座位并付款。",
        options: ["예매 방법", "행사 소개", "등록 문의", "교환 순서"],
        optionTranslations: ["预订方法", "活动介绍", "报名咨询", "交换顺序"],
        answer: 0,
        answerZh: "预订方法",
        explanation: "공연 날짜와 좌석을 고른 뒤 결제하는 순서이므로 공연 예매 방법입니다.",
        explanationZh: "步骤说明了选择日期、人数、座位并付款的流程，因此是演出预订方法。",
        source: "第102届 TOPIK II 阅读 8题"
      }
    ]
  },
  {
    id: "topik-ii-reading-102-content-check-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "reading",
    title: "TOPIK II 阅读：公告、图表与短文核对",
    skillLabel: "公告、图表与短文核对",
    matchTerms: ["通知公告阅读", "图表信息读取", "题干关键词定位", "限时阅读"],
    trainingPoint: "先读选项，再回公告、图表或短文中定位数字、对象、动作和结果",
    sourceTitle: "第102届 TOPIK II 阅读真题",
    sourceDetail: "9-12题 · 原题图与答案核对",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-reading-102-q009",
        materialImage: "assets/materials/topik102-reading/question/q009.png",
        instruction: "다음 글 또는 그래프의 내용과 같은 것을 고르십시오.",
        instructionZh: "阅读招募公告，选择与原文内容一致的一项。",
        passage: "그림책 읽어 주는 자원봉사자 모집\n자격: 고등학생 또는 대학생\n모집 기간: 11월 10일~11월 21일\n신청 방법: 인주어린이도서관 홈페이지\n활동 기간: 2025년 12월 1일~2026년 2월 28일",
        passageZh: "招募为儿童朗读绘本的志愿者。资格为高中生或大学生，招募时间为11月10日至21日，通过仁州儿童图书馆官网申请，活动时间为2025年12月1日至2026年2月28日。",
        options: ["봉사 활동은 두 달 동안 하게 된다.", "아이들에게 책을 읽어 줄 봉사자를 찾고 있다.", "봉사자 신청은 도서관에 직접 가서 해야 한다.", "학생이 아닌 사람들도 이 봉사에 참여할 수 있다."],
        optionTranslations: ["志愿活动持续两个月。", "正在寻找给孩子们读书的志愿者。", "志愿者必须亲自到图书馆申请。", "不是学生的人也可以参加。"],
        answer: 1,
        answerZh: "正在寻找给孩子们读书的志愿者。",
        explanation: "제목에 그림책을 읽어 주는 자원봉사자를 모집한다고 적혀 있으므로 ②가 맞습니다.",
        explanationZh: "公告标题直接写明招募“为儿童朗读绘本的志愿者”，所以第二项正确。",
        source: "第102届 TOPIK II 阅读 9题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q010",
        materialImage: "assets/materials/topik102-reading/question/q010.png",
        instruction: "다음 글 또는 그래프의 내용과 같은 것을 고르십시오.",
        instructionZh: "阅读图表，选择与数据一致的一项。",
        passage: "여행사를 선택할 때 중요하게 생각하는 것: 가격 48%, 여행 상품의 다양성 25%, 회사의 규모 16%, 이용 후기 9%, 기타 2%.",
        passageZh: "选择旅行社时最看重的因素：价格48%，旅游产品多样性25%，公司规模16%，用户评价9%，其他2%。调查对象为1600名成年男女。",
        options: ["회사의 규모가 중요하다고 응답한 비율이 가장 낮다.", "가격을 중요하게 생각하는 사람이 전체의 반을 넘는다.", "이용 후기가 여행 상품의 다양성보다 중요하다는 응답이 두 배 이상 많다.", "여행 상품의 다양성보다 회사의 규모를 중요하게 생각하는 사람이 더 적다."],
        optionTranslations: ["认为公司规模重要的比例最低。", "看重价格的人超过总数的一半。", "认为用户评价比产品多样性重要的人多两倍以上。", "看重公司规模的人比看重旅游产品多样性的人更少。"],
        answer: 3,
        answerZh: "看重公司规模的人比看重旅游产品多样性的人更少。",
        explanation: "회사의 규모는 16%, 여행 상품의 다양성은 25%이므로 회사 규모를 고른 사람이 더 적습니다.",
        explanationZh: "公司规模为16%，产品多样性为25%，因此看重公司规模的人更少。",
        source: "第102届 TOPIK II 阅读 10题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q011",
        materialImage: "assets/materials/topik102-reading/question/q011.png",
        instruction: "다음 글 또는 그래프의 내용과 같은 것을 고르십시오.",
        instructionZh: "阅读短文，选择与原文内容一致的一项。",
        passage: "지난달 문을 연 우표 박물관이 시민들에게 사랑을 받고 있다. 박물관 내 역사실에서는 우표의 역사를 한눈에 볼 수 있다. 또 어린이 체험실에서는 향기 나는 우표의 향을 맡거나 나무 우표 등을 만져 볼 수 있다. 자신의 사진이 들어간 우표도 직접 만들 수 있다. 편지를 써서 넣으면 일 년 뒤에 받아 볼 수 있는 박물관의 '느린 우체통'도 인기를 끌고 있다.",
        passageZh: "上个月开馆的邮票博物馆深受市民喜爱。历史室可以了解邮票历史；儿童体验室可以闻香味邮票、触摸木制邮票，还能亲手制作带自己照片的邮票。馆内的“慢邮筒”可投递信件，并在一年后收到。",
        options: ["이 박물관은 일 년 전부터 운영을 시작했다.", "이 박물관에서는 직접 우표를 만들어 볼 수 있다.", "이 박물관의 체험실에 있는 우표는 만질 수 없다.", "이 박물관의 느린 우체통으로는 편지를 보내지 못한다."],
        optionTranslations: ["这家博物馆从一年前开始运营。", "在这家博物馆可以亲手制作邮票。", "不能触摸体验室里的邮票。", "不能通过慢邮筒寄信。"],
        answer: 1,
        answerZh: "在这家博物馆可以亲手制作邮票。",
        explanation: "자신의 사진이 들어간 우표를 직접 만들 수 있다고 했으므로 ②가 맞습니다.",
        explanationZh: "短文明确说可以亲手制作带自己照片的邮票，因此第二项正确。",
        source: "第102届 TOPIK II 阅读 11题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q012",
        materialImage: "assets/materials/topik102-reading/question/q012.png",
        instruction: "다음 글 또는 그래프의 내용과 같은 것을 고르십시오.",
        instructionZh: "阅读新闻短文，选择与原文内容一致的一项。",
        passage: "휴일에 산을 오르던 경찰이 등산객을 구조했다. 지난 1일 김민수 경위는 인주산 정상에서 한 여성이 쓰러져 있는 것을 발견했다. 김 경위는 바로 여성의 체온이 떨어지지 않게 겉옷을 벗어서 덮어 주고 119에 신고했다. 이후 김 경위는 구조대 차량이 올 수 있는 산 중턱 대피소까지 여성을 업고 뛰어 내려갔다. 병원으로 이송된 여성은 치료를 받고 건강을 되찾았다.",
        passageZh: "休息日登山的警察救助了一名登山者。1日，金民秀警卫在仁州山山顶发现一名倒地女子。他脱下外套盖住女子以防体温下降，并拨打119。随后他背着女子跑到救援车辆可到达的半山腰避难所。女子被送医治疗后恢复健康。",
        options: ["한 등산객이 산 정상에 쓰러져 있었다.", "김 경위는 대피소까지 차량으로 이동했다.", "구조대가 등산객을 업고 병원으로 뛰어갔다.", "김 경위는 등산객의 신고를 받고 산에 올라갔다."],
        optionTranslations: ["一名登山者倒在山顶。", "金警卫乘车前往避难所。", "救援队背着登山者跑去医院。", "金警卫接到登山者报警后上山。"],
        answer: 0,
        answerZh: "一名登山者倒在山顶。",
        explanation: "김 경위가 산 정상에서 쓰러진 여성을 발견했다고 했으므로 ①이 맞습니다.",
        explanationZh: "原文第一段说明金警卫在山顶发现倒地女子，所以第一项与原文一致。",
        source: "第102届 TOPIK II 阅读 12题"
      }
    ]
  },
  {
    id: "topik-ii-reading-102-cohesion-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "reading",
    title: "TOPIK II 阅读：句序与语境衔接",
    skillLabel: "句序与语境衔接",
    matchTerms: ["句子连接判断"],
    trainingPoint: "利用指代、因果、时间顺序和上下文搭配，判断句子顺序或空格表达",
    sourceTitle: "第102届 TOPIK II 阅读真题",
    sourceDetail: "13-18题 · 原题图与答案核对",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-reading-102-q013",
        materialImage: "assets/materials/topik102-reading/question/q013.png",
        instruction: "다음을 순서에 맞게 배열한 것을 고르십시오.",
        instructionZh: "将四句话按正确顺序排列。",
        passage: "(가) 그래서 껍질째 먹기도 편하고 딱딱하지 않아서 식감도 좋다.\n(나) 신비 복숭아는 2017년에 한국에 처음 소개된 여름 과일이다.\n(다) 다른 복숭아에 비해 이른 시기에 먹을 수 있다는 것도 장점이다.\n(라) 껍질이 얇은 복숭아와 속이 부드러운 복숭아의 장점을 결합해 만들었다.",
        passageZh: "（甲）所以连皮吃也很方便，而且不硬，口感很好。（乙）神秘桃是2017年首次引入韩国的夏季水果。（丙）比其他桃子更早上市也是它的优点。（丁）它结合了皮薄桃子和果肉柔软桃子的优点制成。",
        options: ["(나)-(라)-(가)-(다)", "(나)-(가)-(다)-(라)", "(라)-(나)-(다)-(가)", "(라)-(다)-(가)-(나)"],
        optionTranslations: ["乙-丁-甲-丙", "乙-甲-丙-丁", "丁-乙-丙-甲", "丁-丙-甲-乙"],
        answer: 0,
        answerZh: "乙-丁-甲-丙",
        explanation: "과일을 먼저 소개한 뒤 만드는 방식을 설명하고, '그래서'로 결과를 연결한 다음 추가 장점을 제시합니다.",
        explanationZh: "先介绍这种水果，再说明培育方式；“所以”承接制作特点得出食用感受，最后补充提早上市的另一项优点。",
        source: "第102届 TOPIK II 阅读 13题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q014",
        materialImage: "assets/materials/topik102-reading/question/q014.png",
        instruction: "다음을 순서에 맞게 배열한 것을 고르십시오.",
        instructionZh: "将四句话按正确顺序排列。",
        passage: "(가) 아이가 감기에 걸려 밤새 큰 소리로 울었다.\n(나) 아주머니는 아이가 많이 아팠냐며 오히려 걱정해 주셨다.\n(다) 아침에 아이와 병원에 가려고 집을 나서다 옆집 아주머니를 만났다.\n(라) 나는 우는 아이를 달래면서도 울음소리에 이웃들이 깰까 봐 걱정했다.",
        passageZh: "（甲）孩子感冒了，整夜大声哭。（乙）邻居阿姨反而关心地问孩子是不是病得很重。（丙）早上我带孩子去医院，出门时遇到了隔壁阿姨。（丁）我一边哄哭泣的孩子，一边担心哭声会吵醒邻居。",
        options: ["(가)-(나)-(라)-(다)", "(가)-(라)-(다)-(나)", "(나)-(가)-(다)-(라)", "(나)-(다)-(라)-(가)"],
        optionTranslations: ["甲-乙-丁-丙", "甲-丁-丙-乙", "乙-甲-丙-丁", "乙-丙-丁-甲"],
        answer: 1,
        answerZh: "甲-丁-丙-乙",
        explanation: "밤에 아이가 운 사건과 화자의 걱정이 먼저 나오고, 다음 날 이웃을 만난 뒤 이웃의 반응이 이어집니다.",
        explanationZh: "先发生孩子夜里哭泣并引出“我”担心吵到邻居；第二天出门遇见邻居，最后才是邻居的回应。",
        source: "第102届 TOPIK II 阅读 14题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q015",
        materialImage: "assets/materials/topik102-reading/question/q015.png",
        instruction: "다음을 순서에 맞게 배열한 것을 고르십시오.",
        instructionZh: "将四句话按正确顺序排列。",
        passage: "(가) 최근 온라인 가구 구매가 늘면서 반품 사례가 많아지고 있다.\n(나) 그런데 비싼 반품 비용으로 인해 피해를 보는 소비자가 늘고 있다.\n(다) 따라서 소비자는 구매 전에 반품 비용과 조건을 잘 확인해야 한다.\n(라) 업체가 까다로운 조건을 내세워 반품을 거절하는 경우까지 발생한다.",
        passageZh: "（甲）最近网上购买家具增加，退货案例也越来越多。（乙）但是，高昂的退货费用使受损的消费者增加。（丙）因此，消费者购买前应仔细确认退货费用和条件。（丁）甚至出现商家提出苛刻条件、拒绝退货的情况。",
        options: ["(가)-(나)-(라)-(다)", "(가)-(라)-(다)-(나)", "(라)-(가)-(나)-(다)", "(라)-(다)-(가)-(나)"],
        optionTranslations: ["甲-乙-丁-丙", "甲-丁-丙-乙", "丁-甲-乙-丙", "丁-丙-甲-乙"],
        answer: 0,
        answerZh: "甲-乙-丁-丙",
        explanation: "현상을 제시하고 '그런데'로 피해를 설명한 뒤 구체적인 거절 사례를 덧붙이고, '따라서'로 해결 행동을 제안합니다.",
        explanationZh: "先提出退货增多的现象，“但是”转入消费者损失，再补充商家拒绝退货的具体问题，最后用“因此”提出购买前确认条件的建议。",
        source: "第102届 TOPIK II 阅读 15题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q016",
        materialImage: "assets/materials/topik102-reading/question/q016.png",
        instruction: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最适合填入空格的表达。",
        passage: "북극여우는 계절에 따라 털 색깔을 바꾸는 동물이다. 겨울에는 눈과 같은 흰색으로, 여름에는 바위나 흙과 비슷한 갈색빛으로 바뀐다. 이러한 털 색깔의 변화로 북극여우는 몸을 숨길 곳이 없는 북극의 특수한 환경에서도 천적으로부터 자신을 보호하고 사냥할 때 (   ) 수 있다.",
        passageZh: "北极狐会随季节改变毛色：冬天变成像雪一样的白色，夏天变成像岩石或泥土一样的棕色。凭借这种变化，它即使在无处藏身的北极环境中，也能躲避天敌，并在捕猎时（　）。",
        options: ["동료와 무리를 이룰", "먹잇감에 몰래 다가갈", "체온을 적절히 유지할", "발자국을 남기지 않을"],
        optionTranslations: ["与同伴组成群体", "悄悄靠近猎物", "适当维持体温", "不留下脚印"],
        answer: 1,
        answerZh: "悄悄靠近猎物",
        explanation: "주변 색과 비슷한 털은 몸을 숨겨 주므로 사냥할 때 먹잇감에 들키지 않고 다가갈 수 있습니다.",
        explanationZh: "毛色与周围环境接近的作用是伪装，因此捕猎时可以不被发现地靠近猎物。",
        source: "第102届 TOPIK II 阅读 16题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q017",
        materialImage: "assets/materials/topik102-reading/question/q017.png",
        instruction: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最适合填入空格的表达。",
        passage: "요즘 연필을 잡고 글씨를 반듯하게 쓰는 것에 어려움을 느끼는 아이가 많다. 어린 나이부터 전자 기기를 장시간 사용한 탓이다. 전자 기기의 화면을 단순히 누르거나 미는 동작을 반복하다 보면 손에 있는 근육을 (   ) 못한다. 그래서 전문가들은 소근육이 발달하는 11세까지 손가락을 움직여서 하는 놀이를 많이 하도록 하는 것이 좋다고 말한다.",
        passageZh: "如今很多孩子觉得握铅笔、把字写端正很困难，这是从小长时间使用电子设备造成的。反复点击或滑动屏幕，会导致手部肌肉不能（　）。因此专家建议在小肌肉发育到11岁前，多做活动手指的游戏。",
        options: ["제대로 감싸지", "빠르게 줄이지", "충분히 사용하지", "완전히 회복하지"],
        optionTranslations: ["正确包裹", "迅速减少", "充分使用", "完全恢复"],
        answer: 2,
        answerZh: "充分使用",
        explanation: "화면을 누르거나 미는 단순 동작만 반복하면 손의 여러 근육을 충분히 사용하지 못한다는 흐름입니다.",
        explanationZh: "上下文强调电子设备动作单一，无法锻炼手部小肌肉，因此应填“不能充分使用”。",
        source: "第102届 TOPIK II 阅读 17题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q018",
        materialImage: "assets/materials/topik102-reading/question/q018.png",
        instruction: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最适合填入空格的表达。",
        passage: "고인돌은 옛날 청동기 시대의 무덤이다. 고인돌은 받침돌 두 개를 세우고 그 위에 덮개돌을 얹은 형태인데 덮개돌 하나의 무게가 수십 톤에 달하는 것도 있다. 이와 같이 거대한 돌을 운반하고 세우려면 그만큼 많은 사람들의 힘이 필요했다. 그래서 고인돌은 사람들을 불러 모아 무덤 만드는 일을 시킬 수 있을 정도로 (   ) 사람의 무덤이었을 것으로 보인다.",
        passageZh: "支石墓是青铜器时代的坟墓，由两块支撑石和上方盖石构成，有的盖石重达数十吨。搬运并立起巨石需要许多人的力量，因此这种墓主人应该能召集人们并让他们修建坟墓，是一位（　）的人。",
        options: ["대단한 권력을 가진", "체력이 굉장히 약한", "무기를 잘 제작하는", "수명이 남들보다 짧은"],
        optionTranslations: ["拥有巨大权力", "体力非常虚弱", "擅长制造武器", "寿命比别人短"],
        answer: 0,
        answerZh: "拥有巨大权力",
        explanation: "많은 사람을 모아 거대한 무덤을 만들게 할 수 있었다는 사실은 무덤의 주인이 큰 권력을 가졌음을 뜻합니다.",
        explanationZh: "能召集大量人力完成巨石工程，说明墓主人拥有足够大的权力。",
        source: "第102届 TOPIK II 阅读 18题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q019",
        materialImage: "assets/materials/topik102-reading/question/q019.png",
        instruction: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最适合填入空格的连接表达。",
        passage: "도시의 도로는 대부분 물이 스며들지 않는 아스팔트로 뒤덮여 있다. 그래서 비가 오면 빗물이 지하로 잘 흘러 들어가지 못해 지하수가 부족해지고 도로가 물에 잠기는 일도 자주 발생한다. 그런데 최근 물이 잘 스며드는 도로 포장재가 개발되었다. 이 포장재에는 미세한 구멍이 많다. 그래서 빗물이 쉽게 통과해 지하수 자원이 보충된다. (   ) 하수구로 몰리는 빗물의 양이 줄어 도로 침수의 위험도 줄어들게 된다.",
        passageZh: "城市道路大多铺着不透水的沥青，下雨时雨水难以渗入地下，既造成地下水不足，也容易积水。新型透水铺装有许多微孔，雨水可通过并补充地下水；（　）流入下水道的雨水量也会减少，从而降低道路内涝风险。",
        options: ["또한", "비록", "과연", "반면"],
        optionTranslations: ["此外", "虽然", "果然", "反而/另一方面"],
        answer: 0,
        answerZh: "此外",
        explanation: "앞 문장의 지하수 보충 효과에 이어 도로 침수 위험 감소라는 추가 효과를 제시하므로 '또한'이 알맞습니다.",
        explanationZh: "空格后继续补充透水铺装的另一项好处，与前句是并列递进关系，因此用“此外”。",
        source: "第102届 TOPIK II 阅读 19题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q021",
        materialImage: "assets/materials/topik102-reading/question/q021.png",
        instruction: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最适合填入空格的惯用表达。",
        passage: "인주시의 한 거리가 식당과 카페가 모인 먹거리 골목으로 특화되면서 최근 이곳을 찾는 사람들이 늘고 있다. 그런데 차량 통행을 막고 길 한가운데에서 사진을 찍거나 횡단보도 위에서 삼각대를 세우고 촬영하는 등 일부 방문객의 행동이 (   ) 한다. 차량이 오는 것을 보지 못하고 촬영을 하다 사고가 날 뻔한 위험한 상황이 자주 발생하면서 운전자와 방문객 간에 다투는 일도 잦아지고 있다.",
        passageZh: "仁州市一条街因聚集餐厅和咖啡馆而成为美食街，访客增多。但部分访客阻碍车辆，在路中央拍照或在斑马线上架三脚架，这些行为让人（　）。因拍摄时没看到来车而险些发生事故的情况频繁出现，司机与访客的争执也越来越多。",
        options: ["목이 빠지게", "한숨을 돌리게", "눈살을 찌푸리게", "코가 납작해지게"],
        optionTranslations: ["望眼欲穿", "得以喘口气", "令人皱眉反感", "挫掉锐气"],
        answer: 2,
        answerZh: "令人皱眉反感",
        explanation: "교통을 방해하고 사고 위험을 만드는 행동에 대한 부정적인 평가이므로 '눈살을 찌푸리게 한다'가 자연스럽습니다.",
        explanationZh: "上下文批评阻碍交通并制造事故风险的行为，因此应填表示反感的“令人皱眉”。",
        source: "第102届 TOPIK II 阅读 21题"
      }
    ]
  },
  {
    id: "topik-ii-reading-102-passage-v1",
    sourceType: "official-material",
    exam: "TOPIK",
    level: "II",
    category: "reading",
    title: "TOPIK II 阅读：短文内容理解",
    skillLabel: "短文内容理解",
    matchTerms: ["短文大意理解"],
    trainingPoint: "概括段落主题并逐项核对原文事实",
    sourceTitle: "第102届 TOPIK II 阅读真题",
    sourceDetail: "20、22题 · 原题图与答案核对",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-ii-reading-102-q020",
        materialImage: "assets/materials/topik102-reading/question/q020.png",
        instruction: "윗글의 주제로 가장 알맞은 것을 고르십시오.",
        instructionZh: "选择最符合短文主旨的一项。",
        passage: "도시의 도로는 대부분 물이 스며들지 않는 아스팔트로 뒤덮여 있어 비가 오면 지하수가 부족해지고 도로가 물에 잠기는 일도 자주 발생한다. 최근 개발된 도로 포장재에는 미세한 구멍이 많아 빗물이 쉽게 통과하고 지하수 자원이 보충된다. 또한 하수구로 몰리는 빗물의 양이 줄어 도로 침수의 위험도 줄어든다.",
        passageZh: "城市道路大多铺着不透水沥青，雨水难以进入地下，导致地下水不足并容易内涝。新型透水铺装带有许多微孔，能让雨水渗透、补充地下水，同时减少流入下水道的雨水，降低道路积水风险。",
        options: ["빗물은 지하수 오염을 줄이는 데 중요한 역할을 한다.", "도로 포장재에는 도시마다의 환경적 특성이 반영되어 있다.", "도로 침수는 도시에 매우 심각한 피해를 입히는 요인 중 하나이다.", "새 포장재가 지하수 부족과 도로 침수 문제 해결에 도움이 될 것이다."],
        optionTranslations: ["雨水在减少地下水污染方面发挥重要作用。", "道路铺装材料反映了各城市的环境特点。", "道路内涝是给城市造成严重损害的因素之一。", "新型铺装材料将有助于解决地下水不足和道路内涝问题。"],
        answer: 3,
        answerZh: "新型铺装材料将有助于解决地下水不足和道路内涝问题。",
        explanation: "글은 새 포장재가 빗물을 통과시켜 지하수를 보충하고 침수 위험을 낮춘다는 두 효과를 중심으로 설명합니다.",
        explanationZh: "全文围绕新型透水铺装的两项作用展开：补充地下水并降低内涝风险，所以第四项最完整。",
        source: "第102届 TOPIK II 阅读 20题"
      },
      {
        materialQuestionId: "topik-ii-reading-102-q022",
        materialImage: "assets/materials/topik102-reading/question/q022.png",
        instruction: "윗글의 내용과 같은 것을 고르십시오.",
        instructionZh: "选择与短文内容一致的一项。",
        passage: "인주시의 한 거리가 식당과 카페가 모인 먹거리 골목으로 특화되면서 방문객이 늘고 있다. 그러나 일부 방문객이 차량 통행을 막고 길 한가운데나 횡단보도에서 촬영해 사고가 날 뻔한 상황이 자주 발생하고, 운전자와 방문객 간에 다투는 일도 잦아지고 있다.",
        passageZh: "仁州市一条聚集餐厅和咖啡馆的美食街访客增加。但部分访客阻碍车辆，在路中央或斑马线上拍摄，险些发生事故的情况频繁出现，司机与访客间的争执也越来越多。",
        options: ["이 거리에서 사진을 찍는 방문객이 줄어들었다.", "인주시가 최근 이 거리의 차량 통행을 금지했다.", "이 거리의 방문객과 운전자 사이에 갈등이 늘고 있다.", "이 거리에는 식당이 없어 방문객들이 불편을 겪고 있다."],
        optionTranslations: ["在这条街拍照的访客减少了。", "仁州市最近禁止车辆通行这条街。", "这条街的访客与司机之间的矛盾正在增加。", "这条街没有餐厅，访客感到不便。"],
        answer: 2,
        answerZh: "这条街的访客与司机之间的矛盾正在增加。",
        explanation: "글의 마지막에 위험한 촬영 때문에 운전자와 방문객 간에 다투는 일이 잦아지고 있다고 했습니다.",
        explanationZh: "原文末句明确说司机与访客之间的争执越来越频繁，因此第三项与原文一致。",
        source: "第102届 TOPIK II 阅读 22题"
      }
    ]
  },
  {
    id: "topik-i-reading-signs-v1",
    sourceType: "user-material",
    exam: "TOPIK",
    level: "I",
    category: "reading",
    title: "TOPIK I 阅读：标识与公告理解",
    skillLabel: "标识与公告理解",
    matchTerms: ["公告信息读取", "广告信息读取", "标识与公告理解"],
    trainingPoint: "从广告、公告和便条中核对时间、对象、条件和活动信息",
    sourceTitle: "用户资料《完全掌握 TOPIK I 初级阅读》",
    sourceDetail: "标识/公告阅读样本 · 5题",
    usage: "daily-practice",
    questions: [
      {
        materialQuestionId: "topik-i-reading-signs-v1-q100",
        materialImage: "assets/materials/topik1-reading/question/question-100-korean.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读招聘广告，选择与内容不一致的一项。",
        passageZh: "咖啡专卖店招聘兼职学生。工作时间是周一、周三、周五上午10点到下午4点，薪水是每小时6000韩元，条件是男女大学生。",
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
        materialImage: "assets/materials/topik1-reading/question/question-101-korean.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读音乐会海报，选择与内容不一致的一项。",
        passageZh: "首尔樱花音乐会在4月4日到4月6日举行。不同日期的演出时间不同，其中4月6日有下午4点和晚上7点两场。",
        options: ["서울 벚꽃 음악회는 3일 동안 열립니다.", "서울 벚꽃 음악회는 하루에 두 번씩 열립니다.", "서울 벚꽃 음악회는 4월에 열립니다.", "서울 벚꽃 음악회는 누구나 참여할 수 있습니다."],
        optionTranslations: ["首尔樱花音乐会举办3天。", "首尔樱花音乐会每天举行两场。", "首尔樱花音乐会在4月举行。", "首尔樱花音乐会任何人都可以参加。"],
        answer: 1,
        answerZh: "首尔樱花音乐会每天举行两场。",
        explanation: "4월 4일은 정오 1회, 4월 5일은 저녁 7시 1회, 4월 6일은 오후 4시와 저녁 7시 2회입니다.",
        explanationZh: "海报中三天的场次不同，并不是每天都有两场，所以该选项不符合内容。",
        source: "用户资料《完全掌握 TOPIK I 初级阅读》p.85 · 标识阅读"
      },
      {
        materialQuestionId: "topik-i-reading-signs-v1-q102",
        materialImage: "assets/materials/topik1-reading/question/question-102-korean.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读促销信息，选择与内容不一致的一项。",
        passageZh: "昌原西瓜促销从5月10日起连续3天，在市政府前广场举行。西瓜比原价便宜10%，现场还有免费试吃会。",
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
        materialImage: "assets/materials/topik1-reading/question/question-103-korean.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读免费韩文教室公告，选择与内容不一致的一项。",
        passageZh: "免费韩文教室面向想学习韩文的成年男女，课程从10月开始，需要在9月20日前申请。",
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
        materialImage: "assets/materials/topik1-reading/question/question-104-korean.png",
        stem: "다음을 읽고 내용과 다른 것을 고르십시오.",
        stemZh: "阅读便条内容，选择与内容不一致的一项。",
        passageZh: "明明写给珍妮的便条里说，珍妮这两天都没有来学校，明明担心她是不是生病了；因为明天有考试，所以希望珍妮来学校。",
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
const materialPracticeBank = realMaterialQuestionBank;
function topikIListeningFallback(audioText, transcriptZh, question = {}) {
  return { audioText, transcript: audioText, transcriptZh, questionType: "topik1_listening", ...question };
}
const topikIListeningFallbackQuestions = [
  topikIListeningFallback("여자: 준호 씨, 오늘 한국어 수업에 와요? 남자: 네, 두 시에 교실에 가요. 여자: 조금 일찍 오세요. 남자: 네, 알겠습니다.", "女：俊浩，你今天来上韩语课吗？男：是的，我两点去教室。女：请稍微早点来。男：好的，知道了。", { stem: "남자는 몇 시에 교실에 갑니까?", stemZh: "男生几点去教室？", options: ["한 시", "두 시", "세 시", "네 시"], optionTranslations: ["一点", "两点", "三点", "四点"], answer: 1, answerZh: "两点", explanation: "남자는 두 시에 교실에 간다고 했습니다.", explanationZh: "男生说两点去教室，所以答案是“两点”。", source: "TOPIK I 听力：时间信息" }),
  topikIListeningFallback("남자: 수미 씨, 지금 어디에 가요? 여자: 우체국에 가요. 편지를 보내려고 해요. 남자: 우체국은 은행 옆에 있어요. 여자: 네, 고마워요.", "男：秀美，你现在去哪里？女：我去邮局，想寄信。男：邮局在银行旁边。女：好的，谢谢。", { stem: "여자는 어디에 갑니까?", stemZh: "女生去哪里？", options: ["은행", "우체국", "도서관", "병원"], optionTranslations: ["银行", "邮局", "图书馆", "医院"], answer: 1, answerZh: "邮局", explanation: "여자는 편지를 보내려고 우체국에 간다고 했습니다.", explanationZh: "女生说为了寄信要去邮局，所以答案是“邮局”。", source: "TOPIK I 听力：地点信息" }),
  topikIListeningFallback("여자: 밖에 비가 많이 와요. 우산을 가져가세요. 남자: 우산이 어디에 있어요? 여자: 문 옆에 있어요. 남자: 네, 가져갈게요.", "女：外面雨下得很大，请带伞。男：伞在哪里？女：在门旁边。男：好的，我会带上。", { stem: "여자는 남자에게 무엇을 가져가라고 했습니까?", stemZh: "女生让男生带什么？", options: ["우산", "가방", "책", "모자"], optionTranslations: ["雨伞", "包", "书", "帽子"], answer: 0, answerZh: "雨伞", explanation: "여자는 비가 오니까 우산을 가져가라고 했습니다.", explanationZh: "女生因为下雨让男生带伞，所以答案是“雨伞”。", source: "TOPIK I 听力：物品信息" }),
  topikIListeningFallback("남자: 학교에 어떻게 가요? 여자: 저는 버스를 타고 가요. 집 앞에서 12번 버스를 타면 돼요. 남자: 시간이 얼마나 걸려요? 여자: 십 분쯤 걸려요.", "男：你怎么去学校？女：我坐公交车去。在家门口坐12路公交车就可以。男：要花多长时间？女：大约十分钟。", { stem: "여자는 학교에 어떻게 갑니까?", stemZh: "女生怎么去学校？", options: ["걸어서", "버스로", "지하철로", "택시로"], optionTranslations: ["步行", "坐公交车", "坐地铁", "坐出租车"], answer: 1, answerZh: "坐公交车", explanation: "여자는 버스를 타고 학교에 간다고 했습니다.", explanationZh: "女生说自己坐公交车去学校，所以答案是“坐公交车”。", source: "TOPIK I 听力：交通方式" }),
  topikIListeningFallback("여자: 한식당입니다. 무엇을 도와드릴까요? 남자: 오늘 저녁 일곱 시에 세 명 자리를 예약하고 싶어요. 여자: 네, 창가 자리로 준비하겠습니다. 남자: 감사합니다.", "女：这里是韩餐厅，有什么可以帮您？男：我想预约今晚七点的三人座。女：好的，会为您准备靠窗的位置。男：谢谢。", { stem: "대화 내용과 같은 것을 고르십시오.", stemZh: "请选择与对话内容一致的一项。", options: ["남자는 세 명 자리를 예약합니다", "남자는 점심에 식당에 갑니다", "창가 자리는 없습니다", "예약 시간은 여덟 시입니다"], optionTranslations: ["男生预约三人座", "男生中午去餐厅", "没有靠窗的位置", "预约时间是八点"], answer: 0, answerZh: "男生预约三人座", explanation: "남자는 오늘 저녁 일곱 시에 세 명 자리를 예약했습니다.", explanationZh: "男生预约了今晚七点的三人座，所以第一项与对话一致。", source: "TOPIK I 听力：内容一致" })
];

const listeningFallbackScript = "남자: 수진 씨, 오늘 동아리 회의에 못 올 것 같아요. 갑자기 아르바이트 시간이 바뀌었거든요. 여자: 그래요? 그럼 내일 오전까지 의견을 문자로 보내 주세요. 회의에서 대신 말해 줄게요. 남자: 고마워요. 포스터 디자인에 대한 의견을 정리해서 보낼게요.";
const listeningFallbackScriptZh = "男：秀珍，我今天可能去不了社团会议了。突然打工时间变了。女：是吗？那请你明天上午之前把意见用短信发给我吧。我会在会议上替你说。男：谢谢。我会整理好关于海报设计的意见发过去。";
function topikIIListeningFallback(audioText, transcriptZh, question = {}) {
  return { audioText, transcript: audioText, transcriptZh, questionType: "topik2_listening", ...question };
}
const listeningFallbackQuestions = [
  topikIIListeningFallback(listeningFallbackScript, listeningFallbackScriptZh, { stem: "남자가 오늘 동아리 회의에 못 가는 이유는 무엇입니까?", stemZh: "男生今天不能参加社团会议的原因是什么？", options: ["포스터를 아직 만들지 못해서", "아르바이트 시간이 바뀌어서", "의견을 정리하지 못해서", "내일 오전에 약속이 있어서"], optionTranslations: ["因为还没做完海报", "因为打工时间变了", "因为还没整理好意见", "因为明天上午有约"], answer: 1, answerZh: "因为打工时间变了", explanation: "남자는 갑자기 아르바이트 시간이 바뀌어서 오늘 동아리 회의에 못 간다고 말했습니다.", explanationZh: "男生说自己突然打工时间变了，所以今天不能去社团会议。", source: "TOPIK II listening reason type" }),
  topikIIListeningFallback("여자: 지훈 씨, 오늘 스터디는 어디에서 해요? 남자: 원래 도서관에서 하려고 했는데 자리가 없어서 학생회관 2층에서 해요. 여자: 알겠어요. 여섯 시까지 갈게요.", "女：志勋，今天学习小组在哪里进行？男：原来想在图书馆进行，但因为没有座位，改在学生会馆二楼。女：知道了，我会在六点前到。", { stem: "오늘 스터디는 어디에서 합니까?", stemZh: "今天的学习小组在哪里进行？", options: ["도서관", "학생회관 2층", "강의실", "식당"], optionTranslations: ["图书馆", "学生会馆二楼", "教室", "食堂"], answer: 1, answerZh: "学生会馆二楼", explanation: "남자는 도서관에 자리가 없어서 학생회관 2층에서 스터디를 한다고 했습니다.", explanationZh: "男生说图书馆没有座位，所以学习小组改在学生会馆二楼。", source: "TOPIK II listening place type" }),
  topikIIListeningFallback("남자: 민지 씨, 발표 연습은 다 했어요? 여자: 아직 못 했어요. 오늘 세 시에 204호에서 같이 연습할래요? 남자: 좋아요. 제가 발표 자료를 가져갈게요.", "男：敏智，发表练习都做完了吗？女：还没有。今天三点在204教室一起练习好吗？男：好，我会带发表资料过去。", { stem: "두 사람은 어디에서 발표 연습을 합니까?", stemZh: "两个人在哪里进行发表练习？", options: ["204호", "도서관", "학생회관", "회의실"], optionTranslations: ["204教室", "图书馆", "学生会馆", "会议室"], answer: 0, answerZh: "204教室", explanation: "여자는 오늘 세 시에 204호에서 같이 연습하자고 했습니다.", explanationZh: "女生提议今天三点在204教室一起练习。", source: "TOPIK II listening place detail type" }),
  topikIIListeningFallback("남자: 예약한 김민수인데요. 창가 자리를 부탁드렸어요. 여자: 네, 네 분 자리로 준비했습니다. 일곱 시까지 오시면 됩니다. 남자: 감사합니다. 조금 일찍 가겠습니다.", "男：我是预约过的金民秀。我之前要求了靠窗的位置。女：好的，已经准备了四人座。七点前过来就可以。男：谢谢，我会稍微早点到。", { stem: "대화 내용과 같은 것을 고르십시오.", stemZh: "请选择与对话内容一致的一项。", options: ["남자는 식당 자리를 예약했습니다", "두 사람만 식사할 것입니다", "남자는 일곱 시 이후에 갑니다", "창가 자리는 준비할 수 없습니다"], optionTranslations: ["男生预约了餐厅座位", "只有两个人用餐", "男生七点以后到", "无法准备靠窗座位"], answer: 0, answerZh: "男生预约了餐厅座位", explanation: "남자는 예약한 사람이라고 말했고 창가 자리도 부탁했다고 했습니다.", explanationZh: "男生说明自己已经预约，并确认了靠窗的四人座。", source: "TOPIK II listening matching type" }),
  topikIIListeningFallback("여자: 실례합니다. 조금 전에 지하철에서 검은색 지갑을 잃어버렸어요. 역무원: 어느 칸에 타셨어요? 여자: 세 번째 칸이었고, 지갑 안에 학생증이 있어요.", "女：不好意思，我刚才在地铁里丢了一个黑色钱包。站务员：您坐的是哪一节车厢？女：第三节，钱包里有学生证。", { stem: "여자가 역무원에게 말하는 목적은 무엇입니까?", stemZh: "女生对站务员说这些话的目的是什么？", options: ["지갑을 잃어버렸다고 신고하려고", "지하철 시간을 확인하려고", "학생증을 새로 만들려고", "세 번째 칸을 예약하려고"], optionTranslations: ["为了报告钱包丢失", "为了确认地铁时间", "为了补办学生证", "为了预约第三节车厢"], answer: 0, answerZh: "为了报告钱包丢失", explanation: "여자는 지하철에서 잃어버린 검은색 지갑을 찾기 위해 역무원에게 말하고 있습니다.", explanationZh: "女生是在向站务员报告自己在地铁上丢失了黑色钱包。", source: "TOPIK II listening purpose type" })
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
let practiceSessionStartedAt = "";
let practiceQuestionTimer = { elapsedMs: 0, visibleStartedAt: 0 };
const LISTENING_PLAY_LIMIT = 2;
const LISTENING_TTS_RATE = 1;
let listeningPlayCounts = {};
let listeningPlaybackState = { key: "", status: "idle", message: "" };
let listeningIsSpeaking = false;
let activeCalendarFilter = "all";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const cloud = { config: null, session: null, saveTimer: null, syncing: false, savePending: false, lastError: "" };
const dailyReminder = { timer: null };

function startPracticeQuestionTimer() {
  practiceQuestionTimer = {
    elapsedMs: 0,
    visibleStartedAt: document.visibilityState === "visible" ? Date.now() : 0
  };
}

function pausePracticeQuestionTimer() {
  if (!practiceQuestionTimer.visibleStartedAt) return;
  practiceQuestionTimer.elapsedMs += Math.max(0, Date.now() - practiceQuestionTimer.visibleStartedAt);
  practiceQuestionTimer.visibleStartedAt = 0;
}

function practiceQuestionElapsedSeconds() {
  const activeMs = practiceQuestionTimer.visibleStartedAt
    ? Math.max(0, Date.now() - practiceQuestionTimer.visibleStartedAt)
    : 0;
  return Math.max(1, Math.round((practiceQuestionTimer.elapsedMs + activeMs) / 1000));
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    pausePracticeQuestionTimer();
    return;
  }
  if (!$("#practiceModal")?.classList.contains("hidden") && !questionGraded && !practiceQuestionTimer.visibleStartedAt) {
    practiceQuestionTimer.visibleStartedAt = Date.now();
  }
});

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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json"
  };
}

function cloudProxyFetch(path, options = {}) {
  const headers = options.headers || {};
  let payload = options.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); }
    catch { payload = {}; }
  }
  if (cloud.config?.provider === "native") {
    const authorization = headers.Authorization || "";
    const requestHeaders = {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {})
    };
    if (path.startsWith("/auth/v1/")) {
      let action = "";
      if (path.startsWith("/auth/v1/signup")) action = "signup";
      else if (path.includes("grant_type=password")) action = "signin";
      else if (path.includes("grant_type=refresh_token")) action = "refresh";
      else if (path === "/auth/v1/user") action = "user";
      else if (path === "/auth/v1/logout") action = "logout";
      return fetch("/api/cloud-auth", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ action, ...(payload || {}) })
      });
    }
    if (path.startsWith("/rest/v1/study_state")) {
      const action = String(options.method || "GET").toUpperCase() === "GET" ? "load" : "save";
      return fetch("/api/cloud-state", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ action, data: payload?.data })
      });
    }
  }
  return fetch("/api/cloud-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers.Authorization ? { Authorization: headers.Authorization } : {})
    },
    body: JSON.stringify({
      path,
      method: options.method || "GET",
      payload: payload ?? {},
      prefer: headers.Prefer || ""
    })
  });
}

function currentCloudState() {
  return {
    tasks,
    importedErrors: errorItems.filter(item => String(item.id).startsWith("imported-")),
    practiceErrors: errorItems.filter(item => String(item.id).startsWith("practice-")),
    settings: JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null"),
    onboarded: localStorage.getItem("topikPrototypeOnboarded") || "",
    planVersion: localStorage.getItem("topikPrototypePlanVersion") || "5",
    planScope: localStorage.getItem("topikPrototypePlanScope") || "",
    tomorrowFocus: localStorage.getItem("topikPrototypeTomorrowFocus") || "",
    dailyReminder: readReminderSettings(),
    rewards: readRewardState(),
    externalStudyRecords: readExternalStudyRecords()
  };
}

function cloudStateHasReviewNeed(data = {}) {
  return [...(data.importedErrors || []), ...(data.practiceErrors || [])].some(item => item && item.id);
}

function applyCloudState(data) {
  if (!data || typeof data !== "object") return;
  const localSettings = readStoredSettings();
  const cloudSettings = data.settings ? { ...readStudySettings(), ...data.settings } : null;
  const localScope = localSettings ? planScopeSignature({ ...readStudySettings(), ...localSettings }) : "";
  const cloudScope = cloudSettings ? planScopeSignature(cloudSettings) : "";
  const storedScope = localStorage.getItem("topikPrototypePlanScope") || "";
  const preferLocalSettings = Boolean(localSettings && storedScope && storedScope === localScope && cloudScope && localScope !== cloudScope);
  const effectiveSettings = preferLocalSettings && localSettings ? { ...readStudySettings(), ...localSettings } : (cloudSettings || readStudySettings());
  if (Array.isArray(data.importedErrors)) localStorage.setItem("topikPrototypeImportedErrors", JSON.stringify(data.importedErrors));
  if (Array.isArray(data.practiceErrors)) localStorage.setItem("topikPrototypePracticeErrors", JSON.stringify(data.practiceErrors));
  if (data.settings && !preferLocalSettings) localStorage.setItem("topikPrototypeSettings", JSON.stringify(data.settings));
  if (preferLocalSettings) localStorage.setItem("topikPrototypeNeedsCloudRepair", "yes");
  if (data.onboarded) localStorage.setItem("topikPrototypeOnboarded", data.onboarded);
  if (Array.isArray(data.tasks)) {
    const scopedTasks = constrainTasksToStudyScope(data.tasks, effectiveSettings, cloudStateHasReviewNeed(data));
    const migratedTasks = data.planVersion !== planSchemaVersion
      ? mergeGeneratedPlanWithLearningRecords(
        constrainTasksToStudyScope(generatePlanFromSettings(effectiveSettings), effectiveSettings, cloudStateHasReviewNeed(data)),
        scopedTasks
      )
      : scopedTasks;
    const effectiveScope = planScopeSignature(effectiveSettings);
    if (JSON.stringify(migratedTasks) !== JSON.stringify(data.tasks) || data.planVersion !== planSchemaVersion || (data.planScope && data.planScope !== effectiveScope)) {
      localStorage.setItem("topikPrototypeNeedsCloudRepair", "yes");
    }
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(migratedTasks));
    writePlanScope(effectiveSettings);
  }
  localStorage.setItem("topikPrototypePlanVersion", planSchemaVersion);
  if (data.tomorrowFocus) localStorage.setItem("topikPrototypeTomorrowFocus", data.tomorrowFocus);
  if (data.dailyReminder) localStorage.setItem("topikPrototypeDailyReminder", JSON.stringify(data.dailyReminder));
  if (data.rewards) localStorage.setItem("topikPrototypeRewards", JSON.stringify(data.rewards));
  if (Array.isArray(data.externalStudyRecords)) writeExternalStudyRecords(data.externalStudyRecords);
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
  const response = await cloudProxyFetch(path, {
    ...options,
    headers: { ...cloudHeaders(cloud.session?.access_token), ...(options.headers || {}) }
  });
  if (response.status === 401 && retry && cloud.session?.refresh_token) {
    const refreshed = await cloudProxyFetch("/auth/v1/token?grant_type=refresh_token", {
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
    const response = await cloudProxyFetch(path, { method: "POST", headers: cloudHeaders(), body: JSON.stringify({ email, password }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const rawMessage = payload.message || payload.msg || payload.error_description || payload.error || "操作失败";
      const friendlyMessage = /invalid api key/i.test(rawMessage)
        ? "云同步密钥无效，请检查Vercel中的SUPABASE_ANON_KEY"
        : /cloud service is temporarily unavailable|云同步服务当前不可用/i.test(rawMessage)
          ? "云同步服务当前不可用，请稍后再试"
        : /invalid login credentials/i.test(rawMessage)
          ? "邮箱或密码不正确"
          : /email not confirmed/i.test(rawMessage)
            ? "邮箱尚未确认，请先完成邮箱验证"
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
  } catch (error) {
    const message = String(error?.message || "");
    showToast(/failed to fetch|networkerror|load failed/i.test(message)
      ? "云同步服务当前不可用，请稍后再试"
      : (message || "操作失败，请重试"));
  }
  finally {
    button.disabled = false;
    button.textContent = mode === "signup" ? "注册账号" : "登录并同步";
  }
}

async function initializeCloud() {
  if (location.protocol === "file:") { updateCloudUI(); return; }
  try {
    const response = await fetch("/api/cloud-config", { cache: "no-store" });
    const payload = await response.json();
    const normalizedUrl = String(payload?.url || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/(?:rest|auth|storage)\/v1$/i, "");
    const provider = payload?.provider === "native" ? "native" : "supabase";
    cloud.config = {
      ...payload,
      provider,
      url: normalizedUrl,
      enabled: Boolean(payload?.enabled && (provider === "native" || normalizedUrl))
    };
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
      if (localStorage.getItem("topikPrototypeNeedsCloudRepair") === "yes") {
        localStorage.removeItem("topikPrototypeNeedsCloudRepair");
        await saveCloudState(false);
      }
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

function taskActualStudySeconds(task = {}) {
  return Math.max(0, Number(task.checkin?.actualSeconds || 0));
}

function latestTaskAdjustment(task = {}, types = []) {
  const allowed = new Set(Array.isArray(types) ? types : [types]);
  return [...(task.adjustments || [])].reverse().find(adjustment =>
    !allowed.size || allowed.has(adjustment.type)
  ) || null;
}

function resultPriorityAdjustment(task = {}) {
  return latestTaskAdjustment(task, ["result-priority"]);
}

function pendingTaskScheduleRank(task = {}) {
  return taskScheduledDate(task).getTime() / 60000 + clockToMinutes(task.start, 0);
}

function nextPendingTaskInCategory(sourceTask = {}) {
  const category = normalizeStudyCategory(sourceTask.category);
  return tasks
    .filter(task =>
      task.id !== sourceTask.id
      && task.status !== "cancelled"
      && !hasPracticeRecord(task)
      && normalizeStudyCategory(task.category) === category
    )
    .sort((first, second) => pendingTaskScheduleRank(first) - pendingTaskScheduleRank(second))[0] || null;
}

function applyPracticeResultToPlan(task = {}, result = {}) {
  const total = Math.max(0, Number(result.total || 0));
  const correct = Math.max(0, Number(result.correct || 0));
  const wrongCount = Math.max(0, total - correct);
  const rate = total ? Math.round(correct / total * 100) : 0;
  const at = new Date().toISOString();
  let planningImpact = "";

  if (!wrongCount) {
    planningImpact = `本组 ${rate}% 正确，暂不增加额外任务，继续原周计划。`;
  } else if (rate >= 80) {
    planningImpact = `本组 ${rate}% 正确，错题已进入复习清单；其余任务顺序不变。`;
  } else {
    const target = nextPendingTaskInCategory(task);
    if (target) {
      planningImpact = `${categoryLabel(task.category)}本次正确率 ${rate}%，已把「${taskDisplayTitle(target, tasks.indexOf(target))}」设为下一项同类重点。`;
      target.adjustments = [...(target.adjustments || []), {
        type: "result-priority",
        at,
        sourceTaskId: task.id,
        accuracy: rate,
        wrongCount,
        reason: planningImpact
      }];
    } else {
      planningImpact = `${categoryLabel(task.category)}本次正确率 ${rate}%，错题已进入复习清单；本周没有待完成的同类任务，因此不额外虚构计划。`;
    }
  }

  task.checkin = {
    ...(task.checkin || {}),
    planningImpact
  };
  return planningImpact;
}

function recordPartialPlanImpact(task = {}, partialAnswered = 0, total = 0) {
  if (!partialAnswered) return "";
  const remaining = Math.max(1, Number(total || 0) - Number(partialAnswered || 0));
  const unit = task.category === "dictation" ? "个词" : "题";
  const reason = `本组已完成 ${partialAnswered} ${unit}，剩余 ${remaining} ${unit}；系统会优先保留为当前任务，不把部分学习算作完成。`;
  const adjustments = [...(task.adjustments || [])];
  const existingIndex = adjustments.findIndex(adjustment => adjustment.type === "partial-priority" && adjustment.sourceTaskId === task.id);
  const adjustment = {
    type: "partial-priority",
    at: new Date().toISOString(),
    sourceTaskId: task.id,
    partialAnswered,
    remaining,
    reason
  };
  if (existingIndex >= 0) adjustments[existingIndex] = adjustment;
  else adjustments.push(adjustment);
  task.adjustments = adjustments;
  return reason;
}

function repairUnverifiedTaskStatuses() {
  let changed = false;
  tasks.forEach(task => {
    if ((task.status === "completed" || task.status === "progress") && !hasPracticeRecord(task) && !taskActualStudySeconds(task)) {
      task.status = "planned";
      changed = true;
    }
  });
  if (changed) localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
}

function recommendedQuestionCountForTask(task = {}) {
  const pendingCount = Array.isArray(task.checkin?.pendingPractice?.questions)
    ? task.checkin.pendingPractice.questions.length
    : 0;
  if (pendingCount) return Math.min(20, Math.max(1, pendingCount));
  const preparedCount = Number(task.checkin?.practiceQuestionCount || 0);
  if (preparedCount) return Math.min(20, Math.max(1, preparedCount));
  const standardText = Array.isArray(task.standards) ? task.standards.join(" ") : "";
  const countMatch = standardText.match(/(\d+)\s*题/);
  const requested = Number(countMatch?.[1] || 0);
  if (requested >= 20) return 20;
  if (requested >= 15) return 15;
  if (requested >= 10) return 10;
  if (requested >= 5) return 5;
  const duration = minutesBetween(task.start || "00:00", task.end || "00:00");
  if (duration >= 55) return 20;
  if (duration >= 35) return 10;
  return 5;
}

function currentTaskDecision() {
  const hasSettings = Boolean(localStorage.getItem("topikPrototypeOnboarded") || localStorage.getItem("topikPrototypeSettings"));
  if (!hasSettings) return { type: "setup" };
  const todayKey = beijingDayKey();
  const todayIndex = Math.max(0, baseDays.findIndex(day => day.key === todayKey));
  const nowMinutes = minutesNowInBeijing();
  const pending = tasks.filter(task => task.status !== "cancelled" && !hasPracticeRecord(task));
  if (!pending.length) return { type: "complete" };
  const externalByCategory = todayExternalStudyByCategory();
  const candidates = pending.map((task, index) => {
    const dayIndex = Math.max(0, baseDays.findIndex(day => day.key === task.day));
    const scheduledDateKey = taskScheduledDateKey(task);
    const isActive = task.status === "partial" || task.status === "in_progress";
    const isPast = scheduledDateKey < beijingDateKey();
    const isToday = scheduledDateKey === beijingDateKey();
    const dayPriority = isActive ? 0 : (isPast ? 1 : (isToday ? 2 : 3));
    const dayDistance = Math.round((taskScheduledDate(task).getTime() - buildCurrentWeekDays()[todayIndex].fullDate.getTime()) / 86400000);
    const externalCoverage = isToday && Number(externalByCategory[task.category] || 0) >= 600 ? 1 : 0;
    const adaptivePriority = Number(new Date(resultPriorityAdjustment(task)?.at || 0).getTime()) || 0;
    return { task, index, dayIndex, dayPriority, dayDistance, isPast, isToday, scheduledDateKey, externalCoverage, adaptivePriority, startMinutes: clockToMinutes(task.start, 0), nowMinutes };
  });
  const baseRanked = [...candidates].sort((first, second) =>
    first.dayPriority - second.dayPriority
    || first.dayDistance - second.dayDistance
    || first.startMinutes - second.startMinutes
    || first.index - second.index
  );
  const ranked = [...candidates].sort((first, second) =>
    first.dayPriority - second.dayPriority
    || first.dayDistance - second.dayDistance
    || second.adaptivePriority - first.adaptivePriority
    || first.externalCoverage - second.externalCoverage
    || first.startMinutes - second.startMinutes
    || first.index - second.index
  );
  const baseCategorySeconds = Number(externalByCategory[baseRanked[0]?.task?.category] || 0);
  const externalRotation = baseRanked[0]?.task?.id !== ranked[0]?.task?.id
    && baseCategorySeconds >= 600
    && !ranked[0]?.adaptivePriority
    ? {
        category: baseRanked[0].task.category,
        seconds: baseCategorySeconds
      }
    : null;
  return { type: "task", ...ranked[0], todayIndex, externalRotation };
}

function currentTaskTimeLabel(date = new Date()) {
  const time = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
  return `现在 ${time}`;
}

function currentTaskCopy(decision = currentTaskDecision()) {
  if (decision.type === "setup") return {
    title: "先生成你的课程学习计划",
    meta: "填写目标、可用时间和要学习的模块。",
    target: "计划只使用你选择的范围。",
    reason: "生成后，系统会替你选出现在最该做的一项。",
    button: "设置学习计划"
  };
  if (decision.type === "complete") return {
    title: "本周没有待完成任务",
    meta: `本周实际学习 ${formatActualStudyTime(weeklyPlanActualSummary().actualSeconds)}。`,
    target: "可以查看真实学习记录和错题结果。",
    reason: "新任务会继续依据你的学习范围和实际结果安排。",
    button: "查看学习进度"
  };
  const task = decision.task;
  const taskIndex = tasks.indexOf(task);
  const taskDays = buildPlanWeekDays(taskWeekIndex(task));
  const day = taskDays.find(item => item.key === task.day) || baseDays.find(item => item.key === task.day) || { name: "本周" };
  const duration = Math.max(1, minutesBetween(task.start, task.end));
  const partialAnswered = Number(task.checkin?.partialAnswered || 0);
  const questionCount = recommendedQuestionCountForTask(task);
  const remaining = partialAnswered ? Math.max(1, questionCount - partialAnswered) : questionCount;
  const accuracyMatch = (task.standards || []).join(" ").match(/正确率(?:达到|目标)?\s*(\d+%)/);
  const target = task.category === "dictation"
    ? "完成本组听写，并标记不熟的词。"
    : `完成${partialAnswered ? `剩余${remaining}` : questionCount}题${accuracyMatch ? `，目标正确率${accuracyMatch[1]}` : ""}。`;
  let timing = `${day.name} ${task.start}，约${duration}分钟。`;
  let reason = `这是周计划中下一项未完成任务。完成后自动记录用时、正确率和错题。`;
  if (task.status === "partial" || task.status === "in_progress") {
    timing = `现在继续，已记录 ${formatActualStudyTime(taskActualStudySeconds(task))}。`;
    reason = task.checkin?.planningImpact || `${partialAnswered ? `上次已完成${partialAnswered}题` : "这项已经开始"}。完成后自动保存剩余结果。`;
  } else if (decision.isPast) {
    timing = `现在补上，原计划 ${day.name} ${task.start}。`;
    reason = `这项尚未完成，所以优先于后面的任务。完成后自动记录真实结果。`;
  } else if (decision.isToday && decision.startMinutes <= decision.nowMinutes) {
    timing = `现在开始，约${duration}分钟。`;
    reason = `这是今天尚未完成的下一项。完成后自动记录真实结果。`;
  } else if (decision.isToday) {
    reason = `这是今天最近的一项计划。完成后自动记录真实结果。`;
  }
  const adaptiveAdjustment = resultPriorityAdjustment(task);
  if (adaptiveAdjustment?.reason && task.status !== "partial" && task.status !== "in_progress") {
    reason = adaptiveAdjustment.reason;
  }
  if (decision.externalRotation) {
    const covered = externalStudyCategoryLabel(decision.externalRotation.category);
    reason = `刚补录了${formatActualStudyTime(decision.externalRotation.seconds)}${covered}，所以先安排${externalStudyCategoryLabel(task.category)}，避免连续重复；原计划仍保留。`;
  }
  return {
    title: taskDisplayTitle(task, taskIndex),
    meta: timing,
    target,
    reason,
    button: task.status === "partial" || task.status === "in_progress" ? "继续学习" : "开始学习"
  };
}

function renderCurrentTask() {
  const card = $("#currentTaskCard");
  if (!card) return;
  const decision = currentTaskDecision();
  const copy = currentTaskCopy(decision);
  card.dataset.mode = decision.type;
  card.dataset.taskId = decision.task?.id || "";
  card.classList.toggle("is-empty", decision.type !== "task");
  $("#currentTaskNow").textContent = currentTaskTimeLabel();
  $("#currentTaskTitle").textContent = copy.title;
  $("#currentTaskMeta").textContent = copy.meta;
  $("#currentTaskTarget").textContent = copy.target;
  $("#currentTaskReason").textContent = copy.reason;
  $("#startCurrentTask").textContent = copy.button;
  $("#adjustCurrentTask").classList.toggle("hidden", decision.type !== "task");
  $("#skipCurrentTask").classList.toggle("hidden", decision.type !== "task");
  renderExternalStudyEffect();
}

function renderExternalStudyEffect() {
  const panel = $("#externalStudyEffect");
  if (!panel) return;
  const latest = readExternalStudyRecords()[0];
  panel.classList.toggle("hidden", !latest);
  if (!latest) return;
  const duration = Number(latest.actualSeconds || 0);
  const activities = Array.isArray(latest.activities) ? latest.activities : [];
  $("#externalStudyEffectSummary").textContent = duration
    ? `已补录：${externalStudyActivitySummary(activities, duration)}`
    : "学习内容已保存";
  $("#externalStudyEffectImpact").textContent = latest.planningImpact || "系统会据此重新判断当前任务。";
}

function startCurrentTask() {
  const decision = currentTaskDecision();
  if (decision.type === "setup") return openSettingsWizard(0);
  if (decision.type === "complete") return switchView("progress");
  const task = decision.task;
  activeTaskId = task.id;
  if (task.category === "dictation") {
    return startDictationTask(task);
  }
  const countSelect = $("#practiceQuestionCount");
  if (countSelect) countSelect.value = String(recommendedQuestionCountForTask(task));
  startPractice("e1", task.id);
}

function adjustCurrentTask() {
  const decision = currentTaskDecision();
  if (decision.type !== "task") return;
  openTask(decision.task.id);
  toggleTaskEdit(true);
}

function skipCurrentTask() {
  const decision = currentTaskDecision();
  if (decision.type !== "task") return;
  activeTaskId = decision.task.id;
  rescheduleActiveTask();
}

function formatActualStudyTime(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "暂无有效记录";
  if (total < 60) return "不足 1 分钟";
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ""}`;
}

function formatStudySummaryTime(seconds = 0) {
  return Math.max(0, Number(seconds) || 0) ? formatActualStudyTime(seconds) : "0 分钟";
}

function practiceSessionSeconds() {
  if (!practiceSessionStartedAt) return 0;
  const startedAt = new Date(practiceSessionStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

function persistTasksAndRefresh() {
  localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
  renderCalendar();
  updateTomorrowFocus();
  scheduleCloudSave();
}

function accuracyFor(items = []) {
  const total = items.reduce((sum, task) => sum + Number(task.checkin?.total || 0), 0);
  const correct = items.reduce((sum, task) => sum + Number(task.checkin?.correct || 0), 0);
  return total ? Math.round((correct / total) * 100) : null;
}

function escapeText(text = "") {
  return String(text).replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}

function externalStudyRecordsCard(records = []) {
  const items = records.slice(0, 8);
  if (!items.length) {
    return `<article class="chart-card progress-empty-card"><div class="card-title"><div><p>站外学习记录</p><strong>还没有补录</strong></div></div><p>补录的学习会显示在这里，并计入实际学习用时。</p></article>`;
  }
  return `<article class="chart-card wide external-records-card">
    <div class="card-title"><div><p>站外学习记录</p><strong>已记录 ${records.length} 条</strong></div></div>
    <p class="external-record-note">计入实际用时，并帮助系统调整下一项任务；不会代替计划打卡。</p>
    <div class="external-record-list">${items.map(record => {
      const time = record.createdAt ? new Date(record.createdAt).toLocaleString("zh-CN", { hour12: false }) : "刚刚";
      const duration = Number(record.actualSeconds || 0) ? formatActualStudyTime(record.actualSeconds) : "未填写用时";
      const impact = record.planningImpact ? `<p class="external-record-impact">${escapeText(record.planningImpact)}</p>` : "";
      return `<div class="external-record-item"><div><strong>${escapeText(record.note || "站外学习")}</strong><p>${time}</p>${impact}</div><span>${duration}</span></div>`;
    }).join("")}</div>
  </article>`;
}

function currentWeekExternalStudyRecords(records = readExternalStudyRecords()) {
  const weekStart = beijingDateKey(days[0]?.fullDate || new Date());
  const weekEnd = beijingDateKey(days[6]?.fullDate || new Date());
  return records.filter(record => {
    if (!record.createdAt) return false;
    const recordDate = beijingDateKey(new Date(record.createdAt));
    return recordDate >= weekStart && recordDate <= weekEnd;
  });
}

function weeklyPlanActualSummary(externalRecords = readExternalStudyRecords(), weekIndex = displayedWeekIndex) {
  const weekTasks = tasks.filter(task => taskWeekIndex(task) === normalizedWeekIndex(weekIndex));
  const plannedTasks = weekTasks.filter(task => task.status !== "cancelled");
  const completedTasks = plannedTasks.filter(hasPracticeRecord);
  const activeTasks = plannedTasks.filter(task => !hasPracticeRecord(task)
    && (task.status === "partial" || task.status === "in_progress" || taskActualStudySeconds(task) > 0));
  const systemStudySeconds = weekTasks.reduce((sum, task) => sum + taskActualStudySeconds(task), 0);
  const externalStudySeconds = currentWeekExternalStudyRecords(externalRecords)
    .reduce((sum, record) => sum + Math.max(0, Number(record.actualSeconds || 0)), 0);
  const rescheduledCount = weekTasks.reduce((count, task) => count + (task.adjustments || []).filter(adjustment => adjustment.type === "skipped").length, 0);
  const adaptiveCount = weekTasks.reduce((count, task) => count + (task.adjustments || []).filter(adjustment => ["result-priority", "partial-priority"].includes(adjustment.type)).length, 0);
  return {
    plannedTasks: plannedTasks.length,
    completedTasks: completedTasks.length,
    activeTasks: activeTasks.length,
    cancelledTasks: weekTasks.filter(task => task.status === "cancelled").length,
    rescheduledCount,
    adaptiveCount,
    plannedSeconds: plannedTasks.reduce((sum, task) => sum + Math.max(0, minutesBetween(task.start, task.end)) * 60, 0),
    actualSeconds: systemStudySeconds + externalStudySeconds,
    systemStudySeconds,
    externalStudySeconds
  };
}

function planActualCard(externalRecords = readExternalStudyRecords()) {
  const summary = weeklyPlanActualSummary(externalRecords);
  const statusParts = [];
  if (summary.activeTasks) statusParts.push(`${summary.activeTasks}项进行中`);
  if (summary.rescheduledCount) statusParts.push(`${summary.rescheduledCount}次未完成已重排`);
  if (summary.adaptiveCount) statusParts.push(`${summary.adaptiveCount}次动态调整`);
  if (summary.cancelledTasks) statusParts.push(`${summary.cancelledTasks}项已取消`);
  const planState = summary.completedTasks === summary.plannedTasks
    ? "本周计划任务已全部完成"
    : "剩余任务仍按周计划保留";
  const note = summary.plannedTasks
    ? `${statusParts.join("，") || planState}。补录影响后续安排，但不代替计划打卡。`
    : "还没有有效周计划。补录仍会保留为真实学习记录，但不会生成计划完成进度。";
  return `<article class="chart-card wide plan-actual-card">
    <div class="card-title"><div><p>计划与实际</p><strong>已完成 ${summary.completedTasks} / ${summary.plannedTasks} 项</strong></div></div>
    <div class="plan-actual-stats">
      <div><span>计划用时</span><strong>${formatStudySummaryTime(summary.plannedSeconds)}</strong></div>
      <div><span>实际学习</span><strong>${formatStudySummaryTime(summary.actualSeconds)}</strong><small>站内 ${formatStudySummaryTime(summary.systemStudySeconds)} + 站外 ${formatStudySummaryTime(summary.externalStudySeconds)}</small></div>
    </div>
    <p class="plan-actual-note">${note}</p>
  </article>`;
}

function renderProgressView() {
  const records = completedPracticeTasks();
  const externalRecords = readExternalStudyRecords();
  const mockRecords = records.filter(task => task.category === "mock");
  const latestMockRate = accuracyFor(mockRecords.slice(-1));
  $("#scorePill").classList.toggle("is-empty", latestMockRate === null);
  $("#scorePill").innerHTML = latestMockRate === null
    ? "<small>当前模拟</small><strong>暂无</strong><span>完成模拟后生成</span>"
    : `<small>当前模拟</small><strong>${Math.round(latestMockRate * 2)} / 200</strong><span>按最近一次模拟估算</span>`;

  if (!records.length) {
    $("#progressGrid").innerHTML = `${planActualCard(externalRecords)}${externalStudyRecordsCard(externalRecords)}<article class="chart-card wide progress-empty-card">
      <div class="card-title"><div><p>真实学习数据</p><strong>暂无练习记录</strong></div></div>
      <p>完成第一组系统练习后，这里才会显示正确率、能力分布和连续学习。现在不会使用演示数据。</p>
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
  $("#progressGrid").innerHTML = `${planActualCard(externalRecords)}${externalStudyRecordsCard(externalRecords)}<article class="chart-card wide">
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

function taskDisplayIndex(task = {}, fallback = 0) {
  if (Number.isInteger(task.displayIndex)) return task.displayIndex;
  const category = normalizeStudyCategory(task.category);
  const categoryTasks = tasks.filter(item => normalizeStudyCategory(item.category) === category);
  const categoryIndex = categoryTasks.indexOf(task);
  return categoryIndex >= 0 ? categoryIndex : fallback;
}

function taskDisplayTitle(task = {}, index = 0) {
  const rawTitle = String(task.title || "");
  if (task.customTitle && rawTitle) return rawTitle;
  if (rawTitle === "听下一步行动") return "听力 · 判断下一步行动";
  const cleanedTitle = rawTitle.replace(/^(听力|阅读|词汇\s*\/\s*语法|词汇|语法|写作|巩固练习|模拟测验|错题复盘)[：:]\s*/, "");
  if (cleanedTitle && cleanedTitle !== rawTitle) return cleanedTitle;
  if (/^(IELTS|雅思|学习)\s/.test(rawTitle)) return rawTitle;
  if (rawTitle && !/^TOPIK\s+[I]{1,2}\s/.test(rawTitle) && !/target grade|listening|reading|writing|speaking|vocab|grammar|review|consolidation/i.test(rawTitle)) return rawTitle;
  const settings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {};
  const examPrefix = settings.exam === "IELTS"
    ? "IELTS"
    : (settings.exam === "TOPIK" ? "" : (settings.customExamName || "学习"));
  const titleMap = {
    listening: ["听人物和地点", "听力 · 判断下一步行动", "听说话人意图", "听职业与身份", "听说话人态度", "听主题与内容", "听说明方式", "听对话前文推断", "听原因和理由", "听数字和时间", "听内容一致", "听否定和时态", "看图听关键词", "听后复述"],
    writing: ["写作：句子补全", "写作：短文逻辑补全", "写作：图表说明", "写作：议论文结构"],
    reading: ["通知公告阅读", "促销广告阅读", "短文大意理解", "题干关键词定位", "图表信息读取", "句子连接判断", "限时阅读"],
    vocab: ["生活场景词汇", "基础助词辨析", "动词形容词变形", "连接语尾基础", "固定搭配训练", "语境填空", "易混词辨析"],
    grammar: ["基础助词辨析", "连接语尾基础", "句子结构判断", "时态与敬语"],
    dictation: ["听写：常见词", "听写：搭配词", "听写：听错词", "听写：助词词形"],
    consolidation: ["错因预防练习", "延迟巩固练习", "混合题型串联", "限时综合练习", "本日知识回忆"],
    review: ["错题复盘：同类变式题", "错题复盘：到期题重做", "错题复盘：判断路径"],
    mock: ["阶段模拟：限时综合练习"]
  };
  const options = titleMap[task.category] || ["学习任务"];
  const displayIndex = taskDisplayIndex(task, index);
  return [examPrefix, options[displayIndex % options.length]].filter(Boolean).join(" ");
}

function taskDisplayNote(task = {}, index = 0) {
  const settings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {};
  const rawNote = String(task.note || "");
  if (task.customTitle || settings.exam !== "TOPIK" || settings.level === "II") return rawNote;
  const token = normalizeStudyCategory(task.category);
  const templates = studyTemplates[token] || studyTemplates.consolidation || [];
  const displayIndex = taskDisplayIndex(task, index);
  const templateNote = templates[displayIndex % templates.length]?.[1] || "";
  const looksLikeOldGeneratedNote = /^围绕目标\d级/.test(rawNote) || /综合同型题|基础句型和高频表达|公告、广告和短文信息/.test(rawNote);
  return looksLikeOldGeneratedNote && templateNote ? templateNote : rawNote;
}

function taskTrainingPoint(task = {}, index = 0) {
  const title = taskDisplayTitle(task, index);
  const parts = title.split(/\s*[：·]\s*/);
  const hasModulePrefix = parts.length > 1;
  const moduleName = hasModulePrefix
    ? parts[0].replace(/^TOPIK\s+[I]{1,2}\s+/, "").replace(/^IELTS\s+/, "").trim()
    : (categoryMeta[task.category]?.label || "练习");
  const point = hasModulePrefix ? parts.slice(1).join("：") : title;
  const note = taskDisplayNote(task, index).replace(/^围绕目标\d级/, "目标训练：").replace(/^目标训练：/, "目标训练：");
  return { moduleName, point, note };
}

function getKoreanSpeechVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  return voices.find(voice => /^ko([-_]|$)/i.test(voice.lang))
    || voices.find(voice => /korean|한국|Yuna|Sora/i.test(`${voice.name} ${voice.lang}`))
    || null;
}

function waitForSpeechVoices(timeout = 900) {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices?.() || [];
  if (existing.length) return Promise.resolve(existing);
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices?.() || []);
    };
    window.speechSynthesis.onvoiceschanged = finish;
    setTimeout(finish, timeout);
  });
}

function stopTtsAudio() {
  if (activeTtsAudio) {
    activeTtsAudio.pause();
    activeTtsAudio.removeAttribute("src");
    activeTtsAudio.load?.();
    activeTtsAudio = null;
  }
  if (activeTtsAudioUrl) {
    URL.revokeObjectURL(activeTtsAudioUrl);
    activeTtsAudioUrl = "";
  }
}

async function playOpenSourceTts(text, options = {}) {
  const content = String(text || "").trim();
  if (!content) return false;
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: content,
        language: "ko-KR",
        rate: options.rate || LISTENING_TTS_RATE,
        speaker: options.speaker || ""
      })
    });
    if (!response.ok) {
      try {
        const data = await response.clone().json();
        window.__lastTtsProvider = "";
        window.__lastTtsError = data;
        console.warn("TTS API unavailable", data);
      } catch {
        window.__lastTtsProvider = "";
        window.__lastTtsError = { status: response.status };
      }
      return false;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("audio/")) {
      window.__lastTtsProvider = "";
      window.__lastTtsError = { status: response.status, contentType };
      return false;
    }
    const blob = await response.blob();
    if (!blob.size) {
      window.__lastTtsProvider = "";
      window.__lastTtsError = { status: response.status, contentType, emptyAudio: true };
      return false;
    }
    window.__lastTtsProvider = response.headers.get("x-tts-provider") || "unknown";
    window.__lastTtsError = null;
    stopTtsAudio();
    activeTtsAudioUrl = URL.createObjectURL(blob);
    activeTtsAudio = new Audio(activeTtsAudioUrl);
    activeTtsAudio.playbackRate = 1;
    activeTtsAudio.onplay = () => options.onStart?.();
    activeTtsAudio.onended = () => {
      stopTtsAudio();
      options.onEnd?.();
    };
    activeTtsAudio.onerror = () => {
      stopTtsAudio();
      options.onError?.();
    };
    await activeTtsAudio.play();
    return true;
  } catch (error) {
    stopTtsAudio();
    window.__lastTtsProvider = "";
    window.__lastTtsError = { message: error?.message || "tts_play_failed" };
    return false;
  }
}

function hasConfiguredCloudTtsFailure() {
  const diagnostics = window.__lastTtsError?.diagnostics;
  if (!diagnostics) return false;
  const preferredProvider = String(diagnostics.preferredProvider || "").toLowerCase();
  return Boolean(
    preferredProvider === "minimax" ||
      diagnostics.minimax?.hasApiKey ||
      diagnostics.elevenLabs?.hasApiKey ||
      diagnostics.openAiCompatible?.hasApiKey ||
      diagnostics.external?.hasEndpoint
  );
}

async function speakBrowserKoreanText(text, options = {}) {
  if (!("speechSynthesis" in window)) {
    showToast("当前浏览器不支持朗读");
    options.onError?.();
    return false;
  }
  const content = String(text || "").trim();
  if (!content) {
    options.onError?.();
    return false;
  }
  await waitForSpeechVoices();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  const voice = getKoreanSpeechVoice();
  let started = false;
  utterance.lang = "ko-KR";
  utterance.rate = options.rate || LISTENING_TTS_RATE;
  utterance.pitch = options.pitch || 1;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  utterance.onstart = () => {
    started = true;
    options.onStart?.();
  };
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => {
    showToast("音频没有成功播放，请确认设备音量和浏览器语音权限");
    options.onError?.();
  };
  window.speechSynthesis.resume?.();
  window.speechSynthesis.speak(utterance);
  setTimeout(() => window.speechSynthesis.resume?.(), 80);
  setTimeout(() => {
    if (!started && !window.speechSynthesis.speaking) {
      showToast("浏览器没有可用韩语朗读音色，正在使用文本题模式");
      options.onError?.();
    }
  }, 1200);
  return true;
}

async function speakKoreanText(text, options = {}) {
  const content = String(text || "").trim();
  if (!content) {
    options.onError?.();
    return false;
  }
  const usedOpenSourceTts = await playOpenSourceTts(content, options);
  if (usedOpenSourceTts) return true;
  if (hasConfiguredCloudTtsFailure()) {
    showToast("云端音频生成失败，请检查 TTS 配置或额度");
    options.onError?.();
    return false;
  }
  return await speakBrowserKoreanText(content, options);
}

function normalizeDialogueSpeaker(label = "") {
  const value = String(label || "").trim();
  if (/^(남자|남성|남학생|남|男|男生|男声)$/.test(value)) return "male";
  if (/^(여자|여성|여학생|여|女|女生|女声)$/.test(value)) return "female";
  return "default";
}

function getDialogueSegments(text = "") {
  const source = String(text || "").trim();
  if (!source) return [];
  const markerPattern = /(남자|여자|남성|여성|남학생|여학생|남|여|男生|女生|男声|女声|男|女)\s*[:：]/g;
  const matches = Array.from(source.matchAll(markerPattern));
  if (!matches.length) return [{ speaker: "default", text: source }];

  const segments = [];
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const content = source.slice(start, end).trim();
    if (content) {
      segments.push({ speaker: normalizeDialogueSpeaker(match[1]), text: content });
    }
  });

  return segments.length ? segments : [{ speaker: "default", text: source }];
}

async function speakKoreanDialogueText(text, options = {}) {
  const segments = getDialogueSegments(text);
  if (segments.length <= 1) return speakKoreanText(text, options);

  let hasStarted = false;
  for (const segment of segments) {
    const played = await new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      speakKoreanText(segment.text, {
        ...options,
        speaker: segment.speaker,
        onStart: () => {
          if (!hasStarted) {
            hasStarted = true;
            options.onStart?.();
          }
        },
        onEnd: () => finish(true),
        onError: () => finish(false)
      })
        .then(ok => {
          if (!ok) finish(false);
        })
        .catch(() => finish(false));
    });

    if (!played) {
      options.onError?.();
      return false;
    }
  }

  options.onEnd?.();
  return true;
}

function setDictationAudioState(state = "idle", message = "点播放，听完后输入韩文") {
  const player = $("#dictationPrimaryAudio");
  const status = $("#dictationAudioStatus");
  if (!player || !status) return;
  player.dataset.state = state;
  player.disabled = state === "loading";
  status.textContent = message;
}

async function speakDictationText(text, label = "单词") {
  setDictationAudioState("loading", "正在准备音频…");
  const played = await speakKoreanText(text, {
    rate: 0.82,
    onStart: () => setDictationAudioState("playing", `正在播放${label}`),
    onEnd: () => setDictationAudioState("ended", "播放完成，点这里可以重听"),
    onError: () => setDictationAudioState("error", "播放失败，点这里重试")
  });
  if (!played) setDictationAudioState("error", "播放失败，点这里重试");
  return played;
}

function clearDictationCanvas() {
  const canvas = $("#dictationCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  dictationInkStrokes = [];
  const candidates = $("#dictationHandwritingCandidates");
  if (candidates) candidates.innerHTML = "";
  const status = $("#dictationHandwritingStatus");
  if (status) status.textContent = "写完后点“识别韩文”";
}

function setupDictationCanvas() {
  const canvas = $("#dictationCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#17202b";
  let drawing = false;
  let activeStroke = null;
  const point = event => {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, t: Date.now() };
  };
  canvas.onpointerdown = event => {
    event.preventDefault();
    drawing = true;
    const current = point(event);
    activeStroke = { pointerType: event.pointerType || "mouse", startedAt: current.t, points: [current] };
    dictationInkStrokes.push(activeStroke);
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    context.beginPath();
    context.moveTo(current.x, current.y);
  };
  canvas.onpointermove = event => {
    if (!drawing) return;
    event.preventDefault();
    const current = point(event);
    activeStroke?.points.push(current);
    context.lineTo(current.x, current.y);
    context.stroke();
  };
  const stopDrawing = event => {
    if (!drawing) return;
    drawing = false;
    activeStroke = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  };
  canvas.onpointerup = stopDrawing;
  canvas.onpointercancel = stopDrawing;
  canvas.onpointerleave = stopDrawing;
}

function setDictationInputValue(value = "") {
  const input = $("#dictationInput");
  if (!input) return;
  input.value = value;
  writeDictationState({ inputText: value });
  input.focus();
}

function dictationCanvasImageData() {
  const canvas = $("#dictationCanvas");
  if (!canvas) return "";
  const maxWidth = 1024;
  const scale = Math.min(1, maxWidth / Math.max(1, canvas.width));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(canvas.width * scale));
  output.height = Math.max(1, Math.round(canvas.height * scale));
  const context = output.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output.toDataURL("image/jpeg", 0.88);
}

function renderDictationHandwritingCandidates(values = []) {
  const candidates = $("#dictationHandwritingCandidates");
  if (!candidates) return;
  candidates.innerHTML = values.map((value, index) => `<button class="dictation-candidate ${index === 0 ? "is-selected" : ""}" type="button" data-dictation-candidate="${escapeImportText(value)}">${escapeImportText(value)}</button>`).join("");
  $$('[data-dictation-candidate]').forEach(candidate => candidate.addEventListener("click", () => {
    setDictationInputValue(candidate.dataset.dictationCandidate || "");
    $$('[data-dictation-candidate]').forEach(item => item.classList.toggle("is-selected", item === candidate));
  }));
}

async function recognizeDictationHandwritingOnline() {
  const payload = await callStudyAssistant("handwriting", { image: dictationCanvasImageData() }, { timeoutMs: 25000 });
  return [...new Set((payload?.candidates || []).map(value => String(value || "").trim()).filter(Boolean))].slice(0, 3);
}

async function recognizeDictationHandwriting() {
  const status = $("#dictationHandwritingStatus");
  const candidates = $("#dictationHandwritingCandidates");
  if (!dictationInkStrokes.length) {
    if (status) status.textContent = "先在上面写下韩文";
    return;
  }
  const button = $("#recognizeDictationHandwriting");
  if (button) {
    button.disabled = true;
    button.textContent = "识别中…";
  }
  if (status) status.textContent = "正在识别韩文，本次手写图片不会保存…";
  try {
    let values = [];
    const supportsLocalRecognition = "createHandwritingRecognizer" in navigator && "HandwritingStroke" in window;
    if (supportsLocalRecognition) {
      try {
        if (!dictationHandwritingRecognizer) {
          if ("queryHandwritingRecognizer" in navigator) {
            const support = await navigator.queryHandwritingRecognizer({ languages: ["ko"] });
            if (!support) throw new Error("korean_handwriting_unsupported");
          }
          dictationHandwritingRecognizer = await navigator.createHandwritingRecognizer({ languages: ["ko"] });
        }
        const pointerType = dictationInkStrokes.at(-1)?.pointerType;
        const inputType = pointerType === "pen" ? "stylus" : (["mouse", "touch", "stylus"].includes(pointerType) ? pointerType : "mouse");
        const drawing = dictationHandwritingRecognizer.startDrawing({ recognitionType: "text", inputType, alternatives: 3 });
        dictationInkStrokes.forEach(savedStroke => {
          const stroke = new HandwritingStroke();
          savedStroke.points.forEach(savedPoint => stroke.addPoint({
            x: savedPoint.x,
            y: savedPoint.y,
            t: Math.max(0, savedPoint.t - savedStroke.startedAt)
          }));
          drawing.addStroke(stroke);
        });
        const predictions = await drawing.getPrediction();
        values = [...new Set((predictions || []).map(item => String(item.text || "").trim()).filter(Boolean))].slice(0, 3);
        drawing.clear?.();
      } catch {
        values = [];
      }
    }
    if (!values.length) values = await recognizeDictationHandwritingOnline();
    if (!values.length) throw new Error("no_handwriting_prediction");
    setDictationInputValue(values[0]);
    if (status) status.textContent = `已识别为“${values[0]}”，可选择其他结果`;
    renderDictationHandwritingCandidates(values);
  } catch (error) {
    if (status) status.textContent = "没有识别出来，请写大一些、减少连笔后重试";
    showToast("没有识别出来，可清空重写或直接使用韩文输入法");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "识别韩文";
    }
  }
}

function renderDictationView() {
  const view = $("#dictationView");
  if (!view) return;
  const state = readDictationState();
  const practiceItems = dictationPracticeItems();
  const taskSession = dictationTaskSession(state);
  const item = currentDictationItem(state);
  const index = practiceItems.findIndex(entry => entry.id === item.id);
  const safeIndex = taskSession
    ? Math.max(0, Math.min(taskSession.itemIds.length - 1, Number(taskSession.currentPosition) || 0))
    : Math.max(0, index);
  const progressTotal = taskSession?.itemIds.length || practiceItems.length;
  const answerState = normalizedDictationAnswerState(state, item, taskSession);
  const revealed = answerState.revealed;
  const inputText = answerState.inputText;
  const hasInput = Boolean(inputText.trim());
  const isCorrect = isDictationAnswerCorrect(inputText, item.text);
  const weakIds = new Set(state.weakIds || []);
  const isMarkedWeak = weakIds.has(item.id);
  const answeredCount = Object.keys(taskSession?.answers || {}).length;
  const isLastTaskItem = Boolean(taskSession && safeIndex === taskSession.itemIds.length - 1);
  const linkedTaskTitle = taskSession ? taskDisplayTitle(taskSession.task, tasks.indexOf(taskSession.task)) : "";
  view.innerHTML = `<div class="page-heading dictation-heading">
    <div>
      <p class="section-kicker">${taskSession ? `周计划任务 · ${escapeImportText(linkedTaskTitle)}` : "听写训练 · 手写记忆"}</p>
      <h2>听写</h2>
      <p>${taskSession ? `完成本组 ${progressTotal} 个词，系统会记录正确率、不熟词和实际用时。` : "播放单词，输入听到的韩文，再核对答案。"}</p>
    </div>
    <button class="score-pill dictation-score-button${!taskSession && weakIds.size ? "" : " is-empty"}" id="reviewWeakDictation" type="button" ${!taskSession && weakIds.size ? "" : "disabled"} aria-label="${taskSession ? `本组已核对 ${answeredCount} 个词` : (weakIds.size ? `${weakIds.size} 个不熟词，点击重新练习` : "暂无不熟词")}">
      <small>${taskSession ? "本组进度" : "当前进度"}</small><strong>${safeIndex + 1} / ${progressTotal}</strong><span>${taskSession ? `已核对 ${answeredCount} 个` : (weakIds.size ? `${weakIds.size} 个不熟，点此重做` : "暂无不熟词")}</span>
    </button>
  </div>
  <div class="dictation-layout">
    <article class="dictation-workbench">
      <div class="dictation-prompt">
        <div><span>${escapeImportText(item.note)}</span><strong>${revealed ? escapeImportText(item.text) : `第 ${safeIndex + 1} 个词`}</strong></div>
        <em>${escapeImportText(item.pos)}</em>
      </div>
      <button class="dictation-primary-audio" id="dictationPrimaryAudio" type="button" data-state="idle" data-dictation-primary-audio="${escapeImportText(item.text)}">
        <span class="dictation-play-glyph" aria-hidden="true"></span>
        <span class="dictation-audio-copy"><small>听写音频</small><strong id="dictationAudioStatus">点播放，听完后输入韩文</strong></span>
        <span class="dictation-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      </button>
      ${revealed ? `<div class="dictation-audio-row">
        <button class="dictation-audio-button" type="button" data-dictation-speak="${escapeImportText(item.pairing)}" data-dictation-label="搭配">播放搭配</button>
        <button class="dictation-audio-button" type="button" data-dictation-speak="${escapeImportText(item.example)}" data-dictation-label="例句">播放例句</button>
      </div>` : ""}
      <div class="dictation-input-card">
        <div class="dictation-input-head">
          <label for="dictationInput">输入答案</label>
          <button class="dictation-handwriting-toggle" id="openDictationHandwriting" type="button" aria-expanded="false" aria-controls="dictationHandwritingPanel">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4l10.8-10.8a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.7 7.3 3 3"/></svg>
            <span>打开手写板</span>
          </button>
        </div>
        <input id="dictationInput" name="dictationAnswer" type="text" lang="ko" inputmode="text" enterkeyhint="done" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore="true" data-lpignore="true" aria-label="听写答案" value="${escapeImportText(inputText)}" placeholder="在这里输入韩文" />
        <small>手机和平板可直接使用系统韩文手写键盘。</small>
      </div>
      <div class="dictation-handwriting hidden" id="dictationHandwritingPanel">
        <div class="dictation-board">
          <canvas id="dictationCanvas" aria-label="韩文手写识别区"></canvas>
          <span class="dictation-write-line"></span>
          <small id="dictationHandwritingStatus">写完后点“识别韩文”</small>
        </div>
        <div class="dictation-handwriting-controls">
          <div class="dictation-candidates" id="dictationHandwritingCandidates"></div>
          <button class="secondary-button compact" type="button" id="clearDictationCanvas">清空</button>
          <button class="secondary-button compact" type="button" id="recognizeDictationHandwriting">识别韩文</button>
        </div>
        <p>优先使用设备识别；设备不支持时会在线识别。本次手写图片只用于识别，不会保存。</p>
      </div>
      ${revealed ? `<div class="dictation-answer-card ${isCorrect ? "is-correct" : "is-wrong"}">
        <span>核对结果</span>
        <strong class="${isCorrect ? "dictation-correct" : "dictation-wrong"}">${isCorrect ? "回答正确" : "答案不正确"}</strong>
        <p>你的答案：${hasInput ? escapeImportText(inputText) : "未输入"}</p>
        ${isCorrect ? "" : `<span>正确答案</span><strong>${escapeImportText(item.text)}</strong>`}
        <p class="dictation-result-note">${isMarkedWeak ? "已加入复习清单，之后会再次练习。" : "已记录为掌握。"}</p>
        <p>中文：${escapeImportText(item.zh)}</p>
        <p>搭配：${escapeImportText(item.pairing)} · ${escapeImportText(item.pairingZh)}</p>
        <p>例句：${escapeImportText(item.example)} · ${escapeImportText(item.exampleZh)}</p>
        <p>来源：${escapeImportText(item.source || "系统听写词库")}</p>
        <div class="dictation-answer-actions">
          ${isMarkedWeak
            ? `<button class="secondary-button compact" type="button" id="markDictationKnown">改为已掌握</button>`
            : `<button class="secondary-button compact" type="button" id="markDictationWeak">加入复习清单</button>`}
        </div>
      </div>` : `<div class="dictation-hint-card" aria-live="polite">
        <strong>答案与解释</strong>
        <p>输入韩文并点“核对答案”后，这里会显示正确答案、中文释义、常用搭配和例句。</p>
      </div>`}
      <div class="dictation-actions">
        <button class="secondary-button" type="button" id="prevDictationItem" ${taskSession && safeIndex === 0 ? "disabled" : ""}>上一条</button>
        <button class="primary-button" type="button" id="${revealed ? (isLastTaskItem ? "completeDictationTask" : "nextDictationItem") : "revealDictationAnswer"}">${revealed ? (isLastTaskItem ? "完成本组" : "下一条") : "核对答案"}</button>
      </div>
    </article>
  </div>`;
  bindDictationEvents();
}

function renderWordEliminationView() {
  const view = $("#wordEliminationView");
  if (!view) return;
  const state = readWordEliminationState();
  const items = currentWordEliminationItems(state);
  const clearedIds = new Set(state.clearedIds || []);
  const remainingTiles = wordEliminationTiles(items).filter(item => !clearedIds.has(item.id));
  const selectedType = state.selectedWordId ? "韩文" : state.selectedMeaningId ? "中文" : "";
  const batches = wordEliminationBatches();
  const completedBatchIds = new Set(state.completedBatchIds || []);
  const completedRegularCount = completedBatchIds.size * 20 + (state.mode === "batch" ? clearedIds.size : 0);
  const groupLabel = state.mode === "review" ? "不熟词复习" : `第 ${state.batchIndex + 1} 组 · 共 ${batches.length} 组`;
  const completionAction = remainingTiles.length ? null : wordEliminationCompletionAction(state);
  const completionTitle = state.mode === "review"
    ? "不熟词复习完成"
    : `第 ${state.batchIndex + 1} 组已完成`;
  const completionCopy = completionAction?.type === "review"
    ? "先把本组错配和听写不熟词再配一次，然后继续新词。"
    : completionAction?.type === "batch"
      ? "下一组来自已导入的第102届 TOPIK II 真题词汇。"
      : `当前 ${wordEliminationPracticeItems().length} 个词已全部完成，本轮记录已保留。`;
  view.innerHTML = `<div class="page-heading">
    <div>
      <p class="section-kicker">词义配对 · 消除练习</p>
      <h2>单词消除</h2>
      <p>韩文和中文混排。先点任意一张，再点对应翻译。</p>
    </div>
    <div class="score-pill">
      <small>${groupLabel}</small><strong>${clearedIds.size} / ${items.length}</strong><span>${state.mode === "batch" ? `总进度 ${Math.min(wordEliminationPracticeItems().length, completedRegularCount)} / ${wordEliminationPracticeItems().length}` : "完成后继续新词"}</span>
    </div>
  </div>
  <div class="word-elimination-panel">
    <div class="word-elimination-header">
      <div>
        <strong>找到对应的韩文和中文</strong>
        <p id="eliminationFeedback" role="status">${selectedType ? `已选${selectedType}，再点对应翻译` : "配对正确后，两张卡会一起消失"}</p>
      </div>
      <button class="secondary-button compact" type="button" id="resetWordElimination">重新开始</button>
    </div>
    ${remainingTiles.length ? `<div class="elimination-mixed-grid">
      ${remainingTiles.map(tile => {
        const selected = tile.type === "word" ? state.selectedWordId === tile.id : state.selectedMeaningId === tile.id;
        return `<button class="elimination-tile ${selected ? "is-selected" : ""}" type="button" data-elimination-type="${tile.type}" data-elimination-id="${tile.id}" aria-pressed="${selected ? "true" : "false"}">
          <small>${tile.language}</small><strong lang="${tile.type === "word" ? "ko" : "zh-CN"}">${escapeImportText(tile.label)}</strong>
        </button>`;
      }).join("")}
    </div>` : `<div class="elimination-empty">
      <div>
        <strong>${completionTitle}</strong>
        <p>${completionCopy}</p>
      </div>
      <button class="primary-button" type="button" id="continueWordElimination">${completionAction?.label || "继续"}</button>
    </div>`}
  </div>`;
  bindWordEliminationEvents();
}

function selectWordEliminationTile(type = "", id = "") {
  if (wordEliminationResolving || !["word", "meaning"].includes(type) || !id) return;
  const current = readWordEliminationState();
  const ownKey = type === "word" ? "selectedWordId" : "selectedMeaningId";
  const otherKey = type === "word" ? "selectedMeaningId" : "selectedWordId";
  if (current[ownKey] === id) {
    writeWordEliminationState({ [ownKey]: "" });
    renderWordEliminationView();
    return;
  }
  if (!current[otherKey]) {
    writeWordEliminationState({ [ownKey]: id });
    renderWordEliminationView();
    return;
  }

  wordEliminationResolving = true;
  const matched = current[otherKey] === id;
  const clickedTile = document.querySelector(`[data-elimination-type="${type}"][data-elimination-id="${id}"]`);
  const selectedTile = document.querySelector(".elimination-tile.is-selected");
  const feedback = $("#eliminationFeedback");
  clickedTile?.classList.add(matched ? "is-clearing" : "is-error");
  selectedTile?.classList.add(matched ? "is-clearing" : "is-error");
  if (feedback) feedback.textContent = matched ? "配对正确" : "不是这一组，再试一次";

  wordEliminationTimer = window.setTimeout(() => {
    if (matched) {
      writeWordEliminationState({
        selectedWordId: "",
        selectedMeaningId: "",
        clearedIds: [...new Set([...(current.clearedIds || []), id])]
      });
    } else {
      writeWordEliminationState({
        selectedWordId: "",
        selectedMeaningId: "",
        mistakeIds: [...new Set([...(current.mistakeIds || []), id, current[otherKey]])]
      });
    }
    wordEliminationResolving = false;
    wordEliminationTimer = null;
    renderWordEliminationView();
  }, matched ? 280 : 360);
}

function bindWordEliminationEvents() {
  $$("[data-elimination-type][data-elimination-id]").forEach(button => button.addEventListener("click", () => {
    selectWordEliminationTile(button.dataset.eliminationType || "", button.dataset.eliminationId || "");
  }));
  $("#resetWordElimination")?.addEventListener("click", () => {
    if (wordEliminationTimer) window.clearTimeout(wordEliminationTimer);
    wordEliminationTimer = null;
    wordEliminationResolving = false;
    writeWordEliminationState({ selectedWordId: "", selectedMeaningId: "", clearedIds: [] });
    renderWordEliminationView();
  });
  $("#continueWordElimination")?.addEventListener("click", () => {
    const state = readWordEliminationState();
    const action = wordEliminationCompletionAction(state);
    const completedBatchIds = new Set(state.completedBatchIds || []);
    if (state.mode === "batch") completedBatchIds.add(`batch-${state.batchIndex + 1}`);
    if (action.type === "review") {
      writeWordEliminationState({
        selectedWordId: "",
        selectedMeaningId: "",
        clearedIds: [],
        mode: "review",
        reviewIds: action.ids,
        completedBatchIds: [...completedBatchIds]
      });
    } else if (action.type === "batch") {
      writeWordEliminationState({
        selectedWordId: "",
        selectedMeaningId: "",
        clearedIds: [],
        mode: "batch",
        reviewIds: [],
        reviewedWeakIds: state.mode === "review"
          ? [...new Set([...(state.reviewedWeakIds || []), ...(state.reviewIds || [])])]
          : state.reviewedWeakIds || [],
        batchIndex: action.batchIndex,
        completedBatchIds: [...completedBatchIds]
      });
    } else {
      writeWordEliminationState({
        selectedWordId: "",
        selectedMeaningId: "",
        clearedIds: [],
        mode: "batch",
        reviewIds: [],
        reviewedWeakIds: [],
        mistakeIds: [],
        batchIndex: 0,
        completedBatchIds: [],
        roundsCompleted: (Number(state.roundsCompleted) || 0) + 1
      });
    }
    renderWordEliminationView();
  });
}

function bindDictationEvents() {
  $("#reviewWeakDictation")?.addEventListener("click", () => {
    const state = readDictationState();
    const items = dictationPracticeItems();
    const weakIndices = (state.weakIds || [])
      .map(id => items.findIndex(item => item.id === id))
      .filter(index => index >= 0);
    if (!weakIndices.length) return;
    const currentIndex = Math.max(0, Number(state.index) || 0);
    const targetIndex = weakIndices.find(index => index > currentIndex) ?? weakIndices[0];
    writeDictationState({ index: targetIndex, revealed: false, inputText: "" });
    renderDictationView();
    showToast(`已打开不熟词 ${weakIndices.indexOf(targetIndex) + 1}/${weakIndices.length}`);
  });
  $("#dictationPrimaryAudio")?.addEventListener("click", buttonEvent => speakDictationText(buttonEvent.currentTarget.dataset.dictationPrimaryAudio || "", "单词"));
  $$("[data-dictation-speak]").forEach(button => button.addEventListener("click", () => speakDictationText(button.dataset.dictationSpeak || "", button.dataset.dictationLabel || "音频")));
  $("#dictationInput")?.addEventListener("input", event => {
    writeDictationState({ inputText: event.target.value });
  });
  $(".dictation-input-card")?.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    $("#dictationInput")?.focus({ preventScroll: true });
  });
  $("#openDictationHandwriting")?.addEventListener("click", event => {
    const panel = $("#dictationHandwritingPanel");
    if (!panel) return;
    const willOpen = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !willOpen);
    event.currentTarget.setAttribute("aria-expanded", String(willOpen));
    const toggleLabel = event.currentTarget.querySelector("span");
    if (toggleLabel) toggleLabel.textContent = willOpen ? "收起手写板" : "打开手写板";
    if (willOpen) {
      dictationInkStrokes = [];
      requestAnimationFrame(setupDictationCanvas);
    }
  });
  $("#recognizeDictationHandwriting")?.addEventListener("click", recognizeDictationHandwriting);
  $("#revealDictationAnswer")?.addEventListener("click", () => {
    const state = readDictationState();
    const item = currentDictationItem(state);
    const inputText = ($("#dictationInput")?.value || "").trim();
    if (!inputText) {
      showToast("先把听到的韩文写进输入框，再核对答案");
      return;
    }
    const isCorrect = isDictationAnswerCorrect(inputText, item.text);
    const weakIds = isCorrect
      ? (state.weakIds || []).filter(id => id !== item.id)
      : [...new Set([...(state.weakIds || []), item.id])];
    const knownIds = isCorrect
      ? [...new Set([...(state.knownIds || []), item.id])]
      : (state.knownIds || []).filter(id => id !== item.id);
    const session = dictationTaskSession(state);
    const taskSession = session ? {
      ...dictationSessionState(session),
      answers: {
        ...(session.answers || {}),
        [item.id]: { itemId: item.id, inputText, correct: isCorrect, checkedAt: new Date().toISOString() }
      }
    } : state.taskSession;
    writeDictationState({ inputText, revealed: true, weakIds, knownIds, taskSession });
    renderDictationView();
  });
  $("#nextDictationItem")?.addEventListener("click", () => {
    const state = readDictationState();
    const session = dictationTaskSession(state);
    if (session) {
      const nextPosition = Math.min(session.itemIds.length - 1, (Number(session.currentPosition) || 0) + 1);
      const nextId = session.itemIds[nextPosition];
      const savedAnswer = session.answers?.[nextId];
      writeDictationState({
        taskSession: { ...dictationSessionState(session), currentPosition: nextPosition },
        revealed: Boolean(savedAnswer),
        inputText: savedAnswer?.inputText || ""
      });
      renderDictationView();
      return;
    }
    const items = dictationPracticeItems();
    const nextIndex = ((Number(state.index) || 0) + 1) % items.length;
    writeDictationState({ index: nextIndex, revealed: false, inputText: "" });
    renderDictationView();
  });
  $("#prevDictationItem")?.addEventListener("click", () => {
    const state = readDictationState();
    const session = dictationTaskSession(state);
    if (session) {
      const previousPosition = Math.max(0, (Number(session.currentPosition) || 0) - 1);
      const previousId = session.itemIds[previousPosition];
      const savedAnswer = session.answers?.[previousId];
      writeDictationState({
        taskSession: { ...dictationSessionState(session), currentPosition: previousPosition },
        revealed: Boolean(savedAnswer),
        inputText: savedAnswer?.inputText || ""
      });
      renderDictationView();
      return;
    }
    const items = dictationPracticeItems();
    const previousIndex = ((Number(state.index) || 0) - 1 + items.length) % items.length;
    writeDictationState({ index: previousIndex, revealed: false, inputText: "" });
    renderDictationView();
  });
  $("#clearDictationCanvas")?.addEventListener("click", clearDictationCanvas);
  $("#completeDictationTask")?.addEventListener("click", completeDictationTaskSession);
  $("#markDictationWeak")?.addEventListener("click", () => {
    const state = readDictationState();
    const item = currentDictationItem(state);
    const weakIds = [...new Set([...(state.weakIds || []), item.id])];
    const knownIds = (state.knownIds || []).filter(id => id !== item.id);
    writeDictationState({ weakIds, knownIds });
    renderDictationView();
  });
  $("#markDictationKnown")?.addEventListener("click", () => {
    const state = readDictationState();
    const item = currentDictationItem(state);
    const knownIds = [...new Set([...(state.knownIds || []), item.id])];
    const weakIds = (state.weakIds || []).filter(id => id !== item.id);
    writeDictationState({ knownIds, weakIds });
    renderDictationView();
  });
  $$("[data-dictation-jump]").forEach(button => button.addEventListener("click", () => {
    const index = dictationPracticeItems().findIndex(entry => entry.id === button.dataset.dictationJump);
    if (index < 0) return;
    writeDictationState({ index, revealed: false, inputText: "" });
    renderDictationView();
  }));
}

function ensureCalendarTaskTooltip() {
  let tooltip = $("#calendarTaskTooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "calendarTaskTooltip";
  tooltip.className = "calendar-task-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  tooltip.innerHTML = `<div class="calendar-task-tooltip-meta"></div><strong></strong><p></p><span class="calendar-task-tooltip-state"></span>`;
  document.body.appendChild(tooltip);
  return tooltip;
}

function calendarTaskStatusLabel(task, duration, priorityAdjustment = false) {
  if (task.status === "completed") return "已完成";
  if (task.status === "cancelled") return "已取消";
  if (task.status === "partial") return `已完成部分${Number(task.checkin?.partialAnswered || 0) ? ` · ${Number(task.checkin.partialAnswered)}题` : ""}`;
  if (task.status === "in_progress") return "学习中";
  return priorityAdjustment ? `系统优先 · ${duration}分钟` : `${duration}分钟`;
}

function hideCalendarTaskTooltip(card) {
  const tooltip = $("#calendarTaskTooltip");
  if (tooltip) tooltip.hidden = true;
  card?.removeAttribute("aria-describedby");
}

function showCalendarTaskTooltip(card, task) {
  if (!card || !task) return;
  const tooltip = ensureCalendarTaskTooltip();
  const taskIndex = tasks.indexOf(task);
  const meta = categoryMeta[task.category] || categoryMeta.consolidation;
  const duration = minutesBetween(task.start, task.end);
  const priorityAdjustment = resultPriorityAdjustment(task);
  const title = taskDisplayTitle(task, taskIndex).replace(/^(听力|阅读|词汇\s*\/\s*语法|词汇|语法|写作|巩固练习|错题复盘)\s*[：:·]\s*/, "");
  const note = `${priorityAdjustment ? "系统优先：" : ""}${taskDisplayNote(task, taskIndex)}`.trim();
  tooltip.querySelector(".calendar-task-tooltip-meta").textContent = `${meta.label}　${task.start}-${task.end}　${duration}分钟`;
  tooltip.querySelector("strong").textContent = title || taskDisplayTitle(task, taskIndex);
  const noteElement = tooltip.querySelector("p");
  noteElement.textContent = note;
  noteElement.hidden = !note;
  tooltip.querySelector(".calendar-task-tooltip-state").textContent = calendarTaskStatusLabel(task, duration, priorityAdjustment);
  tooltip.hidden = false;
  card.setAttribute("aria-describedby", tooltip.id);

  const cardRect = card.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportGap = 12;
  const left = Math.min(
    window.innerWidth - tooltipRect.width - viewportGap,
    Math.max(viewportGap, cardRect.left + (cardRect.width - tooltipRect.width) / 2)
  );
  const topAbove = cardRect.top - tooltipRect.height - 8;
  const topBelow = cardRect.bottom + 8;
  const top = topAbove >= viewportGap
    ? topAbove
    : Math.min(window.innerHeight - tooltipRect.height - viewportGap, topBelow);
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(Math.max(viewportGap, top))}px`;
}

function renderCalendar() {
  const weekCount = configuredPlanWeekCount();
  displayedWeekIndex = Math.max(0, Math.min(displayedWeekIndex, weekCount - 1));
  days = buildPlanWeekDays(displayedWeekIndex);
  const weekRangeTitle = $("#weekRangeTitle");
  if (weekRangeTitle) weekRangeTitle.textContent = `${days[0].date} - ${days[6].date}`;
  if ($("#weekRoundLabel")) $("#weekRoundLabel").textContent = `第一轮 · 第 ${displayedWeekIndex + 1} 周`;
  if ($("#prevWeek")) $("#prevWeek").disabled = displayedWeekIndex === 0;
  if ($("#nextWeek")) $("#nextWeek").disabled = displayedWeekIndex >= weekCount - 1;
  const calendar = $("#weekCalendar");
  hideCalendarTaskTooltip();
  const weekTasks = tasks.filter(task => taskWeekIndex(task) === displayedWeekIndex);
  const visibleCategories = new Set(weekTasks.filter(task => task.status !== "cancelled").map(task => task.category));
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
  const categoryMatchesFilter = task => activeCalendarFilter === "all" || task.category === activeCalendarFilter;
  const scheduledTasks = weekTasks.filter(task => categoryMatchesFilter(task)
    && /^\d{2}:\d{2}$/.test(task.start || "")
    && /^\d{2}:\d{2}$/.test(task.end || ""));
  const firstTaskMinute = scheduledTasks.length ? Math.min(...scheduledTasks.map(task => clockToMinutes(task.start, 8 * 60))) : 8 * 60;
  const lastTaskMinute = scheduledTasks.length ? Math.max(...scheduledTasks.map(task => clockToMinutes(task.end, 20 * 60))) : 20 * 60;
  const timelineStart = Math.floor(firstTaskMinute / 60) * 60;
  const timelineEnd = Math.max(timelineStart + 60, Math.ceil(lastTaskMinute / 60) * 60);
  const pixelsPerMinute = 1.8;
  const timelineHeight = (timelineEnd - timelineStart) * pixelsPerMinute;
  const timelineLabels = Array.from({ length: Math.floor((timelineEnd - timelineStart) / 60) + 1 }, (_, index) => timelineStart + index * 60);
  const timeAxis = `<aside class="time-axis" aria-label="计划时间线">
    <div class="time-axis-head"><span>时间</span></div>
    <div class="time-axis-body" style="height:${timelineHeight}px">
      ${timelineLabels.map(minute => `<span class="time-axis-label" style="top:${(minute - timelineStart) * pixelsPerMinute}px">${String(Math.floor(minute / 60)).padStart(2, "0")}:00</span>`).join("")}
    </div>
  </aside>`;
  calendar.innerHTML = timeAxis + days.map(day => {
    const dayTasks = weekTasks.filter(task => task.day === day.key && categoryMatchesFilter(task));
    const activeDayTasks = dayTasks.filter(task => task.status !== "cancelled");
    const total = activeDayTasks.reduce((sum, task) => sum + minutesBetween(task.start, task.end), 0);
    return `<article class="day-column timeline-day ${day.featured ? "today" : ""}">
      <header class="day-head">
        <p><span>${day.en}</span><span>${day.date}</span></p>
        <h3>${day.name}</h3>
        <small>${day.featured ? "今天 · " : ""}${Math.floor(total / 60)}小时${total % 60 ? `${total % 60}分钟` : ""}</small>
      </header>
      <div class="day-timeline" style="height:${timelineHeight}px">
        ${timelineLabels.map(minute => `<i class="timeline-grid-line" style="top:${(minute - timelineStart) * pixelsPerMinute}px" aria-hidden="true"></i>`).join("")}
        ${dayTasks.map(task => {
        const meta = categoryMeta[task.category] || categoryMeta.consolidation;
        const duration = minutesBetween(task.start, task.end);
        const title = taskDisplayTitle(task, tasks.indexOf(task));
        const calendarTitle = title.replace(/^(听力|阅读|词汇\s*\/\s*语法|词汇|语法|写作|巩固练习|错题复盘)\s*[：:·]\s*/, "");
        const calendarCategoryLabel = {
          "词汇 / 语法": "词汇语法",
          "巩固练习": "巩固",
          "错题复盘": "错题"
        }[meta.label] || meta.label;
        const priorityAdjustment = resultPriorityAdjustment(task);
        const statusLabel = calendarTaskStatusLabel(task, duration, priorityAdjustment);
        const taskTop = Math.max(0, (clockToMinutes(task.start, timelineStart) - timelineStart) * pixelsPerMinute);
        const taskHeight = Math.max(34, duration * pixelsPerMinute - 4);
        const displayNote = `${priorityAdjustment ? "系统优先 · " : ""}${taskDisplayNote(task, tasks.indexOf(task))}`;
        return `<div class="task-card timeline-task ${duration < 50 ? "compact-task" : ""} ${priorityAdjustment ? "is-priority" : ""} ${meta.className} ${task.status}" style="top:${taskTop}px;height:${taskHeight}px" data-task-id="${task.id}" data-task-category="${task.category}" tabindex="0" role="button" aria-label="${day.name} ${task.start}到${task.end} ${title}">
          <div class="task-time"><span>◷ ${task.start}-${task.end}</span><span>${calendarCategoryLabel} · ${duration}分</span></div>
          <h4>${calendarTitle || title}</h4>
          <p>${displayNote}</p>
          <span class="task-duration">${statusLabel}</span>
        </div>`;
      }).join("")}
      </div>
    </article>`;
  }).join("");

  calendar.querySelectorAll(".task-card").forEach(card => {
    const task = tasks.find(entry => String(entry.id) === String(card.dataset.taskId));
    card.addEventListener("mouseenter", () => showCalendarTaskTooltip(card, task));
    card.addEventListener("mouseleave", () => hideCalendarTaskTooltip(card));
    card.addEventListener("focus", () => showCalendarTaskTooltip(card, task));
    card.addEventListener("blur", () => hideCalendarTaskTooltip(card));
    card.addEventListener("click", () => {
      hideCalendarTaskTooltip(card);
      openTask(card.dataset.taskId);
    });
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      hideCalendarTaskTooltip(card);
      openTask(card.dataset.taskId);
    });
  });
  const calendarWrap = calendar.closest(".calendar-wrap");
  if (calendarWrap && calendarWrap.scrollWidth > calendarWrap.clientWidth) {
    const focusColumn = calendar.querySelector(".day-column.today")
      || calendar.querySelector(".task-card")?.closest(".day-column");
    if (focusColumn) {
      window.requestAnimationFrame(() => {
        const axisWidth = calendar.querySelector(".time-axis")?.offsetWidth || 0;
        calendarWrap.scrollLeft = Math.max(0, focusColumn.offsetLeft - axisWidth - 8);
      });
    }
  }
  renderCurrentTask();
  updateProgress();
}

function applyCalendarFilter(filter = "all") {
  activeCalendarFilter = activeCalendarFilter === filter ? "all" : filter;
  renderCalendar();
}

function changeDisplayedWeek(offset = 0) {
  const nextIndex = Math.max(0, Math.min(displayedWeekIndex + Number(offset || 0), configuredPlanWeekCount() - 1));
  if (nextIndex === displayedWeekIndex) return;
  displayedWeekIndex = nextIndex;
  activeCalendarFilter = "all";
  renderCalendar();
  $("#weekCalendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProgress() {
  const summary = weeklyPlanActualSummary();
  const percentage = summary.plannedTasks
    ? Math.round(summary.completedTasks / summary.plannedTasks * 100)
    : 0;
  $("#plannedHours").textContent = `${(summary.plannedSeconds / 3600).toFixed(1)} 小时`;
  $("#completedHours").textContent = formatActualStudyTime(summary.actualSeconds);
  $("#progressText").textContent = `${percentage}%`;
  $("#progressBar").style.width = `${percentage}%`;
  renderProgressView();
}

function errorQuestionSnapshot(item = {}) {
  const snapshot = item.questionSnapshot && typeof item.questionSnapshot === "object" ? item.questionSnapshot : {};
  return {
    ...snapshot,
    stem: String(snapshot.stem || item.question || "").trim(),
    options: Array.isArray(snapshot.options) ? snapshot.options : [],
    optionTranslations: Array.isArray(snapshot.optionTranslations) ? snapshot.optionTranslations : []
  };
}

function errorOriginalQuestionMarkup(item = {}) {
  const question = errorQuestionSnapshot(item);
  const hasSnapshot = Boolean(item.questionSnapshot && question.options.length);
  const listening = isListeningQuestion(question) || item.category === "listening";
  const transcript = String(question.transcript || question.audioText || "").trim();
  const transcriptZh = String(question.transcriptZh || "").trim();
  const passageZh = String(question.passageZh || "").trim();
  const selectedIndex = Number(item.selectedIndex);
  const correctIndex = Number.isInteger(Number(item.correctIndex)) ? Number(item.correctIndex) : Number(question.answer);
  if (!question.stem && !question.materialImage && !transcript && !question.options.length) return "";

  const options = question.options.length ? `<ol class="error-original-options">
    ${question.options.map((option, index) => {
      const optionZh = question.optionTranslations[index] || (index === correctIndex ? question.answerZh : "");
      const stateClass = index === correctIndex ? "is-correct" : (index === selectedIndex ? "is-selected" : "");
      const marker = index === correctIndex ? "正确答案" : (index === selectedIndex ? "你的选择" : "");
      return `<li class="${stateClass}"><b>${answerLetter(index)}.</b><span>${escapeImportText(option)}${optionZh ? `<small>${escapeImportText(optionZh)}</small>` : ""}</span>${marker ? `<em>${marker}</em>` : ""}</li>`;
    }).join("")}
  </ol>` : "";

  return `<section class="error-original-question">
    <div class="error-original-head"><span>原题回看</span>${listening && hasSnapshot ? `<button class="secondary-button compact error-original-audio" type="button" data-error-audio-id="${escapeImportText(item.id)}">播放原题</button>` : ""}</div>
    ${question.materialImage ? `<img class="error-original-image" src="${escapeImportText(question.materialImage)}" alt="当前错题的原始题图" loading="lazy" />` : ""}
    ${question.stem ? `<div class="error-original-stem"><strong>${escapeImportText(question.instruction || question.stem)}</strong>${question.instructionZh ? `<p>${escapeImportText(question.instructionZh)}</p>` : ""}</div>` : ""}
    ${question.passage ? `<div class="error-original-transcript"><span>阅读原文</span><p lang="ko">${escapeImportText(question.passage)}</p></div>` : ""}
    ${transcript ? `<div class="error-original-transcript"><span>听力原文</span><p lang="ko">${escapeImportText(transcript)}</p>${transcriptZh ? `<span>中文释义</span><p>${escapeImportText(transcriptZh)}</p>` : ""}</div>` : ""}
    ${passageZh && !transcriptZh ? `<div class="error-original-transcript"><span>原文释义</span><p>${escapeImportText(passageZh)}</p></div>` : ""}
    ${options}
    ${!hasSnapshot ? `<p class="error-original-legacy">这条错题来自旧记录，当时只保存了题干和作答结论；完整题图、原文和选项无法恢复。新产生的错题会完整保留。</p>` : ""}
  </section>`;
}

async function playErrorOriginalQuestion(button) {
  const item = errorItems.find(error => error.id === button.dataset.errorAudioId);
  const question = errorQuestionSnapshot(item || {});
  const audioSrc = listeningAudioFor(question);
  const text = listeningTextFor(question);
  if (!audioSrc && !text) return showToast("这条错题没有可播放的原始音频或原文");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = audioSrc ? "正在播放原音频…" : "正在生成朗读…";
  const reset = () => {
    button.disabled = false;
    button.textContent = originalLabel;
  };
  if (audioSrc) {
    playAudioFile(audioSrc, {
      onStart: () => { button.textContent = "正在播放原音频…"; },
      onEnd: reset,
      onError: async () => {
        if (!text) { reset(); return showToast("原始音频播放失败"); }
        button.textContent = "原音频失败，正在朗读…";
        const played = await speakKoreanDialogueText(text, { rate: LISTENING_TTS_RATE, onEnd: reset, onError: reset });
        if (!played) reset();
      }
    });
    return;
  }
  const played = await speakKoreanDialogueText(text, { rate: LISTENING_TTS_RATE, onEnd: reset, onError: reset });
  if (!played) reset();
}

function renderErrors(filter = "all") {
  refreshErrorReviewDueStates();
  $("#dueOverviewCount").textContent = `${errorItems.filter(item => item.due && !item.mastered).length} 个知识点`;
  $("#frequentOverviewCount").textContent = `${errorItems.filter(item => item.frequent && !item.mastered).length} 个强化包`;
  $("#masteredOverviewCount").textContent = `${errorItems.filter(item => item.mastered).length} 个知识点`;
  $("#errorBadge").textContent = errorItems.filter(item => !item.mastered).length;
  const dueItems = errorItems.filter(item => item.due && !item.mastered);
  $("#startDueReview").disabled = !dueItems.length;
  $("#startDueReview").textContent = dueItems.length ? `复习下一项 · ${dueItems.length}项待复习` : "暂无到期复习";
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
  $("#errorList").innerHTML = sampleBanner + items.map(item => {
    normalizeErrorReviewState(item);
    const targetCount = Number(item.reinforcementCount || 0);
    const reviewedToday = errorReviewedToday(item);
    const practiceLabel = targetCount
      ? `${reviewedToday ? "再练" : "开始"} ${targetCount} 题针对练习`
      : (showingSampleErrors ? "体验示例练习" : (reviewedToday || item.nextReviewAt ? "提前复习这道题" : (item.frequent ? "强化这道错题" : "复习这道错题")));
    return `<article class="error-card ${showingSampleErrors ? "sample-error-card" : ""}">
    <div class="error-top">
      <div>
        <div class="error-labels">
          <span class="tiny-label">${item.section}</span>
          ${item.diagnosisType ? `<span class="tiny-label frequent">${escapeImportText(item.diagnosisType)}</span>` : ""}
          ${item.frequent ? '<span class="tiny-label frequent">高频错误</span>' : ""}
          ${reviewedToday && !item.mastered ? '<span class="tiny-label reviewed">今日已复习</span>' : (item.due ? '<span class="tiny-label due">今日到期</span>' : "")}
          ${!reviewedToday && !item.due && !item.mastered && item.nextReviewAt ? `<span class="tiny-label scheduled">${escapeImportText(formatReviewDate(item.nextReviewAt))}复习</span>` : ""}
          ${item.mastered ? '<span class="tiny-label mastered">已掌握</span>' : ""}
        </div>
        <h3>${escapeImportText(item.title)}</h3>
        <p class="source">${escapeImportText(item.source)}</p>
      </div>
    </div>
    ${errorOriginalQuestionMarkup(item)}
    <div class="error-grid">
      <div class="error-field"><span>错在哪里</span><p>${escapeImportText(item.cause || item.focus)}</p></div>
      <div class="error-field"><span>正确思路</span><p>${escapeImportText(item.reasoning)}</p></div>
      <div class="error-field"><span>改进建议</span><p>${escapeImportText(item.action)}</p></div>
    </div>
    <div class="error-actions">
      <div>
        <div class="review-timeline">${item.reviews.map((state, index) => `<span class="review-dot ${state}"${state === "current" && item.nextReviewAt ? ` title="计划于${escapeImportText(formatReviewDate(item.nextReviewAt))}复习"` : ""}>${[1,3,7,14][index]}天</span>`).join("")}</div>
        <div class="pack-progress">${escapeImportText(item.progress)}</div>
      </div>
      ${item.mastered ? `<button class="secondary-button mastery-record-trigger" data-mastery-id="${item.id}" data-sample="${showingSampleErrors}">查看记录</button>` : `<button class="${targetCount ? "primary-button" : "secondary-button"} practice-trigger" data-error-id="${item.id}" data-sample="${showingSampleErrors}">${practiceLabel}</button>`}
    </div>
  </article>`;
  }).join("") || '<div class="error-card"><p>这里暂时没有记录。</p></div>';

  $("#hideSampleErrors")?.addEventListener("click", () => { showingSampleErrors = false; renderErrors("all"); });
  $$(".practice-trigger").forEach(button => button.addEventListener("click", () => startPractice(button.dataset.errorId, null, button.dataset.sample === "true")));
  $$(".mastery-record-trigger").forEach(button => button.addEventListener("click", () => openMasteryRecord(button.dataset.masteryId, button.dataset.sample === "true")));
  $$(".error-original-audio").forEach(button => button.addEventListener("click", () => playErrorOriginalQuestion(button)));
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
  const task = tasks.find(item => String(item.id) === String(id));
  if (!task) return showToast("没有找到这项任务，请刷新计划后重试");
  activeTaskId = task.id;
  const taskModalPanel = $("#taskModal .task-panel");
  taskModalPanel?.classList.remove("is-editing");
  const meta = categoryMeta[task.category] || categoryMeta.consolidation;
  const total = Number(task.checkin?.total || 0);
  const correct = Number(task.checkin?.correct || 0);
  const rate = total ? Math.round(correct / total * 100) : null;
  const hasLearningRecord = total > 0;
  const actualSeconds = taskActualStudySeconds(task);
  const partialAnswered = Number(task.checkin?.partialAnswered || 0);
  const partialCorrect = Number(task.checkin?.partialCorrect || 0);
  const latestAdjustment = [...(task.adjustments || [])].at(-1);
  const taskDays = buildPlanWeekDays(taskWeekIndex(task));
  const adjustmentFrom = baseDays.find(day => day.key === latestAdjustment?.fromDay)?.name || latestAdjustment?.fromDay || "原计划";
  const adjustmentTo = baseDays.find(day => day.key === latestAdjustment?.toDay)?.name || latestAdjustment?.toDay || "下一个学习日";
  $("#taskModalCategory").textContent = meta.label;
  $("#taskModalCategory").className = `modal-category legend-${meta.className === "vocab" ? "vocab" : meta.className}`;
  $("#taskModalTitle").textContent = taskDisplayTitle(task, tasks.indexOf(task));
  const taskDay = taskDays.find(day => day.key === task.day) || baseDays.find(day => day.key === task.day);
  $("#taskModalMeta").textContent = `第${taskWeekIndex(task) + 1}周 · ${taskDay?.name || "学习日"} ${taskDay?.date || ""} · ${task.start}-${task.end} · ${minutesBetween(task.start, task.end)}分钟`;
  const focus = taskTrainingPoint(task, tasks.indexOf(task));
  $("#taskFocusBox").innerHTML = `<span>训练重点</span><p>${focus.note || focus.point || "完成当前训练并记录真实结果。"}</p>`;
  const isMockTask = task.category === "mock";
  const hasRecordSummary = Boolean(total || actualSeconds || latestAdjustment);
  $("#taskRecordTitle").textContent = hasLearningRecord ? "答题结果" : "实际记录";
  $("#taskRecordTitle").classList.toggle("hidden", !hasRecordSummary);
  $("#taskAutoRecord").classList.toggle("hidden", !hasRecordSummary);
  $("#taskAutoRecord").innerHTML = total
    ? `<span>系统已记录</span><strong>${correct} / ${total} 题正确 · ${rate}%</strong><p>实际用时 ${formatActualStudyTime(actualSeconds)} · ${task.checkin?.updatedAt ? new Date(task.checkin.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "刚刚"}</p>${task.checkin?.planningImpact ? `<p>${escapeText(task.checkin.planningImpact)}</p>` : ""}`
    : actualSeconds
      ? `<span>真实学习记录</span><strong>${partialAnswered ? `已完成 ${partialAnswered} 题，答对 ${partialCorrect} 题` : "本组尚未作答完成"}</strong><p>${escapeText(task.checkin?.planningImpact || `已记录实际用时 ${formatActualStudyTime(actualSeconds)}，可稍后继续。`)}</p>`
      : latestAdjustment?.type === "skipped"
        ? `<span>已按实际情况调整</span><strong>这次未完成，已重新安排。</strong><p>${escapeText(latestAdjustment.reason || `${adjustmentFrom} → ${adjustmentTo}`)} · ${new Date(latestAdjustment.at).toLocaleString("zh-CN", { hour12: false })}</p>`
        : latestAdjustment?.type === "result-priority"
          ? `<span>根据真实结果调整</span><strong>这项已设为同类学习重点。</strong><p>${escapeText(latestAdjustment.reason || "系统已根据最近正确率调整优先级。")}</p>`
        : `<span>系统自动记录</span><strong>答题后自动统计正确率、错题和用时。</strong>`;
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
  $("#openPractice").textContent = isMockTask ? "开始模拟" : (partialAnswered ? "继续本组练习" : "开始学习");
  $("#skipTaskPlan").classList.toggle("hidden", hasLearningRecord || task.status === "cancelled");
  $("#skipTaskPlan").disabled = hasLearningRecord || task.status === "cancelled";
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

function focusCalendarTask(taskId) {
  switchView("calendar", { scroll: false });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const card = $$(".task-card[data-task-id]").find(item => String(item.dataset.taskId) === String(taskId));
    if (!card) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "center" });
    card.classList.add("is-plan-updated");
    card.focus({ preventScroll: true });
    window.setTimeout(() => card.classList.remove("is-plan-updated"), 2400);
  }));
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
  if (overlapsProtectedBreak(startMinutes, endMinutes) && !window.confirm(`确认保存：${selectedDayName} ${start}-${end}`)) return;
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
  closeModal("taskModal");
  focusCalendarTask(task.id);
  showToast("计划已更新，已在周计划中定位");
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

function nextStudyDayForTask(task = {}) {
  const settings = readStudySettings();
  const studyDays = Array.isArray(settings.studyDays) && settings.studyDays.length
    ? settings.studyDays
    : baseDays.map(day => day.key);
  const startDayIndex = Math.max(0, baseDays.findIndex(day => day.key === task.day));
  const startAbsoluteDay = taskWeekIndex(task) * baseDays.length + startDayIndex;
  const maximumAbsoluteDay = configuredPlanWeekCount(settings) * baseDays.length - 1;
  for (let absoluteDay = startAbsoluteDay + 1; absoluteDay <= maximumAbsoluteDay; absoluteDay += 1) {
    const candidateDay = baseDays[absoluteDay % baseDays.length]?.key;
    if (candidateDay && studyDays.includes(candidateDay)) {
      const candidate = { ...task, day: candidateDay, weekIndex: Math.floor(absoluteDay / baseDays.length) };
      const conflicts = tasks.some(existing => existing.id !== task.id
        && existing.status !== "cancelled"
        && tasksOverlap(candidate, existing));
      if (!conflicts) return { day: candidateDay, weekIndex: candidate.weekIndex };
    }
  }
  return { day: task.day, weekIndex: taskWeekIndex(task) };
}

function rescheduleActiveTask() {
  const task = tasks.find(item => item.id === activeTaskId);
  if (!task || hasPracticeRecord(task) || task.status === "cancelled") return;
  const fromDay = task.day;
  const fromWeekIndex = taskWeekIndex(task);
  const nextSchedule = nextStudyDayForTask(task);
  const nextDay = nextSchedule.day;
  const nextWeekIndex = nextSchedule.weekIndex;
  task.adjustments = [...(task.adjustments || []), {
    type: "skipped",
    at: new Date().toISOString(),
    fromDay,
    fromWeekIndex,
    toDay: nextDay,
    toWeekIndex: nextWeekIndex,
    reason: `这次未完成，已从第${fromWeekIndex + 1}周${baseDays.find(day => day.key === fromDay)?.name || "原计划"}调整到第${nextWeekIndex + 1}周${baseDays.find(day => day.key === nextDay)?.name || "下一个学习日"} ${task.start}；原记录保留。`
  }];
  task.day = nextDay;
  task.weekIndex = nextWeekIndex;
  task.status = "planned";
  persistTasksAndRefresh();
  closeModal("taskModal");
  const dayName = baseDays.find(day => day.key === nextDay)?.name || "下一个学习日";
  showToast(`这次未完成，已重新安排到第${nextWeekIndex + 1}周${dayName} ${task.start}`);
}

function defaultTomorrowFocus() {
  return "暂无复习重点。完成一组系统练习后，系统会根据真实答题结果生成。";
}

function nextStudyDayKey(fromKey = beijingDayKey()) {
  const pending = tasks
    .filter(task => task.status !== "cancelled" && !hasPracticeRecord(task))
    .sort((first, second) => pendingTaskScheduleRank(first) - pendingTaskScheduleRank(second));
  const future = pending.find(task => taskScheduledDateKey(task) > beijingDateKey());
  const candidate = future || pending[0];
  return candidate ? { day: candidate.day, weekIndex: taskWeekIndex(candidate) } : { day: fromKey, weekIndex: 0 };
}

function taskFocusLabel(task) {
  return task ? `「${taskDisplayTitle(task, tasks.indexOf(task))}」` : "";
}

function uniqueTextParts(parts = []) {
  const seen = new Set();
  return parts
    .map(part => String(part || "").trim())
    .filter(part => {
      if (!part) return false;
      const key = part
        .replace(/\s+/g, "")
        .replace(/[。；;,.，、：:！!？?]/g, "")
        .replace(/^(需要|建议|请|先|再)+/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function compactRepeatedClauses(text = "") {
  return uniqueTextParts(String(text).split(/[；;。]+|[，,]\s*(?=(?:需要|建议|请|先|再|标记|记录|复听|重做|整理))/)).join("；");
}

function tomorrowPriorityTask(tomorrowTasks = [], profile = studyPerformanceProfile()) {
  const available = tomorrowTasks.filter(task => task.status !== "cancelled" && !hasPracticeRecord(task));
  if (!available.length) return null;
  if (profile.weakCategory) {
    const direct = available.find(task => normalizeStudyCategory(task.category) === profile.weakCategory);
    if (direct) return direct;
    const consolidation = available.find(task => ["consolidation", "review"].includes(normalizeStudyCategory(task.category)));
    if (consolidation) return consolidation;
  }
  return available[0];
}

function tomorrowPlanFocus(profile = studyPerformanceProfile()) {
  const tomorrowSchedule = nextStudyDayKey();
  const tomorrowTasks = tasks.filter(task => task.day === tomorrowSchedule.day
    && taskWeekIndex(task) === tomorrowSchedule.weekIndex
    && task.status !== "cancelled");
  if (!tomorrowTasks.length) return defaultTomorrowFocus();
  const priority = tomorrowPriorityTask(tomorrowTasks, profile) || tomorrowTasks[0];
  const moreCount = Math.max(0, tomorrowTasks.filter(task => task !== priority && !hasPracticeRecord(task)).length);
  const weakPrefix = profile.weakCategory && profile.weakAccuracy !== null && profile.weakWrong > 0
    ? `最近${categoryLabel(profile.weakCategory)}正确率 ${profile.weakAccuracy}%`
    : "";
  const priorityAdjustment = resultPriorityAdjustment(priority);
  const action = moreCount
    ? `明天先做${taskFocusLabel(priority)}，再完成另外 ${moreCount} 组学习任务。`
    : `明天先做${taskFocusLabel(priority)}。`;
  if (priorityAdjustment?.reason) return compactRepeatedClauses(`${priorityAdjustment.reason} ${action}`);
  return weakPrefix ? `${weakPrefix}，${action}` : `按 T+1 学习计划，${action}`;
}

function todayWrongFocus(profile = studyPerformanceProfile()) {
  const wrongTask = profile.todayWrongTask;
  if (!wrongTask) return "";
  const wrongCount = taskWrongCount(wrongTask);
  if (wrongTask.category === "dictation") {
    return `先重听今天${taskFocusLabel(wrongTask)}中写错的 ${wrongCount} 个词。`;
  }
  const note = compactRepeatedClauses(String(wrongTask.checkin.note || wrongTask.checkin.reflection || "")
    .replace(/^AI自动记录：/, "")
    .replace(/^错\d+题[；;。]*/, "")).slice(0, 36);
  return note
    ? `先复盘今天${taskFocusLabel(wrongTask)}的 ${wrongCount} 道错题：${note}。`
    : `先复盘今天${taskFocusLabel(wrongTask)}的 ${wrongCount} 道错题。`;
}

function buildTomorrowFocus() {
  const profile = studyPerformanceProfile();
  if (!profile.records.length) return defaultTomorrowFocus();
  const wrongFocus = todayWrongFocus(profile);
  if (!wrongFocus && profile.weakWrong === 0) return "今天没有产生错题，明日无需额外复习。";
  const planFocus = tomorrowPlanFocus(profile);
  return compactRepeatedClauses(wrongFocus ? `${wrongFocus} ${planFocus}` : planFocus);
}

function updateTomorrowFocus(text = "") {
  const focus = text || buildTomorrowFocus();
  $("#tomorrowFocus").textContent = focus;
  $("#tomorrowFocusCard")?.classList.toggle("hidden", completedPracticeTasks().length === 0 && !hasActualReviewNeed());
  localStorage.setItem("topikPrototypeTomorrowFocus", focus);
}

function readStudySettings() {
  return JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null") || {
    exam: "TOPIK",
    level: "I",
    targetGrade: "2",
    weak: ["听力", "阅读"],
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

function listeningFallbackForContext(context = {}) {
  const settings = context?.settings || readStudySettings();
  const task = context?.task || {};
  const level = task.examLevel || task.level || settings.level;
  if (settings.exam === "TOPIK" && level === "I") return topikIListeningFallbackQuestions;
  return listeningFallbackQuestions;
}

function localFallbackForContext(errorId, context) {
  const materialPractice = materialPracticeForContext(context);
  if (materialPractice.length) return materialPractice;
  if (isListeningPracticeContext(context)) return listeningFallbackForContext(context);
  if (context?.category === "reading") return topikIReadingFallbackQuestions;
  return fallbackPracticeQuestions(errorId);
}

function safeMaterialImagePath(path = "") {
  const imagePath = String(path || "").trim();
  if (!imagePath) return "";
  if (imagePath.includes("/block-cn/")) {
    return imagePath.replace("/block-cn/block-", "/question/question-").replace(/\.png$/i, "-korean.png");
  }
  if (!imagePath.includes("/question/")) return "";
  return imagePath;
}

function safeAudioPath(path = "") {
  const audioPath = String(path || "").trim();
  if (!audioPath) return "";
  if (!audioPath.startsWith("assets/materials/")) return "";
  if (!/\.(mp3|m4a|wav|ogg)$/i.test(audioPath)) return "";
  return audioPath;
}

function questionBankMatchesContext(bank, settings, context = {}) {
  const baseMatches = bank.exam === settings.exam &&
    bank.level === settings.level &&
    bank.category === context.category;
  if (!baseMatches) return false;

  const taskText = materialContextText(context);
  const matchTerms = Array.isArray(bank.matchTerms) && bank.matchTerms.length
    ? bank.matchTerms
    : [bank.skillLabel].filter(Boolean);

  return matchTerms.some(term => taskText.includes(String(term)));
}

function stableHashText(value = "") {
  return Array.from(String(value || "")).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 0);
}

function materialContextText(context = {}) {
  return [
    context.title,
    context.task?.title,
    context.task?.note,
    context.category
  ].filter(Boolean).join(" ");
}

function materialQuestionText(question = {}) {
  return [
    question.materialQuestionId,
    question.stem,
    question.stemZh,
    question.transcript,
    question.transcriptZh,
    question.explanation,
    question.explanationZh,
    question.source
  ].filter(Boolean).join(" ");
}

function materialPriorityScore(question = {}, context = {}) {
  const contextText = materialContextText(context);
  const questionText = materialQuestionText(question);
  const rules = [
    {
      context: /数字|时间|日期|价格|数量|几点|几月|多少|number|time|date|price/i,
      question: /数字|时间|日期|价格|数量|월|일|시|분|원|가격|시간|날짜|얼마|몇/i
    },
    {
      context: /否定|时态|过去|未来|将来|tense|negative/i,
      question: /否定|时态|过去|未来|将来|안\s|못|않|았|었|겠|예정/i
    },
    {
      context: /下一步|行动|请求|建议|做什么|action|next/i,
      question: /下一步|行动|请求|建议|做什么|주세요|부탁|요청|보내|가다|오다/i
    },
    {
      context: /原因|理由|为什么|reason|why/i,
      question: /原因|理由|为什么|왜|때문|이유/i
    },
    {
      context: /图|图表|看图|picture|graph/i,
      question: /图|图表|看图|그림|그래프|사진/i
    },
    {
      context: /复述|听后|原文|retell|summary/i,
      question: /复述|听后|原文|transcript|다시|요약/i
    }
  ];
  return rules.reduce((score, rule) => {
    if (!rule.context.test(contextText)) return score;
    return score + (rule.question.test(questionText) ? 10 : 0);
  }, 0);
}

function orderedMaterialQuestionsForContext(questions = [], context = {}) {
  const uniqueQuestions = [];
  const seen = new Set();
  questions.forEach(question => {
    const key = question.materialQuestionId || question.questionId || question.materialImage || question.stem;
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueQuestions.push(question);
  });
  if (uniqueQuestions.length <= 1) return uniqueQuestions;
  const rotation = stableHashText(materialContextText(context)) % uniqueQuestions.length;
  return uniqueQuestions
    .map((question, index) => ({
      question,
      index,
      score: materialPriorityScore(question, context)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return ((a.index + rotation) % uniqueQuestions.length) - ((b.index + rotation) % uniqueQuestions.length);
    })
    .map(item => item.question);
}

function realMaterialQuestionsForContext(context = {}, limit = 5) {
  const settings = context.settings || readStudySettings();
  const match = realMaterialQuestionBank.find(item => questionBankMatchesContext(item, settings, context));
  const questions = match ? orderedMaterialQuestionsForContext(match.questions, context) : [];
  return match ? questions.slice(0, limit).map(question => ({
    ...question,
    materialSetId: match.id,
    materialSetTitle: match.title,
    sourceType: match.sourceType,
    sourceTitle: match.sourceTitle,
    sourceDetail: match.sourceDetail,
    skillLabel: match.skillLabel,
    trainingPoint: match.trainingPoint,
    questionType: question.questionType || match.skillLabel
  })) : [];
}

function materialPracticeForContext(context = {}, limit = 5) {
  return realMaterialQuestionsForContext(context, limit);
}

function currentListeningKey() {
  return `${questionIndex}`;
}

function resetListeningPlaybackState() {
  listeningPlaybackState = { key: "", status: "idle", message: "" };
  listeningIsSpeaking = false;
}

function setListeningPlaybackState(status = "idle", message = "", key = currentListeningKey()) {
  listeningPlaybackState = { key, status, message };
  listeningIsSpeaking = status === "generating" || status === "playing";
  renderQuestion();
}

function markListeningPlaybackFailed(key, message) {
  listeningPlaybackState = { key, status: "error", message };
  listeningIsSpeaking = false;
  renderQuestion();
}

function listeningTtsPlaybackOptions(key, generatingMessage = "正在生成 AI 朗读音频") {
  setListeningPlaybackState("generating", generatingMessage, key);
  return {
    rate: LISTENING_TTS_RATE,
    onStart: () => setListeningPlaybackState("playing", "正在播放 AI 朗读", key),
    onEnd: () => setListeningPlaybackState("idle", "", key),
    onError: () => markListeningPlaybackFailed(key, "音频生成或播放失败，点按钮重试")
  };
}

function stopListeningAudio() {
  stopTtsAudio();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  resetListeningPlaybackState();
}

function listeningDescriptorFor(question = {}) {
  return [
    question.source,
    question.questionType,
    question.sourceTitle,
    question.title,
    question.category,
    question.skillLabel,
    question.trainingPoint
  ].filter(Boolean).join(" ");
}

function isListeningQuestion(question = {}) {
  return Boolean(
    question.audioSrc
      || question.audioText
      || question.transcript
      || /listening|듣기|听力|听/i.test(listeningDescriptorFor(question))
  );
}

function listeningTextFor(question = {}) {
  const direct = String(question.audioText || question.transcript || "").trim();
  if (direct) return direct;
  if (!isListeningQuestion(question)) return "";
  return String(question.audioPrompt || question.dialogue || question.stem || question.prompt || question.question || "").trim();
}

function listeningAudioFor(question = {}) {
  return safeAudioPath(question.audioSrc || question.audioUrl || question.audioFile || "");
}

function isListeningPracticeContext(context = {}) {
  return context?.category === "listening" || context?.task?.category === "listening";
}

function looksLikeGrammarFillQuestion(question = {}) {
  const stem = String(question.stem || "");
  const options = Array.isArray(question.options) ? question.options.map((option) => String(option).trim()) : [];
  const optionsText = options.join("");
  return /[_＿]{2,}|（\s*）|\(\s*\)|빈칸|알맞은 것/i.test(stem)
    || (options.length > 0 && options.every((option) => /^[가-힣]{1,3}$/.test(option)))
    || /^[는이가을를에도만은]+$/.test(optionsText);
}

function isPlayableListeningPracticeQuestion(question = {}) {
  const hasAudioSource = Boolean(listeningAudioFor(question) || listeningTextFor(question));
  if (!hasAudioSource) return false;
  if (isListeningQuestion(question)) return true;
  return !looksLikeGrammarFillQuestion(question);
}

function playAudioFile(src, callbacks = {}) {
  if (!src) return false;
  stopTtsAudio();
  const audio = new Audio(src);
  activeTtsAudio = audio;
  audio.onplay = callbacks.onStart || null;
  audio.onended = () => {
    stopTtsAudio();
    callbacks.onEnd?.();
  };
  audio.onerror = () => {
    stopTtsAudio();
    callbacks.onError?.();
  };
  audio.play().catch(() => {
    stopTtsAudio();
    callbacks.onError?.();
  });
  return true;
}

async function playListeningQuestion() {
  const question = activePractice[questionIndex];
  const audioSrc = listeningAudioFor(question);
  const text = listeningTextFor(question);
  const key = currentListeningKey();
  const currentCount = listeningPlayCounts[key] || 0;
  const isReview = questionGraded;
  if (!audioSrc && !text) return showToast("这题暂时没有可播放音频，已作为文本题处理");
  if (!isReview && currentCount >= LISTENING_PLAY_LIMIT) return showToast("答题阶段最多播放2次，提交后可反复复听");
  stopListeningAudio();
  if (!isReview) listeningPlayCounts[key] = currentCount + 1;

  if (audioSrc) {
    setListeningPlaybackState("playing", "正在播放原始音频", key);
    playAudioFile(audioSrc, {
      onStart: () => setListeningPlaybackState("playing", "正在播放原始音频", key),
      onEnd: () => setListeningPlaybackState("idle", "", key),
      onError: async () => {
        if (!text) {
          if (!isReview) listeningPlayCounts[key] = currentCount;
          markListeningPlaybackFailed(key, "原始音频播放失败，稍后再试");
          showToast("原始音频暂时播放失败，请稍后再试");
          return;
        }
        showToast("原始音频暂时失败，先用 AI 朗读练习");
        const played = await speakKoreanDialogueText(text, listeningTtsPlaybackOptions(key, "原始音频失败，正在生成 AI 朗读"));
        if (!played) {
          if (!isReview) listeningPlayCounts[key] = currentCount;
          markListeningPlaybackFailed(key, "AI 朗读生成失败，点按钮重试");
        }
      }
    });
    return;
  }

  const started = await speakKoreanDialogueText(text, listeningTtsPlaybackOptions(key));
  if (!started) {
    if (!isReview) listeningPlayCounts[key] = currentCount;
    markListeningPlaybackFailed(key, "AI 朗读生成失败，点按钮重试");
  }
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
  const resultNote = wrong
    ? `${wrong} 道错题已进入错题集。`
    : "本组全部正确。";
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
      <p>${escapeImportText(resultNote)}</p>
    </div>
    ${wrong ? `<div class="result-actions">
      <button class="secondary-button" id="retryWrongQuestions" type="button">重做错题</button>
    </div>` : ""}
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
  startPracticeQuestionTimer();
  renderQuestion();
}

function splitPracticeStem(item = {}) {
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

function normalizePracticeQuestions(items, limit = 5) {
  return (items || []).map((item, index) => {
    const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : [];
    const answer = Number(item.answer);
    const audioText = String(item.audioText || item.audio || item.transcript || "").trim();
    const content = splitPracticeStem(item);
    return {
      stem: content.instruction,
      instruction: content.instruction,
      instructionZh: String(item.instructionZh || item.promptZh || item.questionPromptZh || "").trim(),
      passage: content.passage,
      stemZh: String(item.stemZh || item.questionZh || item.stemChinese || "").trim(),
      options,
      optionTranslations: Array.isArray(item.optionTranslations || item.optionsZh) ? (item.optionTranslations || item.optionsZh).map(String).slice(0, 4) : [],
      answer: Number.isInteger(answer) ? answer : 0,
      explanation: String(item.explanation || item.reason || "系统会根据答案依据继续调整后续练习。").trim(),
      explanationZh: String(item.explanationZh || item.explanationChinese || item.reasonZh || "").trim(),
      answerZh: String(item.answerZh || item.correctAnswerZh || "").trim(),
      questionId: String(item.questionId || item.materialQuestionId || "").trim(),
      materialQuestionId: String(item.materialQuestionId || item.questionId || "").trim(),
      materialSetId: String(item.materialSetId || "").trim(),
      source: item.source ? String(item.source).slice(0, 120) : "",
      sourceType: String(item.sourceType || "").trim(),
      sourceTitle: String(item.sourceTitle || "").trim(),
      sourceDetail: String(item.sourceDetail || "").trim(),
      materialSetTitle: String(item.materialSetTitle || "").trim(),
      materialImage: safeMaterialImagePath(item.materialImage || item.image || ""),
      audioSrc: safeAudioPath(item.audioSrc || item.audioUrl || item.audioFile || ""),
      passageZh: String(item.passageZh || item.passageChinese || item.sourceTextZh || "").trim(),
      audioText,
      transcript: String(item.transcript || audioText).trim(),
      transcriptZh: String(item.transcriptZh || item.transcriptChinese || item.audioTextZh || "").trim(),
      questionType: String(item.questionType || item.type || "").trim(),
      skillLabel: String(item.skillLabel || "").trim(),
      trainingPoint: String(item.trainingPoint || "").trim()
    };
  }).filter(item => item.stem && item.options.length >= 2 && item.answer >= 0 && item.answer < item.options.length).slice(0, limit);
}

function answerLetter(index) {
  return String.fromCharCode(65 + index);
}

function questionMeaningText(question = {}) {
  if (question.instructionZh) return question.instructionZh;
  const stem = String(question.instruction || question.stem || "").trim();
  if (/글의 중심 생각/.test(stem)) return "阅读原文，选择最能概括文章中心思想的一项。";
  if (/내용과 같은 것을/.test(stem)) return "阅读原文，选择与文章内容一致的一项。";
  if (/내용과 다른 것을/.test(stem)) return "阅读原文，选择与文章内容不一致的一项。";
  if (/필자의 태도/.test(stem)) return "阅读原文，选择最符合作者态度的一项。";
  if (/빈칸에 들어갈/.test(stem)) return "阅读原文，选择最适合填入空白处的一项。";
  if (question.stemZh) return question.stemZh;
  if (/이유는 무엇입니까|왜\s/.test(stem)) return "题目在问事情发生的原因，请根据原文选择正确原因。";
  if (/무엇을 하라고 했습니까/.test(stem)) return "题目在问一个人让另一个人做什么，请选择原文中的具体行动。";
  if (/내용과 같은 것을 고르십시오/.test(stem)) return "请选择与原文内容一致的一项。";
  if (/내용과 다른 것을 고르십시오/.test(stem)) return "请选择与原文内容不一致的一项。";
  if (/말하기 목적/.test(stem)) return "题目在问说话人的表达目的，请根据整段内容判断。";
  if (/어디에서|장소/.test(stem)) return "题目在问地点，请根据原文选择正确位置。";
  if (/몇 시|언제/.test(stem)) return "题目在问时间，请根据原文选择正确时间。";
  if (stem) return `请根据原文回答题目：${stem}`;
  return "当前题目内容暂未返回中文说明。";
}

function originalMeaningText(question = {}) {
  if (question.passageZh) return question.passageZh;
  return "";
}

function practiceExplanationText(question = {}) {
  return question.explanationZh || question.explanation || "这道题要根据题干中的关键信息判断，正确选项和原文信息一致。";
}

function persistErrorItems() {
  localStorage.setItem("topikPrototypeImportedErrors", JSON.stringify(errorItems.filter(item => String(item.id).startsWith("imported-"))));
  localStorage.setItem("topikPrototypePracticeErrors", JSON.stringify(errorItems.filter(item => String(item.id).startsWith("practice-"))));
}

const ERROR_REVIEW_STAGE_DAYS = [1, 3, 7, 14];

function normalizeErrorReviewState(item = {}) {
  item.filter = Array.isArray(item.filter) ? item.filter : [];
  item.reviews = Array.isArray(item.reviews) && item.reviews.length === ERROR_REVIEW_STAGE_DAYS.length
    ? item.reviews.slice(0, ERROR_REVIEW_STAGE_DAYS.length)
    : ["current", "", "", ""];
  const currentStage = item.reviews.findIndex(state => state === "current");
  item.reviewStage = Number.isInteger(Number(item.reviewStage))
    ? Math.max(0, Math.min(ERROR_REVIEW_STAGE_DAYS.length - 1, Number(item.reviewStage)))
    : Math.max(0, currentStage);
  item.reviewAttempts = Array.isArray(item.reviewAttempts) ? item.reviewAttempts : [];
  item.masteryHistory = Array.isArray(item.masteryHistory) ? item.masteryHistory : [];
  const legacyReinforcementCount = Number(item.reinforcementCount || 0);
  if (item.frequent && legacyReinforcementCount > 0 && legacyReinforcementCount < 5) {
    item.reinforcementCount = legacyReinforcementCount === 2 ? 5 : 10;
  }
  return item;
}

function errorReviewedToday(item = {}) {
  if (!item.lastReviewedAt) return false;
  const reviewedAt = new Date(item.lastReviewedAt);
  return !Number.isNaN(reviewedAt.getTime()) && beijingDateKey(reviewedAt) === beijingDateKey();
}

function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待安排";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

function reviewDateAfterDays(days, from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + Number(days || 1));
  return next.toISOString();
}

function setErrorDueState(item, due) {
  item.due = Boolean(due) && !item.mastered;
  item.filter = Array.isArray(item.filter) ? item.filter.filter(value => value !== "due") : [];
  if (item.due) item.filter.unshift("due");
}

function refreshErrorReviewDueStates() {
  let changed = false;
  const now = Date.now();
  errorItems.forEach(item => {
    normalizeErrorReviewState(item);
    if (item.mastered || !item.nextReviewAt) return;
    const scheduledAt = new Date(item.nextReviewAt).getTime();
    if (Number.isNaN(scheduledAt)) return;
    const shouldBeDue = scheduledAt <= now;
    if (Boolean(item.due) !== shouldBeDue) {
      setErrorDueState(item, shouldBeDue);
      changed = true;
    }
  });
  if (changed) {
    persistErrorItems();
    scheduleCloudSave();
  }
}

function applyErrorReviewResult(item, { correct = 0, total = 0, rate = 0, completedAt = new Date().toISOString() } = {}) {
  normalizeErrorReviewState(item);
  const stage = item.reviewStage;
  const passed = total > 0 && rate >= 80;
  const stageLabel = `${ERROR_REVIEW_STAGE_DAYS[stage]}天复习`;
  const attempt = {
    completedAt,
    stage,
    correct,
    total,
    rate,
    passed
  };
  item.lastReviewedAt = completedAt;
  item.lastReviewResult = attempt;
  item.reviewAttempts = [...item.reviewAttempts, attempt].slice(-20);
  item.masteryHistory = [...item.masteryHistory, {
    date: formatReviewDate(completedAt),
    stage: stageLabel,
    result: `${correct} / ${total}`,
    note: passed ? "达到80%，进入下一次延迟复习" : "未达到80%，次日重做本阶段"
  }].slice(-20);

  if (!passed) {
    item.nextReviewAt = reviewDateAfterDays(1, new Date(completedAt));
    setErrorDueState(item, false);
    item.progress = `本次复习 ${correct} / ${total}题 · ${rate}%；${formatReviewDate(item.nextReviewAt)}再练`;
    const currentCount = Number(item.reinforcementCount || 0);
    item.reinforcementCount = currentCount >= 20 ? 20 : currentCount >= 10 ? 10 : 5;
    return item;
  }

  item.reviews[stage] = "done";
  item.reinforcementCount = 0;
  if (stage >= ERROR_REVIEW_STAGE_DAYS.length - 1) {
    item.mastered = true;
    item.masteredAt = new Date(completedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
    item.nextReviewAt = "";
    item.reviews = ERROR_REVIEW_STAGE_DAYS.map(() => "done");
    item.filter = item.filter.filter(value => value !== "due" && value !== "frequent" && value !== "mastered");
    item.filter.push("mastered");
    item.due = false;
    item.frequent = false;
    item.progress = `本次复习 ${correct} / ${total}题 · ${rate}%；已完成14天复习`;
    return item;
  }

  item.reviewStage = stage + 1;
  item.reviews[item.reviewStage] = "current";
  item.nextReviewAt = reviewDateAfterDays(ERROR_REVIEW_STAGE_DAYS[item.reviewStage], new Date(completedAt));
  setErrorDueState(item, false);
  item.progress = `本次复习 ${correct} / ${total}题 · ${rate}%；下次 ${formatReviewDate(item.nextReviewAt)}`;
  return item;
}

function diagnosePracticeError(task = {}, result = {}) {
  const question = result.question || {};
  const isListening = isListeningQuestion(question) || task.category === "listening";
  const questionSignals = [
    question.questionType,
    question.skillLabel,
    question.trainingPoint,
    question.sourceTitle,
    question.materialSetTitle,
    question.stem,
    question.stemZh
  ].filter(Boolean).join(" ");
  const isVocabularyQuestion = /词汇|词义|生词|近义|反义|어휘|단어|유의어|반의어/i.test(questionSignals);
  const isGrammarQuestion = task.category === "grammar"
    || (task.category !== "reading" && looksLikeGrammarFillQuestion(question));
  const elapsedSeconds = Number(result.elapsedSeconds || 0);
  const hasMaterial = Boolean(question.materialImage || question.passageZh || question.sourceTitle || question.materialSetTitle);
  if (isListening) return {
    type: "听错关键词",
    wrong: "没有等完整信息，或漏掉了决定答案的关键词。",
    next: "复听原文，先标出否定、时间、人物动作等关键信息，再选答案。"
  };
  if (elapsedSeconds >= 180) return {
    type: "时间分配问题",
    wrong: `本题实际作答约 ${Math.max(3, Math.round(elapsedSeconds / 60))} 分钟，单题停留过久影响整组节奏。`,
    next: "先用 60 秒定位依据；90 秒仍不确定就标记后跳过，整组完成后再回来。"
  };
  if (isVocabularyQuestion) return {
    type: "生词影响",
    wrong: "题干或选项中的核心词义没有确认，导致理解方向偏离。",
    next: "只记录本题决定答案的核心生词和一条原句，再做一题同义辨析。"
  };
  if (task.category === "vocab" || isGrammarQuestion) return {
    type: "知识点不会",
    wrong: "当前题考查的词义、助词或句型规则还没有掌握。",
    next: "先用正确答案回看规则，再做一题同型辨析确认理解。"
  };
  if (task.category === "reading" || hasMaterial) return {
    type: "题目理解错误",
    wrong: "题干要求或原文条件没有逐项对照，导致把局部信息当成答案。",
    next: "先圈出题干问什么，再回原文核对时间、对象和条件。"
  };
  return {
    type: "注意力或粗心",
    wrong: "已经接近正确思路，但作答前没有完成最后一次条件核对。",
    next: "提交前用 5 秒复核题干、选项和你找到的依据是否一致。"
  };
}

function koreanKeywords(text = "") {
  const ignored = new Set(["사람", "것을", "것이", "하는", "있는", "없는", "입니다", "합니다"]);
  return [...new Set(String(text).match(/[가-힣]{2,}/g) || [])].filter(token => !ignored.has(token)).slice(0, 2);
}

function buildPracticeImprovementAdvice(task = {}, question = {}, result = {}) {
  const correctOption = String(question.options?.[question.answer] || result.answer || "").trim();
  const correctOptionZh = String(question.answerZh || question.optionTranslations?.[question.answer] || result.answerZh || "").trim();
  const selectedOption = String(question.options?.[result.selected] || "").trim();
  const selectedOptionZh = String(question.optionTranslations?.[result.selected] || "").trim();
  const correctKeywords = koreanKeywords(correctOption);
  const selectedKeywords = koreanKeywords(selectedOption);
  const correctCue = correctKeywords.length ? correctKeywords.join("、") : (correctOption || correctOptionZh || "正确选项");
  const selectedCue = selectedKeywords.length ? selectedKeywords.join("、") : (selectedOption || selectedOptionZh || "错误选项");
  const correctMeaning = correctOptionZh || correctOption || "正确答案";

  if (isListeningQuestion(question) || task.category === "listening") {
    return `复听时重点确认“${correctCue}”，不要因为听到相近场景就联想到“${selectedCue}”。听完先用中文复述“${correctMeaning}”，再选择。`;
  }
  if (Number(result.elapsedSeconds || 0) >= 180) {
    return `本题先限时 90 秒：前 60 秒定位题干条件和原文依据，后 30 秒排除“${selectedOptionZh || selectedOption || "错误选项"}”；仍不确定就先标记，完成整组后再回来。`;
  }
  if (task.category === "reading" || question.materialImage || question.passageZh) {
    return `回到原文找到支持“${correctMeaning}”的具体句子，并在“${selectedOptionZh || selectedOption || "错误选项"}”旁写出不符合题干的条件；找不到原文证据就不选。`;
  }
  if (task.category === "vocab" || task.category === "grammar" || looksLikeGrammarFillQuestion(question)) {
    return `把“${correctOption || correctMeaning}”和“${selectedOption || "错误选项"}”放回当前句子各读一遍，写下只有正确答案成立的词义或语法条件，再做下一题。`;
  }
  return `提交前用题干逐项排除“${selectedOptionZh || selectedOption || "错误选项"}”，并说出支持“${correctMeaning}”的一条原文证据。`;
}

function createPracticeQuestionSnapshot(question = {}) {
  const normalized = normalizePracticeQuestions([question], 1)[0];
  return normalized || {
    stem: String(question.stem || question.question || "").trim(),
    stemZh: String(question.stemZh || question.questionZh || "").trim(),
    options: Array.isArray(question.options) ? question.options.map(String) : [],
    optionTranslations: Array.isArray(question.optionTranslations) ? question.optionTranslations.map(String) : [],
    answer: Number(question.answer) || 0
  };
}

function createPracticeErrorItems(task, wrongResults = []) {
  if (!task || !wrongResults.length) return [];
  const taskIndex = tasks.indexOf(task);
  const title = taskDisplayTitle(task, taskIndex);
  const section = categoryMeta[task.category]?.label || "练习";
  const timestamp = Date.now();
  const created = [];
  wrongResults.forEach((result, index) => {
    const question = result.question || {};
    const diagnosis = diagnosePracticeError(task, result);
    const correctOption = question.options?.[question.answer] || result.answer || "";
    const correctOptionZh = question.answerZh || question.optionTranslations?.[question.answer] || result.answerZh || "";
    const selectedOption = question.options?.[result.selected] || "";
    const selectedOptionZh = question.optionTranslations?.[result.selected] || "";
    const focus = question.questionType || question.sourceTitle || question.materialSetTitle || title;
    const correctLine = [correctOption, correctOptionZh].filter(Boolean).join(" / ");
    const selectedLine = selectedOption ? [selectedOption, selectedOptionZh].filter(Boolean).join(" / ") : "未作答";
    const repeatedCount = errorItems.concat(created).filter(item =>
      !item.mastered && item.section === section && item.diagnosisType === diagnosis.type
    ).length;
    const reinforcementCount = repeatedCount >= 3 ? 20 : repeatedCount === 2 ? 10 : repeatedCount === 1 ? 5 : 0;
    created.push({
      id: `practice-${task.id || "task"}-${timestamp}-${index}`,
      filter: repeatedCount ? ["due", "frequent"] : ["due"],
      section,
      category: task.category,
      title: `${title} · 第 ${result.index + 1} 题`,
      source: "系统练习自动整理",
      due: true,
      frequent: repeatedCount > 0,
      diagnosisType: diagnosis.type,
      focus: focus || "回看本题题干与正确答案依据。",
      cause: `${diagnosis.wrong} 你的选择：${selectedLine}`,
      reasoning: `正确答案：${answerLetter(question.answer)}. ${correctLine || "回看正确选项"}。${practiceExplanationText(question)}`,
      action: buildPracticeImprovementAdvice(task, question, result),
      reinforcementCount,
      progress: reinforcementCount ? `同类错误重复，待做 ${reinforcementCount} 题针对练习` : "待复盘 0 / 1题",
      reviews: ["current", "", "", ""],
      reviewStage: 0,
      reviewAttempts: [],
      taskId: task.id || "",
      question: question.stem || "",
      questionSnapshot: createPracticeQuestionSnapshot(question),
      selectedIndex: Number.isInteger(Number(result.selected)) ? Number(result.selected) : -1,
      correctIndex: Number.isInteger(Number(question.answer)) ? Number(question.answer) : -1,
      createdAt: new Date().toISOString()
    });
  });
  errorItems.unshift(...created);
  persistErrorItems();
  return created;
}

function renderPracticeFeedback(question = {}, correct = false) {
  const correctOption = question.options?.[question.answer] || "";
  const correctOptionZh = question.answerZh || question.optionTranslations?.[question.answer] || "";
  const listening = isListeningQuestion(question);
  const transcript = listeningTextFor(question);
  const transcriptZh = String(question.transcriptZh || "").trim();
  const originalMeaning = originalMeaningText(question);
  const sourceMeaning = listening && transcript
    ? `<div class="feedback-mini-line feedback-source-line"><span>听力原文</span><p lang="ko">${escapeImportText(transcript)}</p>${transcriptZh ? `<span>中文释义</span><p>${escapeImportText(transcriptZh)}</p>` : ""}</div>`
    : originalMeaning
      ? `<div class="feedback-mini-line feedback-source-line"><span>原文释义</span><p>${escapeImportText(originalMeaning)}</p></div>`
      : "";
  return `<div class="feedback-answer-line">
    <span>${correct ? "回答正确" : "正确答案"}</span>
    <strong>${answerLetter(question.answer)}. ${escapeImportText(correctOption)}</strong>
    ${correctOptionZh ? `<p>${escapeImportText(correctOptionZh)}</p>` : ""}
  </div>
  <div class="feedback-mini-line"><span>题目要求</span><p>${escapeImportText(questionMeaningText(question))}</p></div>
  ${sourceMeaning}
  <div class="feedback-mini-line"><span>答题解析</span><p>${escapeImportText(practiceExplanationText(question))}</p></div>`;
}

function getPracticeContext(errorId, linkedTaskId) {
  const settings = readStudySettings();
  const task = linkedTaskId ? tasks.find(item => item.id === linkedTaskId) : null;
  const error = linkedTaskId ? null : errorItems.find(item => item.id === errorId);
  const examLabel = getExamPracticeLabel(settings);
  const category = task?.category || error?.category || (errorId === "imported-1" ? "review" : "vocab");
  const title = task ? taskDisplayTitle(task, tasks.indexOf(task)) : (error?.title || (errorId === "imported-1" ? "导入错题诊断" : "错题变式复习"));
  return { settings, task, error, examLabel, category, title };
}

async function loadExamDrivenPractice(errorId, linkedTaskId, questionCount = 5) {
  const context = getPracticeContext(errorId, linkedTaskId);
  const materialPractice = materialPracticeForContext(context, questionCount);
  if (materialPractice.length) {
    return {
      questions: materialPractice,
      fallbackUsed: false,
      generatedCount: materialPractice.length,
      providerIssue: ""
    };
  }
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
      errorDiagnosis: context.error?.diagnosisType || "",
      standards: context.task?.standards || [],
      weak: context.settings.weak || [],
      studyContent: context.settings.studyContent || "",
      requestedQuestionCount: questionCount,
      sourcePolicy: "优先参考官方公开样题、公开真题题型和用户资料来校准考试模块与难度；按当前训练点生成原创同型练习，不把训练标签写成官方分类，也不直接复刻受版权限制的整套真题。"
    }
  };
  const result = await callStudyAssistant("practice", requestPayload, { timeoutMs: 16000 });
  const questions = normalizePracticeQuestions(result?.questions || result?.practice?.questions, questionCount);
  if (!questions.length) throw new Error("No generated questions returned");
  return {
    questions,
    fallbackUsed: Boolean(result?.quality?.fallbackUsed),
    generatedCount: Number(result?.quality?.passed || 0),
    providerIssue: String(result?.quality?.providerIssue || "")
  };
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
  const externalToday = readExternalStudyRecords().filter(record => record.createdAt && beijingDateKey(new Date(record.createdAt)) === today);
  if (!checkedTasks.length && !externalToday.length) {
    return {
      hasCheckin: false,
      focus: buildTomorrowFocus(),
      message: "今天还没有完成系统练习；完成后会根据真实答题结果生成明日重点。"
    };
  }
  if (!checkedTasks.length && externalToday.length) {
    const duration = externalToday.reduce((sum, record) => sum + Math.max(0, Number(record.actualSeconds || 0)), 0);
    return {
      hasCheckin: true,
      focus: buildTomorrowFocus(),
      message: `已记录 ${externalToday.length} 条站外学习${duration ? `，共 ${formatActualStudyTime(duration)}` : ""}。`
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
  const headerButton = $("#openReminder");
  $("#dailyReminderEnabled").checked = settings.enabled;
  $("#dailyReminderTime").value = settings.time;
  $("#reminderHeaderState").textContent = settings.enabled ? settings.time : "未开启";
  headerButton?.classList.toggle("is-active", settings.enabled);
  headerButton?.setAttribute("aria-label", settings.enabled ? `学习提醒已开启，每日 ${settings.time}` : "打开学习提醒");
  $("#dailyReminderTitle").textContent = settings.enabled ? `每日 ${settings.time} 自动整理` : "明日重点提醒";
  $("#dailyReminderText").textContent = settings.enabled
    ? (summary.hasCheckin ? `今晚 ${settings.time}，系统会自动整理明日重点并提醒你查看。` : summary.message)
    : "开启后，系统会根据当天真实学习记录自动整理明日重点。";
  if ("Notification" in window) {
    $("#dailyReminderNotify").textContent = Notification.permission === "granted" ? "浏览器通知已允许" : "允许浏览器通知";
    $("#dailyReminderNotify").disabled = Notification.permission === "denied";
  } else {
    $("#dailyReminderNotify").textContent = "不支持通知";
    $("#dailyReminderNotify").disabled = true;
  }
}

function sendDailyNotification(message) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("明日重点已整理", { body: message });
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
  "checkin-7": { badge: "7", visual: "companion-day7", companionDay: 7, title: "本周应援卡", text: "连续 7 天的学习记录已经留下。", note: "抽一张属于这一周的应援卡。" },
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

function dateKeyToUtcDay(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const utcDay = Date.UTC(year, month - 1, day) / 86400000;
  const parsed = new Date(utcDay * 86400000);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return utcDay;
}

function consecutiveCheckinStreak(dateKeys, endingDateKey) {
  const endingDay = dateKeyToUtcDay(endingDateKey);
  if (endingDay === null) return 0;
  const recordedDays = new Set((Array.isArray(dateKeys) ? dateKeys : []).map(dateKeyToUtcDay).filter(day => day !== null));
  let streak = 0;
  for (let cursor = endingDay; recordedDays.has(cursor); cursor -= 1) streak += 1;
  return streak;
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
  const streak = consecutiveCheckinStreak(state.checkinDates, dateKey);
  unlockRewards([
    "first-checkin",
    ...(streak >= 7 ? ["checkin-7"] : []),
    ...(streak >= 14 ? ["checkin-14"] : []),
    ...(streak >= 30 ? ["checkin-30"] : [])
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

function saveExternalStudyRecord() {
  const noteInput = $("#externalStudyNote");
  const note = normalizeExternalStudyNote(noteInput?.value || "");
  if (!note) return showToast("用一句话写下刚才学了什么");
  if (noteInput) noteInput.value = note;
  const activities = externalStudyActivitiesFromText(note);
  const actualSeconds = activities.reduce((sum, activity) => sum + activity.actualSeconds, 0);
  const category = externalStudyRecordCategory(activities);
  const previousDecision = currentTaskDecision();
  const record = {
    id: `external-${Date.now()}`,
    note: note.slice(0, 160),
    category,
    actualSeconds,
    activities,
    createdAt: new Date().toISOString()
  };
  const previousRecords = readExternalStudyRecords();
  writeExternalStudyRecords([record, ...previousRecords]);
  const nextDecision = currentTaskDecision();
  if (!actualSeconds) {
    record.planningImpact = "已保存内容；未识别到用时，因此暂不调整当前任务。";
  } else if (category === "other") {
    record.planningImpact = "已计入实际用时；未识别到学习模块，当前任务顺序不变。";
  } else if (previousDecision.task?.id && nextDecision.task?.id !== previousDecision.task.id) {
    record.planningImpact = `当前推荐已调整为「${taskDisplayTitle(nextDecision.task, tasks.indexOf(nextDecision.task))}」；原周计划和完成状态不变。`;
  } else {
    const currentTitle = nextDecision.task
      ? `「${taskDisplayTitle(nextDecision.task, tasks.indexOf(nextDecision.task))}」`
      : "原周计划";
    record.planningImpact = `当前推荐仍是${currentTitle}；补录已计入实际用时，但不会冒充计划完成。`;
  }
  writeExternalStudyRecords([record, ...previousRecords]);
  $("#externalStudyNote").value = "";
  updateProgress();
  renderCurrentTask();
  renderReminderUI();
  scheduleCloudSave();
  closeModal("externalRecordModal");
  if (!actualSeconds) {
    showToast("没有识别到用时，请写“30分钟”或“半小时”");
  } else if (category === "other") {
    showToast(`已记录 ${formatActualStudyTime(actualSeconds)}；未识别学习模块`);
  } else {
    showToast(`已记录：${externalStudyActivitySummary(activities, actualSeconds)}；当前任务已重新判断`);
  }
}

function correctExternalStudyNote() {
  const note = $("#externalStudyNote");
  if (!note) return false;
  const corrected = normalizeExternalStudyNote(note.value);
  if (!corrected || corrected === note.value.trim()) return false;
  note.value = corrected;
  return true;
}

function setExternalVoiceState(active, status = "") {
  const button = $("#startExternalVoiceInput");
  const statusText = $("#externalVoiceStatus");
  button?.classList.toggle("is-listening", active);
  button?.setAttribute("aria-pressed", String(active));
  button?.setAttribute("aria-label", active ? "停止语音输入" : "开始语音输入");
  button?.setAttribute("title", active ? "停止语音输入" : "开始语音输入");
  if (statusText) statusText.textContent = status || (active ? "正在听，说完再点一次停止。" : "点输入框右侧的麦克风开始，说完再点一次结束。");
}

function startExternalVoiceInput() {
  const note = $("#externalStudyNote");
  if (externalVoiceRecognition) {
    externalVoiceRecognition.stop();
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    note?.focus();
    setExternalVoiceState(false, "当前浏览器不支持网页语音，请用系统键盘麦克风。");
    showToast("请点键盘上的麦克风说话，文字会自动填入这里");
    return;
  }
  const recognition = new SpeechRecognition();
  externalVoiceRecognition = recognition;
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true;
  externalVoiceBaseText = note?.value || "";
  let voiceErrorMessage = "";
  setExternalVoiceState(true);
  recognition.onresult = event => {
    const text = Array.from(event.results).map(result => result[0]?.transcript || "").join("");
    if (note) note.value = `${externalVoiceBaseText}${externalVoiceBaseText && text ? " " : ""}${text}`.slice(0, 160);
  };
  recognition.onend = () => {
    externalVoiceRecognition = null;
    const corrected = correctExternalStudyNote();
    setExternalVoiceState(false, voiceErrorMessage || (corrected ? "已自动修正明显错别字，可修改后确定。" : "语音已转成文字，可修改后确定。"));
  };
  recognition.onerror = () => {
    externalVoiceRecognition = null;
    voiceErrorMessage = "未能启动语音，请用系统键盘麦克风。";
    setExternalVoiceState(false, voiceErrorMessage);
    note?.focus();
    showToast("语音输入未启动，请使用键盘上的麦克风");
  };
  try {
    recognition.start();
  } catch {
    externalVoiceRecognition = null;
    note?.focus();
    setExternalVoiceState(false, "未能启动语音，请用系统键盘麦克风。");
  }
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
  practiceSessionStartedAt = "";
  stopListeningAudio();
  const context = getPracticeContext(errorId, linkedTaskId);
  const originalErrorPractice = !linkedTaskId && context.error && !Number(context.error.reinforcementCount || 0)
    ? normalizePracticeQuestions([errorQuestionSnapshot(context.error)], 1)
    : [];
  let pendingPractice = null;
  if (linkedTaskId) {
    const task = tasks.find(item => item.id === linkedTaskId);
    if (task && !hasPracticeRecord(task)) {
      pendingPractice = task.checkin?.pendingPractice || null;
      practiceSessionStartedAt = new Date().toISOString();
      task.status = "in_progress";
      task.checkin = {
        ...(task.checkin || {}),
        startedAt: task.checkin?.startedAt || practiceSessionStartedAt,
        lastStartedAt: practiceSessionStartedAt
      };
      persistTasksAndRefresh();
    }
  }
  const questionCount = pendingPractice?.questions?.length
    || originalErrorPractice.length
    || (linkedTaskId ? readPracticeQuestionCount() : (Number(context.error?.reinforcementCount) || 5));
  activePractice = Array.isArray(pendingPractice?.questions) && pendingPractice.questions.length
    ? pendingPractice.questions
    : (originalErrorPractice.length ? originalErrorPractice : localFallbackForContext(errorId, context));
  questionIndex = Math.max(0, Math.min(activePractice.length - 1, Number(pendingPractice?.questionIndex) || 0));
  selectedAnswer = pendingPractice?.selectedAnswer ?? null;
  questionGraded = Boolean(pendingPractice?.questionGraded);
  practiceResults = Array.isArray(pendingPractice?.results) ? pendingPractice.results : [];
  practiceCorrect = currentPracticeScore();
  $("#practiceEyebrow").textContent = originalErrorPractice.length
    ? "错题原题复习 · 1题"
    : (errorId === "imported-1" ? "导入错题诊断 · 5题" : `${context.examLabel} · 系统出题 · ${questionCount}题`);
  $("#practiceTitle").textContent = "正在准备练习题";
  $("#questionProgress").textContent = "已等待 0 秒";
  $("#questionArea").innerHTML = `<div class="practice-loading-state" role="status" aria-live="polite">
    <span class="loading-spinner" aria-hidden="true"></span>
    <div>
      <p class="section-kicker" id="practiceLoadingStage">正在连接在线题库</p>
      <h3>正在按你的考试目标准备 ${questionCount} 道题</h3>
      <p>在线题最多等待 12 秒；未及时完成会立即使用已验证题库。</p>
    </div>
  </div>`;
  if (!questionGraded) $("#practiceFeedback").className = "practice-feedback hidden";
  $("#prevQuestion").disabled = true;
  $("#nextQuestion").disabled = true;
  $("#prevQuestion").style.display = "none";
  $("#nextQuestion").style.display = "none";
  openModal("practiceModal");
  if (pendingPractice?.questions?.length) {
    resetPracticeControls();
    $("#practiceTitle").textContent = context.title;
    $("#nextQuestion").disabled = false;
    if (!questionGraded) startPracticeQuestionTimer();
    renderQuestion();
    $("#nextQuestion").textContent = questionGraded ? (questionIndex === activePractice.length - 1 ? "查看本组结果" : "下一题") : "提交答案";
    showToast("已恢复到上次未完成的题目");
    return;
  }
  if (originalErrorPractice.length) {
    resetPracticeControls();
    $("#practiceEyebrow").textContent = "错题原题复习 · 1题";
    $("#practiceTitle").textContent = context.title;
    $("#nextQuestion").disabled = false;
    startPracticeQuestionTimer();
    renderQuestion();
    return;
  }
  const loadingStartedAt = Date.now();
  const loadingTimer = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - loadingStartedAt) / 1000);
    if ($("#questionProgress")) $("#questionProgress").textContent = `已等待 ${elapsedSeconds} 秒`;
    if ($("#practiceLoadingStage")) {
      $("#practiceLoadingStage").textContent = elapsedSeconds < 5
        ? "正在连接在线题库"
        : elapsedSeconds < 12
          ? "在线生成题目中"
          : "正在切换到系统题库";
    }
  }, 1000);
  try {
    const practiceLoad = await loadExamDrivenPractice(errorId, linkedTaskId, questionCount);
    const generated = practiceLoad.questions;
    const usableGenerated = isListeningPracticeContext(context)
      ? generated.filter(isPlayableListeningPracticeQuestion)
      : generated;
    if (usableGenerated.length) activePractice = usableGenerated;
    else if (linkedTaskId) {
      showToast(
        isListeningPracticeContext(context)
          ? "听力题缺少可播放内容，已使用本地听力练习"
          : "暂未生成新题，已使用本地兜底练习",
      );
    }
    if (practiceLoad.fallbackUsed) {
      const availableCount = usableGenerated.length || activePractice.length;
      const reason = practiceLoad.providerIssue === "provider_timeout"
        ? "在线出题超时"
        : /^(?:openai|qwen)_http_(401|403)$/.test(practiceLoad.providerIssue)
          ? "在线出题服务权限异常"
          : "在线出题暂不可用";
      showToast(availableCount < questionCount
        ? `${reason}，系统题库先提供 ${availableCount} 题`
        : `${reason}，已切换到系统题库`);
    }
  } catch (error) {
    if (linkedTaskId) showToast(error?.name === "AbortError" ? "在线生成超时，已切换到系统题库" : "在线服务暂不可用，已切换到系统题库");
  } finally {
    clearInterval(loadingTimer);
  }
  if (isListeningPracticeContext(context)) {
    const playablePractice = activePractice.filter(isPlayableListeningPracticeQuestion);
    activePractice = playablePractice.length ? playablePractice : listeningFallbackForContext(context);
  }
  activePractice = activePractice.slice(0, questionCount);
  if (linkedTaskId && activePractice.length) {
    const task = tasks.find(item => item.id === linkedTaskId);
    if (task && !hasPracticeRecord(task)) {
      task.checkin = {
        ...(task.checkin || {}),
        practiceQuestionCount: activePractice.length
      };
      persistTasksAndRefresh();
    }
  }
  questionIndex = 0;
  selectedAnswer = null;
  questionGraded = false;
  practiceCorrect = 0;
  practiceWrongNotes = [];
  practiceResults = [];
  resetPracticeControls();
  $("#practiceEyebrow").textContent = errorId === "imported-1"
    ? `导入错题诊断 · ${activePractice.length}题`
    : `${context.examLabel} · 系统出题 · ${activePractice.length}题`;
  $("#practiceTitle").textContent = context.title;
  $("#nextQuestion").disabled = false;
  startPracticeQuestionTimer();
  renderQuestion();
}

function renderQuestion() {
  const question = activePractice[questionIndex];
  const learningMode = practiceReviewMode === "learning";
  const listening = isListeningQuestion(question);
  const transcript = listeningTextFor(question);
  const hasOriginalAudio = Boolean(listeningAudioFor(question));
  const hasPlayableAudio = Boolean(hasOriginalAudio || transcript);
  const playbackKey = `${questionIndex}`;
  const playCount = listeningPlayCounts[playbackKey] || 0;
  const remainingPlays = Math.max(0, LISTENING_PLAY_LIMIT - playCount);
  const playbackState = listeningPlaybackState.key === playbackKey ? listeningPlaybackState : { status: "idle", message: "" };
  const playbackBusy = playbackState.status === "generating" || playbackState.status === "playing";
  const playbackFailed = playbackState.status === "error";
  const audioStatus = playbackState.message || (hasPlayableAudio ? (hasOriginalAudio ? (questionGraded ? (learningMode ? "复盘阶段可反复听" : "本题已记录，整组完成后复盘") : `答题阶段剩余 ${remainingPlays} 次`) : `暂无原始音频，AI 朗读剩余 ${remainingPlays} 次`) : "暂无可播放内容，按文本题完成");
  const playButtonLabel = playbackState.status === "generating" ? "生成中…" : playbackState.status === "playing" ? "播放中…" : playbackFailed ? "重试播放" : (hasOriginalAudio ? "播放音频" : "AI 朗读");
  const listeningPlayerClass = ["listening-player", hasOriginalAudio ? "" : "is-muted", playbackBusy ? "is-active" : "", playbackFailed ? "is-error" : ""].filter(Boolean).join(" " );
  const listeningButtonClass = ["secondary-button compact", playbackFailed ? "is-error" : ""].filter(Boolean).join(" " );
  const materialLabel = question.skillLabel || question.materialSetTitle || question.sourceTitle || "";
  const questionContent = question.passage
    ? `<div class="question-instruction"><span>题目要求</span><p lang="ko">${escapeImportText(question.instruction || question.stem)}</p></div>
      <article class="question-passage"><span>阅读原文</span><p lang="ko">${escapeImportText(question.passage)}</p></article>`
    : `<p class="question-stem">${escapeImportText(question.stem)}</p>`;
  $("#questionProgress").textContent = `${questionIndex + 1} / ${activePractice.length}`;
  $("#questionArea").innerHTML = `${listening ? `<div class="${listeningPlayerClass}">
    <div><span>${hasOriginalAudio ? "听力音频" : "AI 朗读"}</span><strong>${audioStatus}</strong></div>
    <button class="${listeningButtonClass}" id="playListening" type="button" ${playbackBusy || (!learningMode && questionGraded) || (!questionGraded && remainingPlays <= 0) || !hasPlayableAudio ? "disabled" : ""}>${playButtonLabel}</button>
  </div>` : ""}
  ${materialLabel ? `<div class="material-source-pill">资料题 · ${escapeImportText(materialLabel)}</div>` : ""}
  ${question.materialImage ? `<button class="question-material-image" type="button" id="openMaterialImage" aria-label="查看原始资料图"><img src="${escapeImportText(question.materialImage)}" alt="原始资料页" loading="lazy" /></button>` : ""}
  ${questionContent}<div class="answer-options">
    ${question.options.map((option, index) => `<label class="answer-option ${selectedAnswer === index ? "selected" : ""}">
      <input type="radio" name="answer" value="${index}" />
      <span class="answer-letter">${answerLetter(index)}</span><span>${escapeImportText(option)}</span>
    </label>`).join("")}
  </div>`;
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
      elapsedSeconds: practiceQuestionElapsedSeconds(),
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
    startPracticeQuestionTimer();
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
      const completedAt = new Date().toISOString();
      const actualSeconds = taskActualStudySeconds(task) + practiceSessionSeconds();
      const wrongNoteParts = uniqueTextParts(practiceWrongNotes.map(item => item.listeningMistake || item.explanationZh || item.explanation)).slice(0, 2);
      const autoNote = wrongCount
        ? `AI自动记录：错${wrongCount}题${wrongNoteParts.length ? `；${wrongNoteParts.join("；")}` : ""}`
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
        startedAt: task.checkin?.startedAt || practiceSessionStartedAt || completedAt,
        completedAt,
        updatedAt: completedAt,
        actualSeconds,
        errorIds: createdErrors.map(item => item.id)
      };
      applyPracticeResultToPlan(task, { correct: practiceCorrect, total });
      persistTasksAndRefresh();
      recordCheckinReward(task);
      renderErrors();
    }
  }
  const error = practiceIsSample ? null : errorItems.find(item => item.id === practiceErrorId);
  if (error) {
    applyErrorReviewResult(error, {
      correct: practiceCorrect,
      total,
      rate,
      completedAt: new Date().toISOString()
    });
    persistErrorItems();
    if (rate >= 80) recordSolvedErrorReward(rate);
    renderErrors();
    scheduleCloudSave();
  }
  practiceSessionStartedAt = "";
  closeModal("practiceModal");
  showToast(practiceIsSample ? "示例练习已完成，不会写入你的错题集" : (practiceTaskId ? (resultReflection ? "学习结果和反思已保存" : "学习行为已自动记录") : "练习结果已更新到错题集"));
  practiceTaskId = null;
  practiceErrorId = null;
  practiceIsSample = false;
  resetPracticeControls();
}

function resetPracticeControls() {
  $("#prevQuestion").style.display = "";
  $("#nextQuestion").style.display = "";
  $("#prevQuestion").disabled = false;
  $("#nextQuestion").onclick = advanceQuestion;
}

function openModal(id) { $("#" + id).classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(id) {
  if (id === "practiceModal") {
    pausePracticeQuestionTimer();
    if (practiceTaskId && practiceSessionStartedAt) {
      const task = tasks.find(item => item.id === practiceTaskId);
      if (task && !hasPracticeRecord(task)) {
        const partialAnswered = practiceResults.filter(Boolean).length;
        const partialCorrect = practiceResults.filter(item => item?.correct).length;
        const pausedAt = new Date().toISOString();
        const planningImpact = recordPartialPlanImpact(task, partialAnswered, activePractice.length);
        task.status = partialAnswered ? "partial" : "planned";
        task.checkin = {
          ...(task.checkin || {}),
          startedAt: task.checkin?.startedAt || practiceSessionStartedAt,
          lastPausedAt: pausedAt,
          partialAnswered,
          partialCorrect,
          pendingPractice: partialAnswered ? {
            questions: activePractice,
            results: practiceResults,
            questionIndex,
            selectedAnswer,
            questionGraded
          } : null,
          actualSeconds: taskActualStudySeconds(task) + practiceSessionSeconds(),
          planningImpact
        };
        persistTasksAndRefresh();
      }
      practiceSessionStartedAt = "";
    }
    stopListeningAudio();
  }
  if (id === "externalRecordModal" && externalVoiceRecognition) {
    externalVoiceRecognition.stop();
    externalVoiceRecognition = null;
    setExternalVoiceState(false);
  }
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
let settingsWizardStep = 0;

const settingsStepCopy = [
  "先确认学习目标，已有选项可以直接继续。",
  "选择真实可学习的日期和时间，系统只在这些时段排课。",
  "资料是可选项，没有教材或链接也可以直接生成计划。"
];

function renderSettingsWizard(step = settingsWizardStep) {
  settingsWizardStep = Math.max(0, Math.min(2, Number(step) || 0));
  $$("[data-settings-step]").forEach(section => {
    const active = Number(section.dataset.settingsStep) === settingsWizardStep;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  $$("[data-settings-step-tab]").forEach(tab => {
    const tabStep = Number(tab.dataset.settingsStepTab);
    const active = tabStep === settingsWizardStep;
    tab.classList.toggle("active", active);
    tab.classList.toggle("completed", tabStep < settingsWizardStep);
    if (active) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
  $("#settingsStepIntro").textContent = settingsStepCopy[settingsWizardStep];
  $("#settingsStepNote").textContent = `第 ${settingsWizardStep + 1} 步，共 3 步`;
  $("#settingsBack").classList.toggle("hidden", settingsWizardStep === 0);
  $("#settingsNext").classList.toggle("hidden", settingsWizardStep === 2);
  $("#settingsSubmit").classList.toggle("hidden", settingsWizardStep !== 2);
  const panel = $("#settingsModal .settings-panel");
  if (panel) panel.scrollTop = 0;
}

function openSettingsWizard(step = 0) {
  resetPlanGenerationStatus();
  renderSettingsWizard(step);
  openModal("settingsModal");
}

const planGenerationCopy = [
  ["正在整理学习设置", "确认目标、学习时间和资料范围。"],
  ["正在生成课程安排", "只使用你选择的模块和可学习时间。"],
  ["正在保留真实学习记录", "完成、部分完成、取消和调整记录不会被覆盖。"],
  ["周计划已经生成", "正在返回周计划并定位课程表。"]
];

function setPlanGenerationState(step = 0, detail = "") {
  const safeStep = Math.max(0, Math.min(3, Number(step) || 0));
  const status = $("#planGenerationStatus");
  if (!status) return;
  status.classList.remove("hidden");
  status.classList.remove("is-error");
  status.classList.toggle("is-complete", safeStep === 3);
  $("#planGenerationTitle").textContent = planGenerationCopy[safeStep][0];
  $("#planGenerationDetail").textContent = detail || planGenerationCopy[safeStep][1];
  $("#planGenerationBar").style.width = `${[12, 46, 76, 100][safeStep]}%`;
  $$("[data-plan-generation-step]").forEach(item => {
    const itemStep = Number(item.dataset.planGenerationStep);
    item.classList.toggle("active", itemStep === safeStep);
    item.classList.toggle("completed", itemStep < safeStep);
  });
}

function setPlanGenerationError(message = "生成没有完成，请稍后重试。已有学习记录不会被修改。") {
  const status = $("#planGenerationStatus");
  if (!status) return;
  status.classList.remove("hidden", "is-complete");
  status.classList.add("is-error");
  $("#planGenerationTitle").textContent = "周计划生成失败";
  $("#planGenerationDetail").textContent = message;
}

function resetPlanGenerationStatus() {
  const status = $("#planGenerationStatus");
  if (!status) return;
  status.classList.add("hidden");
  status.classList.remove("is-complete", "is-error");
  $("#planGenerationBar").style.width = "0%";
}

function validateSettingsStep(step = settingsWizardStep) {
  const exam = $('input[name="exam"]:checked')?.value || "TOPIK";
  if (step === 0) {
    if (exam === "OTHER" && !$("#customExamName").value.trim()) {
      showToast("请填写考试或学习项目名称");
      $("#customExamName").focus();
      return false;
    }
    const firstRoundWeeks = Number($("#firstRoundWeeks").value);
    if (!firstRoundWeeks) {
      showToast("请填写第一轮计划用时");
      $("#firstRoundWeeks").focus();
      return false;
    }
  }
  if (step === 1) {
    const studyDays = $$('input[name="studyDay"]:checked');
    const availableStart = $("#availableStart").value;
    const availableEnd = $("#availableEnd").value;
    const intensity = $('input[name="intensity"]:checked')?.value || "中等";
    const minHours = Number($("#durationMin").value);
    const maxHours = Number($("#durationMax").value);
    if (!studyDays.length) {
      showToast("请至少选择一个学习日");
      return false;
    }
    if (!availableStart || !availableEnd || availableStart >= availableEnd) {
      showToast("请填写有效的学习时间范围");
      $("#availableStart").focus();
      return false;
    }
    if (intensity === "自定义" && (!minHours || !maxHours || minHours > maxHours)) {
      showToast(!minHours || !maxHours ? "请填写完整的自定义时长" : "每天最少时长不能大于最多时长");
      $("#durationMin").focus();
      return false;
    }
  }
  return true;
}

function settingsFromForm() {
  const exam = $('input[name="exam"]:checked')?.value || "TOPIK";
  const level = $('input[name="level"]:checked')?.value || "I";
  const targetGrade = exam === "TOPIK" ? ($('input[name="targetGrade"]:checked')?.value || (level === "II" ? "4" : "2")) : "";
  const foundation = $('input[name="foundation"]:checked')?.value || "不确定";
  const weak = $$('input[name="weak"]:checked').map(input => input.value);
  const times = $$('input[name="time"]:checked').map(input => input.value);
  const intensity = $('input[name="intensity"]:checked')?.value || "中等";
  const minHours = Number($("#durationMin").value);
  const maxHours = Number($("#durationMax").value);
  const materialFiles = learningMaterialFiles.map(file => ({
    name: file.name,
    type: file.type || "未知类型",
    size: file.size,
    sizeLabel: file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
  }));
  return {
    exam,
    level,
    targetGrade,
    foundation,
    weak,
    times,
    intensity,
    minHours,
    maxHours,
    intensityLabel: intensity === "自定义" ? `${minHours}-${maxHours}小时/天` : (intensity === "高强度" ? "高强度" : `${intensity}强度`),
    customExamName: exam === "OTHER" ? $("#customExamName").value.trim() : "",
    customExamGoal: exam === "OTHER" ? $("#customExamGoal").value.trim() : "",
    studyContent: $("#studyContent").value.trim(),
    examDate: $("#examDate").value,
    firstRoundWeeks: Number($("#firstRoundWeeks").value),
    studyDays: $$('input[name="studyDay"]:checked').map(input => input.value),
    availableStart: $("#availableStart").value,
    availableEnd: $("#availableEnd").value,
    resourceLinks: $("#resourceLinks").value.split(/\n+/).map(link => link.trim()).filter(Boolean),
    materialFiles,
    autoResearch: $("#autoResearch").checked
  };
}

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
  const selectedTokens = scopedStudyTokens(settings).map(normalizeStudyCategory);
  const hasReviewNeed = hasActualReviewNeed();
  const allowed = [...new Set([
    ...selectedTokens,
    ...(hasReviewNeed ? ["consolidation", "review"] : [])
  ])];
  const allowedCategories = new Set(allowed);
  return (aiTasks || []).filter(task => {
    const category = normalizeStudyCategory(task.category);
    const validClock = /^\d{2}:\d{2}$/.test(task.start || "") && /^\d{2}:\d{2}$/.test(task.end || "");
    if (!validClock) return false;
    if (category === "review" && !hasReviewNeed) return false;
    if (taskMentionsUnselectedScope(task, selectedTokens)) return false;
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
      weekIndex: 0,
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

function alignAiContentToLocalSchedule(aiTasks = [], localPlan = []) {
  const available = aiTasks.map((task, index) => ({ task, index, used: false }));
  return localPlan.filter(task => taskWeekIndex(task) === 0).map(slot => {
    const match = available.find(item => !item.used && item.task.category === slot.category);
    if (!match) return slot;
    match.used = true;
    return {
      ...slot,
      title: match.task.title || slot.title,
      note: match.task.note || slot.note,
      standards: match.task.standards?.length ? match.task.standards : slot.standards
    };
  });
}

function taskHasLearningTrace(task = {}) {
  return hasPracticeRecord(task)
    || taskActualStudySeconds(task) > 0
    || ["partial", "in_progress", "cancelled"].includes(task.status)
    || Boolean(task.checkin?.startedAt || task.checkin?.completedAt || task.checkin?.updatedAt || task.checkin?.note || task.checkin?.reflection)
    || Boolean((task.adjustments || []).length);
}

function tasksOverlap(first = {}, second = {}) {
  if (taskWeekIndex(first) !== taskWeekIndex(second) || first.day !== second.day) return false;
  const firstStart = clockToMinutes(first.start || "00:00");
  const firstEnd = clockToMinutes(first.end || "00:00");
  const secondStart = clockToMinutes(second.start || "00:00");
  const secondEnd = clockToMinutes(second.end || "00:00");
  return firstStart < secondEnd && secondStart < firstEnd;
}

function mergeGeneratedPlanWithLearningRecords(generatedTasks = [], existingTasks = tasks) {
  const preserved = existingTasks.filter(taskHasLearningTrace).map(task => ({ ...task, weekIndex: taskWeekIndex(task) }));
  const preservedIds = new Set(preserved.map(task => String(task.id)));
  const available = generatedTasks.filter(task => !preserved.some(record => tasksOverlap(record, task)));
  const timestamp = Date.now();
  const normalized = available.map((task, index) => {
    const id = preservedIds.has(String(task.id)) ? `plan-${timestamp}-${index}` : task.id;
    preservedIds.add(String(id));
    return { ...task, weekIndex: taskWeekIndex(task), id };
  });
  return [...preserved, ...normalized];
}

async function commitPlanSettings(settings) {
  const button = $("#settingsSubmit");
  const originalButtonLabel = button.textContent;
  button.disabled = true;
  button.textContent = "生成中";
  $("#settingsBack").disabled = true;
  $$("[data-settings-step-tab]").forEach(tab => { tab.disabled = true; });
  setPlanGenerationState(0);
  let succeeded = false;
  try {
    const effectiveSettings = {
      ...settings,
      planStartDate: settings.planStartDate || initialPlanStartDate(settings)
    };
    const persistentSettings = { ...effectiveSettings, localFileCount: settings.materialFiles?.length || 0, materialFiles: [] };
    localStorage.setItem("topikPrototypeSettings", JSON.stringify(persistentSettings));
    applyExamBrand(settings.exam, settings.level, settings.targetGrade);
    let generatedPlan = [];
    try {
      setPlanGenerationState(1);
      const result = await callStudyAssistant("plan", {
        ...effectiveSettings,
        planningProfile: studyPerformanceProfile(),
        materialFiles: settings.materialFiles?.map(({ name, type, sizeLabel }) => ({ name, type, sizeLabel }))
      });
      const generatedTasks = normalizeAiTasks(result?.tasks, effectiveSettings);
      const localPlan = generatePlanFromSettings(effectiveSettings);
      generatedPlan = generatedTasks.length
        ? [...alignAiContentToLocalSchedule(generatedTasks, localPlan), ...localPlan.filter(task => taskWeekIndex(task) > 0)]
        : localPlan;
    } catch {
      setPlanGenerationState(1, "在线生成暂不可用，正在使用已确认的题型与时间生成计划。");
      generatedPlan = generatePlanFromSettings(effectiveSettings);
    }
    setPlanGenerationState(2);
    generatedPlan = constrainTasksToStudyScope(generatedPlan, effectiveSettings);
    tasks = mergeGeneratedPlanWithLearningRecords(generatedPlan);
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
    localStorage.setItem("topikPrototypePlanVersion", planSchemaVersion);
    writePlanScope(effectiveSettings);
    renderCalendar();
    updateTomorrowFocus();
    $("#profileIntensity").textContent = settings.intensityLabel;
    updateExamOptions(settings.exam, settings.level);
    localStorage.setItem("topikPrototypeOnboarded", "yes");
    scheduleCloudSave();
    setPlanGenerationState(3);
    await new Promise(resolve => window.setTimeout(resolve, 450));
    closeModal("resourceConfirmModal");
    closeModal("settingsModal");
    switchView("calendar", { scroll: false });
    window.setTimeout(() => $("#weekCalendar")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    succeeded = true;
    showToast("周计划已更新，已有学习记录已保留");
  } catch (error) {
    console.error("Plan generation failed", error);
    setPlanGenerationError();
    showToast("周计划没有生成，请稍后重试");
  } finally {
    button.disabled = false;
    button.textContent = originalButtonLabel;
    $("#settingsBack").disabled = false;
    $$("[data-settings-step-tab]").forEach(tab => { tab.disabled = false; });
    if (succeeded) resetPlanGenerationStatus();
  }
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
  $("#confirmStudySchedule").textContent = `${(settings.studyDays || []).map(day => dayNames[day]).join("、") || "每天"} · ${settings.availableStart}-${settings.availableEnd} · 第一轮 ${settings.firstRoundWeeks} 周${settings.examDate ? ` · 考试日 ${settings.examDate}` : ""}`;
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
  const imported = recognizedImportItems;
  if (!imported.length) return showToast("没有可导入的识别结果");
  let importedCount = 0;
  imported.forEach((item, index) => {
    if (!$(`[data-import-include="${index}"]`)?.checked) return;
    const question = $(`[data-import-field="question"][data-import-index="${index}"]`)?.value.trim() || "";
    const userAnswer = $(`[data-import-field="userAnswer"][data-import-index="${index}"]`)?.value.trim() || "";
    const correctAnswer = $(`[data-import-field="correctAnswer"][data-import-index="${index}"]`)?.value.trim() || "";
    if (!question) return;
    const reason = $(`[data-import-reason="${index}"]`)?.value || "待完成诊断后确认";
    const options = Array.isArray(item.options) ? item.options.slice(0, 6).map(String) : [];
    const selectedIndex = Number.isInteger(Number(item.selectedIndex)) ? Number(item.selectedIndex) : options.findIndex(option => option === userAnswer);
    const correctIndex = Number.isInteger(Number(item.correctIndex)) ? Number(item.correctIndex) : options.findIndex(option => option === correctAnswer);
    const category = ["listening", "reading", "writing", "vocab"].includes(item.category)
      ? item.category
      : (/听力/.test(item.section || "") ? "listening" : (/阅读/.test(item.section || "") ? "reading" : (/写作/.test(item.section || "") ? "writing" : "vocab")));
    errorItems.unshift({
      id: `imported-${Date.now()}-${index}`, filter: ["due"], section: item.section || "其他", category, title: item.title || question.slice(0, 60) || `导入错题 ${index + 1}`, source: "从历史错题照片导入 · AI识别后确认", due: true,
      focus: item.focus || "根据题干和正确答案确认考查重点。",
      cause: reason,
      reasoning: item.reasoning || item.explanation || "先回到当前题干，定位决定答案的具体信息。",
      habit: item.habit || "作答过程待进一步诊断。",
      action: item.action || `重做这道题时，先说明“${question.slice(0, 24)}”要求判断什么，再选择。`,
      question,
      userAnswer: userAnswer || "未确认",
      correctAnswer: correctAnswer || "待确认",
      selectedIndex,
      correctIndex,
      questionSnapshot: {
        stem: question,
        instruction: question,
        options,
        answer: correctIndex,
        explanation: item.explanation || item.reasoning || "",
        source: "用户历史错题照片"
      },
      progress: "待重做原题", reviews: ["current", "", "", ""], reviewStage: 0, reviewAttempts: [], reinforcementCount: 0
    });
    importedCount += 1;
  });
  if (!importedCount) return showToast("请至少保留一道有题目的错题");
  persistErrorItems();
  showingSampleErrors = false;
  scheduleCloudSave();
  renderErrors();
  $("#errorBadge").textContent = errorItems.filter(item => !item.mastered).length;
  closeModal("importModal");
  showToast(`已导入${importedCount}道原题，并加入复习队列`);
}

function switchView(view, { scroll = true } = {}) {
  const target = $("#" + view + "View");
  if (!target) return;
  const leavingDictationTask = view !== "dictation" && $("#dictationView")?.classList.contains("active") && dictationTaskSession();
  if (leavingDictationTask) pauseDictationTaskSession();
  $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach(section => section.classList.remove("active"));
  target.classList.add("active");
  if (view === "dictation") renderDictationView();
  if (view === "wordElimination") renderWordEliminationView();
  if (view === "progress") renderProgressView();
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
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
  window.addEventListener("pagehide", () => pauseDictationTaskSession({ refresh: false }));
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
  $("#startCurrentTask").addEventListener("click", startCurrentTask);
  $("#adjustCurrentTask").addEventListener("click", adjustCurrentTask);
  $("#skipCurrentTask").addEventListener("click", skipCurrentTask);
  $("#openExternalRecord").addEventListener("click", () => {
    setExternalVoiceState(false);
    openModal("externalRecordModal");
    window.setTimeout(() => $("#externalStudyNote")?.focus(), 80);
  });
  $("#saveExternalRecord").addEventListener("click", saveExternalStudyRecord);
  $("#startExternalVoiceInput").addEventListener("click", startExternalVoiceInput);
  $("#viewExternalStudyEffect").addEventListener("click", () => switchView("progress"));
  $("#externalStudyNote").addEventListener("blur", () => {
    if (correctExternalStudyNote()) setExternalVoiceState(false, "已自动修正明显错别字，可继续修改。");
  });
  $("#cancelTaskPlan").addEventListener("click", cancelActiveTaskPlan);
  $("#skipTaskPlan").addEventListener("click", rescheduleActiveTask);
  $("#editTaskPlan").addEventListener("click", () => toggleTaskEdit());
  $("#discardTaskEdit").addEventListener("click", () => toggleTaskEdit(false));
  $("#saveTaskEdit").addEventListener("click", saveTaskEdit);
  $("#openPractice").addEventListener("click", () => {
    const linkedTaskId = activeTaskId;
    const task = tasks.find(item => item.id === linkedTaskId);
    closeModal("taskModal");
    if (task?.category === "dictation") {
      return startDictationTask(task);
    }
    startPractice("e1", linkedTaskId);
  });
  $("#startDueReview").addEventListener("click", () => {
    const dueItem = errorItems.find(item => item.due && !item.mastered);
    if (!dueItem) return showToast("目前没有到期错题");
    startPractice(dueItem.id);
  });
  $("#nextQuestion").onclick = advanceQuestion;
  $("#prevQuestion").addEventListener("click", () => {
    if (questionIndex > 0) { questionIndex -= 1; selectedAnswer = null; questionGraded = false; renderQuestion(); }
  });
  $("#openSettings").addEventListener("click", () => {
    openSettingsWizard(0);
  });
  $("#openReminder").addEventListener("click", () => {
    renderReminderUI();
    openModal("reminderModal");
  });
  $("#openAccount").addEventListener("click", () => openModal("accountModal"));
  $("#signUpButton").addEventListener("click", () => authenticateCloud("signup"));
  $("#signedOutAccount").addEventListener("submit", event => {
    event.preventDefault();
    authenticateCloud("signin");
  });
  $("#skipLoginButton").addEventListener("click", () => {
    closeModal("accountModal");
    if (!localStorage.getItem("topikPrototypeOnboarded")) openSettingsWizard(0);
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
      return showImportResults({
        items: [{
          section: "词汇 / 语法",
          category: "vocab",
          title: "场所助词 에 / 에서",
          question: "저는 학교 (  ) 공부해요.",
          options: ["에", "에서", "부터", "에게"],
          userAnswer: "에",
          correctAnswer: "에서",
          selectedIndex: 0,
          correctIndex: 1,
          focus: "区分存在或到达的地点与动作发生地点",
          reasoning: "공부해요 是在某处进行的动作，所以学校后使用 에서。",
          action: "先圈出谓语，再判断地点是目的地还是动作发生地。",
          confidence: "high",
          needsConfirmation: false
        }],
        summary: "这是示例识别结果；真实照片会由在线视觉模型提取，并在导入前让你确认。"
      });
    }
    if (location.protocol === "file:") return showToast("真实识别请使用已发布的在线网址");
    const button = $("#analyzeImport");
    button.disabled = true;
    button.textContent = "正在识别…";
    try {
      const images = await Promise.all(importFiles.map(async item => ({ name: item.name, dataUrl: await compressImage(item.file) })));
      const result = await callStudyAssistant("vision", { images }, { timeoutMs: 25_000 });
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
  $("#backToSettings").addEventListener("click", () => { closeModal("resourceConfirmModal"); openSettingsWizard(2); });
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
    showToast(event.target.checked ? "已开启明日重点提醒" : "已关闭明日重点提醒");
  });
  $("#dailyReminderTime").addEventListener("change", event => {
    writeReminderSettings({ time: event.target.value || "21:30" });
    showToast(`明日重点提醒时间已改为 ${readReminderSettings().time}`);
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
  $("#settingsNext").addEventListener("click", () => {
    if (!validateSettingsStep(settingsWizardStep)) return;
    renderSettingsWizard(settingsWizardStep + 1);
  });
  $("#settingsBack").addEventListener("click", () => renderSettingsWizard(settingsWizardStep - 1));
  $$("[data-settings-step-tab]").forEach(tab => tab.addEventListener("click", () => {
    const targetStep = Number(tab.dataset.settingsStepTab);
    if (targetStep > settingsWizardStep && !validateSettingsStep(settingsWizardStep)) return;
    renderSettingsWizard(targetStep);
  }));
  $("#settingsForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateSettingsStep(0) || !validateSettingsStep(1)) return;
    commitPlanSettings(settingsFromForm());
  });
  $("#prevWeek")?.addEventListener("click", () => changeDisplayedWeek(-1));
  $("#nextWeek")?.addEventListener("click", () => changeDisplayedWeek(1));
}

repairUnverifiedTaskStatuses();
renderCalendar();
renderErrors();
initializeEvents();
setInterval(renderCurrentTask, 60000);
const previewRewardId = new URLSearchParams(location.search).get("previewReward");
const savedSettings = JSON.parse(localStorage.getItem("topikPrototypeSettings") || "null");
if (savedSettings) {
  if (!savedSettings.planStartDate) {
    savedSettings.planStartDate = initialPlanStartDate(savedSettings);
    localStorage.setItem("topikPrototypeSettings", JSON.stringify(savedSettings));
  }
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
  const startupSavedSettings = { ...readStudySettings(), ...savedSettings };
  if (localStorage.getItem("topikPrototypePlanVersion") !== planSchemaVersion || !savedPlanScopeMatches(startupSavedSettings)) {
    const regeneratedTasks = constrainTasksToStudyScope(generatePlanFromSettings(startupSavedSettings), startupSavedSettings);
    tasks = mergeGeneratedPlanWithLearningRecords(regeneratedTasks);
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(tasks));
    localStorage.setItem("topikPrototypePlanVersion", planSchemaVersion);
    writePlanScope(startupSavedSettings);
    renderCalendar();
  }
} else {
  updateExamOptions("TOPIK", "I");
}
const startupSettings = savedSettings ? { ...readStudySettings(), ...savedSettings } : readStudySettings();
displayedWeekIndex = planWeekIndexForDate(new Date(), startupSettings);
syncTasksToStudyScope(startupSettings);
renderCalendar();
updateTomorrowFocus();
initializeCloud().finally(() => {
  if (previewRewardId && rewardCatalog[previewRewardId]) return;
  if (localStorage.getItem("topikPrototypeOnboarded")) return;
  if (cloud.session?.access_token) openSettingsWizard(0);
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
