async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };
  const seedTask = async category => {
    await page.evaluate(categoryName => {
      const categoryLabel = categoryName === "listening" ? "听力" : "阅读";
      const settings = { examLevel: "TOPIK I", targetLevel: "2", weakAreas: [categoryLabel], intensity: "medium", firstRoundWeeks: 1, studyDays: ["sun"], availableStart: "11:00", availableEnd: "21:00", preferredSlots: ["afternoon"], planStartDate: "2026-07-13" };
      const seededTasks = [{ id: `audit-${categoryName}`, weekIndex: 0, day: "sun", start: "11:00", end: "11:30", category: categoryName, displayIndex: 0, title: categoryName === "listening" ? "听人物和地点" : "通知公告阅读", note: "测试真实学习闭环", status: "planned", standards: ["完成5题", "正确率达到80%", "标出答案依据"] }];
      localStorage.clear();
      localStorage.setItem("topikPrototypeOnboarded", "yes");
      localStorage.setItem("topikPrototypeSettings", JSON.stringify(settings));
      localStorage.setItem("topikPrototypeTasks", JSON.stringify(seededTasks));
      localStorage.setItem("topikPrototypePlanVersion", "24");
      localStorage.setItem("topikPrototypePlanScope", planScopeSignature(settings));
    }, category);
    await page.reload({ waitUntil: "domcontentloaded" });
  };

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  const fresh = await page.evaluate(() => ({ title: document.querySelector("#currentTaskTitle")?.textContent.trim(), tasks: JSON.parse(localStorage.getItem("topikPrototypeTasks") || "[]"), cards: document.querySelectorAll(".task-card").length }));
  check("fresh user has no fake plan", fresh.title?.includes("生成") && !fresh.tasks.length && !fresh.cards, JSON.stringify(fresh));

  await seedTask("reading");
  await page.evaluate(() => openTask("audit-reading"));
  await page.click("#openPractice");
  await page.waitForSelector("#practiceModal:not(.hidden) #questionArea .answer-option", { timeout: 15000 });
  const initial = await page.evaluate(() => ({ count: activePractice.length, feedbackHidden: document.querySelector("#practiceFeedback")?.classList.contains("hidden") }));
  check("practice starts with 5 questions and no leaked answer", initial.count === 5 && initial.feedbackHidden, JSON.stringify(initial));
  await page.locator(".answer-option").first().click();
  await page.click("#nextQuestion");
  await page.click('#practiceModal [data-close="practiceModal"]');
  const partial = await page.evaluate(() => JSON.parse(localStorage.getItem("topikPrototypeTasks"))[0]);
  check("partial practice persists", partial.status === "partial" && partial.checkin?.partialAnswered === 1 && partial.checkin?.pendingPractice?.questions?.length === 5, JSON.stringify(partial));
  await page.reload({ waitUntil: "domcontentloaded" });
  check("partial task remains current", (await page.textContent("#currentTaskTitle")).includes("通知公告阅读"), await page.textContent("#currentTaskTitle"));

  await seedTask("reading");
  await page.evaluate(() => openTask("audit-reading"));
  await page.click("#openPractice");
  await page.waitForSelector("#questionArea .answer-option", { timeout: 15000 });
  for (let index = 0; index < 5; index += 1) {
    const choice = await page.evaluate(() => questionIndex === 0 ? (activePractice[questionIndex].answer + 1) % activePractice[questionIndex].options.length : activePractice[questionIndex].answer);
    await page.locator(".answer-option").nth(choice).click();
    await page.click("#nextQuestion");
    await page.click("#nextQuestion");
  }
  await page.waitForSelector(".practice-result-board");
  await page.click("#nextQuestion");
  const completed = await page.evaluate(() => ({ task: JSON.parse(localStorage.getItem("topikPrototypeTasks"))[0], errors: JSON.parse(localStorage.getItem("topikPrototypePracticeErrors") || "[]") }));
  check("completed practice updates task", completed.task.status === "completed" && completed.task.checkin?.total === 5, JSON.stringify(completed.task));
  check("wrong answer creates current-question error", completed.errors.length > 0 && Boolean(completed.errors[0].questionSnapshot?.stem), JSON.stringify(completed.errors[0] || {}));
  check("error includes actionable improvement", Boolean(completed.errors[0].action), JSON.stringify(completed.errors[0] || {}));

  await page.evaluate(() => {
    const settings = { examLevel: "TOPIK II", targetLevel: "3", weakAreas: ["听力", "阅读"], intensity: "medium", firstRoundWeeks: 1, studyDays: ["sun"], availableStart: "11:00", availableEnd: "21:00", preferredSlots: ["afternoon"], planStartDate: "2026-07-13" };
    const seededTasks = [
      { id: "done-listening", weekIndex: 0, day: "sun", start: "11:00", end: "11:40", category: "listening", title: "已完成听力", note: "真实完成", status: "completed", standards: ["完成5题"], checkin: { correct: 4, total: 5, actualSeconds: 1200 } },
      { id: "reading", weekIndex: 0, day: "sun", start: "13:30", end: "14:10", category: "reading", title: "阅读任务", note: "阅读说明", status: "planned", standards: ["完成5题"] }
    ];
    localStorage.clear();
    localStorage.setItem("topikPrototypeOnboarded", "yes");
    localStorage.setItem("topikPrototypeSettings", JSON.stringify(settings));
    localStorage.setItem("topikPrototypeTasks", JSON.stringify(seededTasks));
    localStorage.setItem("topikPrototypePlanVersion", "24");
    localStorage.setItem("topikPrototypePlanScope", planScopeSignature(settings));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click('[data-calendar-filter="reading"]');
  const filtered = await page.locator(".task-card").allTextContents();
  check("category filter hides unrelated completed task", filtered.length === 1 && filtered[0].includes("阅读任务"), filtered.join(" | "));

  await page.evaluate(() => {
    localStorage.removeItem(dictationStorageKey);
    switchView("dictation");
  });
  const dictationInitial = await page.evaluate(() => ({
    progress: document.querySelector("#dictationView .score-pill strong")?.textContent.trim(),
    explanation: document.querySelector("#dictationView .dictation-hint-card")?.textContent,
    answerCard: Boolean(document.querySelector("#dictationView .dictation-answer-card")),
    handwritingLabel: document.querySelector("#openDictationHandwriting span")?.textContent.trim()
  }));
  check("dictation starts clean with explanation placeholder", dictationInitial.progress === "1 / 20" && dictationInitial.explanation?.includes("核对答案") && !dictationInitial.answerCard, JSON.stringify(dictationInitial));
  check("dictation handwriting entry is explicit", dictationInitial.handwritingLabel === "打开手写板", JSON.stringify(dictationInitial));
  await page.fill("#dictationInput", "가바");
  await page.click("#revealDictationAnswer");
  const dictationWrong = await page.evaluate(() => ({ state: readDictationState(), result: document.querySelector(".dictation-answer-card")?.textContent }));
  check("dictation wrong answer persists and explains", dictationWrong.state.weakIds?.length === 1 && dictationWrong.result?.includes("答案不正确") && dictationWrong.result?.includes("正确答案"), JSON.stringify(dictationWrong));
  await page.click("#nextDictationItem");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => switchView("dictation"));
  const restoredDictation = await page.evaluate(() => ({ state: readDictationState(), answerCard: Boolean(document.querySelector(".dictation-answer-card")), input: document.querySelector("#dictationInput")?.value }));
  check("next dictation item restores without stale answer", restoredDictation.state.index === 1 && !restoredDictation.answerCard && !restoredDictation.input, JSON.stringify(restoredDictation));

  const eliminationIds = await page.evaluate(() => {
    localStorage.removeItem(wordEliminationStorageKey);
    switchView("wordElimination");
    const items = dictationPracticeItems();
    return { first: items[0].id, second: items[1].id };
  });
  await page.click(`[data-elimination-type="word"][data-elimination-id="${eliminationIds.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${eliminationIds.second}"]`);
  await page.waitForTimeout(450);
  const afterWrongPair = await page.evaluate(() => readWordEliminationState());
  check("wrong word pair does not disappear", !(afterWrongPair.clearedIds || []).includes(eliminationIds.first), JSON.stringify(afterWrongPair));
  await page.click(`[data-elimination-type="word"][data-elimination-id="${eliminationIds.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${eliminationIds.first}"]`);
  await page.waitForTimeout(350);
  const afterCorrectPair = await page.evaluate(() => readWordEliminationState());
  check("correct word pair disappears and persists", (afterCorrectPair.clearedIds || []).includes(eliminationIds.first), JSON.stringify(afterCorrectPair));

  await page.evaluate(() => {
    const firstBatchIds = wordEliminationBatches()[0].map(item => item.id);
    writeWordEliminationState({ selectedWordId: "", selectedMeaningId: "", clearedIds: firstBatchIds, batchIndex: 0, mode: "batch", mistakeIds: [], reviewedWeakIds: [] });
    renderWordEliminationView();
  });
  const completedFirstBatch = await page.evaluate(() => ({
    title: document.querySelector(".elimination-empty strong")?.textContent.trim(),
    action: document.querySelector("#continueWordElimination")?.textContent.trim(),
    copy: document.querySelector(".elimination-empty p")?.textContent.trim()
  }));
  check("word elimination completion prioritizes real weak words", completedFirstBatch.title === "第 1 组已完成" && completedFirstBatch.action?.includes("不熟词") && completedFirstBatch.copy?.includes("听写不熟词"), JSON.stringify(completedFirstBatch));
  await page.click("#continueWordElimination");
  const weakReview = await page.evaluate(() => ({ state: readWordEliminationState(), labels: [...document.querySelectorAll(".elimination-tile strong")].map(node => node.textContent.trim()) }));
  check("word elimination weak review uses saved learning result", weakReview.state.mode === "review" && weakReview.labels.includes("가방"), JSON.stringify(weakReview));
  await page.evaluate(() => {
    const state = readWordEliminationState();
    writeWordEliminationState({ clearedIds: [...state.reviewIds] });
    renderWordEliminationView();
  });
  check("weak review continues to the new batch", (await page.textContent("#continueWordElimination")).trim() === "开始下一组", await page.textContent("#continueWordElimination"));
  await page.click("#continueWordElimination");
  const secondBatch = await page.evaluate(() => ({
    state: readWordEliminationState(),
    progress: document.querySelector("#wordEliminationView .score-pill strong")?.textContent.trim(),
    labels: [...document.querySelectorAll(".elimination-tile strong")].map(node => node.textContent.trim())
  }));
  check("next word elimination batch starts with new real vocabulary", secondBatch.state.batchIndex === 1 && secondBatch.progress === "0 / 20" && secondBatch.labels.includes("아르바이트") && secondBatch.state.completedBatchIds?.includes("batch-1"), JSON.stringify(secondBatch));

  await page.evaluate(() => {
    switchView("calendar");
    openModal("externalRecordModal");
  });
  await page.fill("#externalStudyNote", "背了半小时单词，做了20分钟听力");
  await page.click("#saveExternalRecord");
  const external = await page.evaluate(() => ({ records: readExternalStudyRecords(), effect: readExternalStudyRecords()[0]?.planningImpact || "" }));
  check("external record parses all activities", external.records[0]?.actualSeconds === 3000 && external.records[0]?.activities?.length === 2, JSON.stringify(external));
  check("external record has visible planning effect", external.effect?.includes("补录已计入实际用时") && (external.effect?.includes("不会冒充计划完成") || external.effect?.includes("原周计划和完成状态不变")), external.effect || "");

  const reminder = await page.evaluate(() => {
    writeReminderSettings({ enabled: true, time: "18:00", lastNotifiedDate: "" });
    return { saved: readReminderSettings(), header: document.querySelector("#reminderHeaderState")?.textContent.trim(), active: document.querySelector("#openReminder")?.classList.contains("is-active") };
  });
  check("daily reminder persists and updates header", reminder.saved.enabled && reminder.saved.time === "18:00" && reminder.header === "18:00" && reminder.active, JSON.stringify(reminder));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  check("mobile page has no horizontal overflow", mobile.scroll <= mobile.width + 1, JSON.stringify(mobile));
  return results;
}
