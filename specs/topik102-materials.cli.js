async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };

  const seedTask = async task => {
    await page.evaluate(taskData => {
      const settings = {
        exam: "TOPIK",
        level: "II",
        targetGrade: "3",
        weak: [taskData.category === "listening" ? "听力" : "阅读"],
        intensity: "medium",
        firstRoundWeeks: 1,
        studyDays: ["sun"],
        availableStart: "11:00",
        availableEnd: "21:00",
        preferredSlots: ["afternoon"],
        planStartDate: "2026-07-13"
      };
      const seededTask = {
        id: `topik102-${taskData.category}`,
        weekIndex: 0,
        day: "sun",
        start: "13:30",
        end: "14:10",
        category: taskData.category,
        displayIndex: 0,
        title: taskData.title,
        note: "使用第102届TOPIK原题",
        status: "planned",
        standards: ["完成5题", "标出答案依据"]
      };
      localStorage.clear();
      localStorage.setItem("topikPrototypeOnboarded", "yes");
      localStorage.setItem("topikPrototypeSettings", JSON.stringify(settings));
      localStorage.setItem("topikPrototypeTasks", JSON.stringify([seededTask]));
      localStorage.setItem("topikPrototypePlanVersion", "24");
      localStorage.setItem("topikPrototypePlanScope", planScopeSignature(settings));
    }, task);
    await page.reload({ waitUntil: "domcontentloaded" });
  };

  const bankAudit = await page.evaluate(() => {
    const settings = { exam: "TOPIK", level: "II", targetGrade: "3", weak: ["听力", "阅读"] };
    const listening = realMaterialQuestionsForContext({ settings, category: "listening", title: "听力 · 判断下一步行动" }, 5);
    const reading = realMaterialQuestionsForContext({ settings, category: "reading", title: "通知公告阅读" }, 5);
    const contentMatch = realMaterialQuestionsForContext({ settings, category: "listening", title: "听内容一致" }, 8);
    const mainIdea = realMaterialQuestionsForContext({ settings, category: "listening", title: "听后复述" }, 5);
    const readingContent = realMaterialQuestionsForContext({ settings, category: "reading", title: "题干关键词定位" }, 5);
    const thirdBatch = realMaterialQuestionBank
      .flatMap(set => set.questions || [])
      .filter(item => /^topik-ii-listening-102-q02[1-4]$/.test(item.materialQuestionId || ""));
    return {
      listening: listening.map(item => ({ id: item.materialQuestionId, audio: item.audioSrc, image: item.materialImage })),
      reading: reading.map(item => ({ id: item.materialQuestionId, instruction: item.instruction, passage: item.passage, image: item.materialImage })),
      contentMatch: contentMatch.map(item => ({ id: item.materialQuestionId, audio: item.audioSrc, image: item.materialImage })),
      mainIdea: mainIdea.map(item => ({ id: item.materialQuestionId, audio: item.audioSrc, image: item.materialImage })),
      readingContent: readingContent.map(item => ({ id: item.materialQuestionId, instruction: item.instruction, passage: item.passage, image: item.materialImage })),
      thirdBatch: thirdBatch.map(item => ({ id: item.materialQuestionId, audio: item.audioSrc, image: item.materialImage }))
    };
  });
  check("listening routes to five verified TOPIK 102 questions", bankAudit.listening.length === 5 && bankAudit.listening.every(item => /^topik-ii-listening-102-q(?:00[4-9]|01[0-2]|023)$/.test(item.id)), JSON.stringify(bankAudit.listening));
  check("listening image and audio stay one-to-one", new Set(bankAudit.listening.map(item => item.audio)).size === 5 && new Set(bankAudit.listening.map(item => item.image)).size === 5 && bankAudit.listening.every(item => item.audio?.includes("topik102-listening/audio/") && item.image?.includes("topik102-listening/question/")), JSON.stringify(bankAudit.listening));
  check("reading routes to four verified TOPIK 102 questions", bankAudit.reading.length === 4 && bankAudit.reading.every(item => /^topik-ii-reading-102-q00[5-8]$/.test(item.id)), JSON.stringify(bankAudit.reading));
  check("reading instruction and passage remain separate", bankAudit.reading.every(item => item.instruction && item.passage && item.instruction !== item.passage && item.image?.includes("topik102-reading/question/")), JSON.stringify(bankAudit.reading));
  check("content-match routes to verified questions 13-16, 22 and 24", bankAudit.contentMatch.length === 6 && bankAudit.contentMatch.every(item => /^topik-ii-listening-102-q(?:01[3-6]|022|024)$/.test(item.id)), JSON.stringify(bankAudit.contentMatch));
  check("main-idea routes to verified questions 17-21", bankAudit.mainIdea.length === 5 && bankAudit.mainIdea.every(item => /^topik-ii-listening-102-q(?:01[7-9]|020|021)$/.test(item.id)), JSON.stringify(bankAudit.mainIdea));
  check("third listening batch is complete", bankAudit.thirdBatch.length === 4 && bankAudit.thirdBatch.every(item => item.audio?.includes("topik102-listening/audio/") && item.image?.includes("topik102-listening/question/")), JSON.stringify(bankAudit.thirdBatch));
  check("new listening images and audio stay one-to-one", new Set([...bankAudit.contentMatch, ...bankAudit.mainIdea, ...bankAudit.thirdBatch].map(item => item.audio)).size >= 11 && new Set([...bankAudit.contentMatch, ...bankAudit.mainIdea, ...bankAudit.thirdBatch].map(item => item.image)).size >= 11, JSON.stringify({ contentMatch: bankAudit.contentMatch, mainIdea: bankAudit.mainIdea, thirdBatch: bankAudit.thirdBatch }));
  check("reading content-check routes to verified questions 9-12", bankAudit.readingContent.length === 4 && bankAudit.readingContent.every(item => /^topik-ii-reading-102-q(?:009|010|011|012)$/.test(item.id)), JSON.stringify(bankAudit.readingContent));
  check("new reading instruction and passage remain separate", bankAudit.readingContent.every(item => item.instruction && item.passage && item.instruction !== item.passage && item.image?.includes("topik102-reading/question/")), JSON.stringify(bankAudit.readingContent));

  await seedTask({ category: "listening", title: "听力 · 判断下一步行动" });
  await page.evaluate(() => openTask("topik102-listening"));
  await page.click("#openPractice");
  await page.waitForSelector("#practiceModal:not(.hidden) #questionArea .answer-option", { timeout: 5000 });
  await page.locator("#openMaterialImage img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => (document.querySelector("#openMaterialImage img")?.naturalWidth || 0) > 0, { timeout: 5000 });
  const listeningUi = await page.evaluate(() => ({
    count: activePractice.length,
    source: activePractice[questionIndex]?.audioSrc,
    image: document.querySelector("#openMaterialImage img")?.getAttribute("src"),
    imageWidth: document.querySelector("#openMaterialImage img")?.naturalWidth || 0,
    playerText: document.querySelector(".listening-player")?.textContent || "",
    ttsLabel: document.querySelector("#playListening")?.textContent || ""
  }));
  check("listening modal opens verified material without online wait", listeningUi.count === 5 && listeningUi.source?.includes("topik102-listening/audio/"), JSON.stringify(listeningUi));
  check("listening uses original audio path instead of TTS", listeningUi.playerText.includes("听力音频") && listeningUi.ttsLabel.includes("播放音频") && !listeningUi.ttsLabel.includes("AI"), JSON.stringify(listeningUi));
  check("listening original question image loads", listeningUi.image?.includes("topik102-listening/question/") && listeningUi.imageWidth > 0, JSON.stringify(listeningUi));
  await page.click("#playListening");
  await page.waitForTimeout(300);
  const playback = await page.evaluate(() => ({ src: activeTtsAudio?.src || "", state: listeningPlaybackState }));
  check("play action opens the matching original audio file", playback.src.includes(listeningUi.source) && playback.state.message.includes("原始音频"), JSON.stringify(playback));
  await page.evaluate(() => stopListeningAudio());
  await page.click('#practiceModal [data-close="practiceModal"]');

  await seedTask({ category: "reading", title: "通知公告阅读" });
  await page.evaluate(() => openTask("topik102-reading"));
  await page.click("#openPractice");
  await page.waitForSelector("#practiceModal:not(.hidden) .question-passage", { timeout: 5000 });
  await page.locator("#openMaterialImage img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => (document.querySelector("#openMaterialImage img")?.naturalWidth || 0) > 0, { timeout: 5000 });
  const readingUi = await page.evaluate(() => ({
    count: activePractice.length,
    instruction: document.querySelector(".question-instruction p")?.textContent.trim(),
    passage: document.querySelector(".question-passage p")?.textContent.trim(),
    imageWidth: document.querySelector("#openMaterialImage img")?.naturalWidth || 0,
    modalWidth: document.querySelector("#practiceModal .modal-panel")?.scrollWidth || 0,
    viewportWidth: document.documentElement.clientWidth
  }));
  check("reading modal keeps question and source text separate", readingUi.count === 4 && readingUi.instruction && readingUi.passage && readingUi.instruction !== readingUi.passage, JSON.stringify(readingUi));
  check("reading original question image loads", readingUi.imageWidth > 0, JSON.stringify(readingUi));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth, modal: document.querySelector("#practiceModal .modal-panel")?.getBoundingClientRect().width || 0 }));
  check("material practice has no mobile horizontal overflow", mobile.page <= mobile.viewport + 1 && mobile.modal > 0 && mobile.modal <= mobile.viewport + 1, JSON.stringify(mobile));
  return results;
}
