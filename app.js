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
    ["听人物和地点", "短对话里先抓谁、在哪里、正在做什么"], ["听力 · 判断下一步行动", "练“接下来做什么”和请求表达"], ["听原因和理由", "抓 못 가요、바뀌었어요 等理由线索"], ["听数字和时间", "练日期、价格、时间和数量"], ["听内容一致", "核对选项是否和原文相同"], ["听否定和时态", "听清 안、못、过去和将来"], ["看图听关键词", "先看图中差异，再听对应词"], ["听后复述", "复听、影子跟读、用中文说出大意"]
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

function readWordEliminationState() {
  const fallback = { selectedWordId: "", selectedMeaningId: "", clearedIds: [] };
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(wordEliminationStorageKey) || "null") || {}) };
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

function wordEliminationTiles(items = dictationPracticeItems()) {
  return items
    .flatMap(item => ([
      { key: `word-${item.id}`, id: item.id, type: "word", label: item.text, language: "韩文" },
      { key: `meaning-${item.id}`, id: item.id, type: "meaning", label: item.zh, language: "中文" }
    ]))
    .sort((a, b) => stableEliminationRank(`v2-${a.key}`) - stableEliminationRank(`v2-${b.key}`));
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
    cloud.config = {
      ...payload,
      url: normalizedUrl,
      enabled: Boolean(payload?.enabled && normalizedUrl)
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
    listening: ["听人物和地点", "听力 · 判断下一步行动", "听原因和理由", "听数字和时间", "听内容一致", "听否定和时态", "看图听关键词", "听后复述"],
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
  const items = dictationPracticeItems();
  const clearedIds = new Set(state.clearedIds || []);
  const remainingTiles = wordEliminationTiles(items).filter(item => !clearedIds.has(item.id));
  const selectedType = state.selectedWordId ? "韩文" : state.selectedMeaningId ? "中文" : "";
  view.innerHTML = `<div class="page-heading">
    <div>
      <p class="section-kicker">词义配对 · 消除练习</p>
      <h2>单词消除</h2>
      <p>韩文和中文混排。先点任意一张，再点对应翻译。</p>
    </div>
    <div class="score-pill">
      <small>进度</small><strong>${clearedIds.size} / ${items.length}</strong><span>${remainingTiles.length ? "继续配对" : "全部完成"}</span>
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
      <strong>这一轮词都消除了</strong>
      <p>可以重新开始，或者回到听写继续练不熟词。</p>
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
      writeWordEliminationState({ selectedWordId: "", selectedMeaningId: "" });
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
