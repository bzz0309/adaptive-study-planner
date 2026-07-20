async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("topikPrototypeOnboarded", "yes");
    localStorage.setItem("topikPrototypeSettings", JSON.stringify({ exam: "TOPIK", level: "II", targetGrade: "3" }));
    switchView("wordElimination");
    closeModal("accountModal");
  });
  const initial = await page.evaluate(() => ({
    pool: wordEliminationPracticeItems().length,
    batches: wordEliminationBatches().map(items => items.length),
    group: document.querySelector("#wordEliminationView .score-pill small")?.textContent.trim(),
    progress: document.querySelector("#wordEliminationView .score-pill strong")?.textContent.trim()
  }));
  check("TOPIK II word elimination starts with five verified groups", initial.pool === 100 && initial.batches.join(",") === "20,20,20,20,20" && initial.group === "第 1 组 · 共 5 组" && initial.progress === "0 / 20", JSON.stringify(initial));
  const sharedTopikII = await page.evaluate(() => ({
    profile: vocabularyPracticeProfile(),
    dictationIds: dictationPracticeItems().map(item => item.id),
    eliminationIds: wordEliminationPracticeItems().map(item => item.id),
    copy: [...document.querySelectorAll("#wordEliminationView .page-heading p")].map(node => node.textContent).join(" ")
  }));
  check("TOPIK II dictation and elimination share the selected-level pool", sharedTopikII.profile.label === "TOPIK II · 目标3级" && sharedTopikII.dictationIds.join(",") === sharedTopikII.eliminationIds.join(",") && sharedTopikII.copy?.includes("已导入 100 词") && sharedTopikII.profile.items.every(item => item.source?.includes("TOPIK II")), JSON.stringify({ profile: sharedTopikII.profile, copy: sharedTopikII.copy }));
  check("TOPIK II pool has no duplicate cards", new Set(sharedTopikII.profile.items.map(item => item.id)).size === 100 && new Set(sharedTopikII.profile.items.map(item => item.text)).size === 100 && new Set(sharedTopikII.profile.items.map(item => item.zh)).size === 100, JSON.stringify(sharedTopikII.profile.items.map(item => ({ id: item.id, text: item.text, zh: item.zh }))));

  const soundSetup = await page.evaluate(() => {
    window.__wordEliminationSounds = [];
    document.addEventListener("word-elimination-sound", event => window.__wordEliminationSounds.push(event.detail.kind));
    const [first, second] = currentWordEliminationItems();
    return {
      first: first.id,
      second: second.id,
      label: document.querySelector("#toggleWordEliminationSound")?.textContent.trim(),
      pressed: document.querySelector("#toggleWordEliminationSound")?.getAttribute("aria-pressed")
    };
  });
  check("sound feedback is on by default and explicitly controllable", soundSetup.label === "音效 开" && soundSetup.pressed === "true", JSON.stringify(soundSetup));
  await page.click("#toggleWordEliminationSound");
  const soundOff = await page.evaluate(() => ({
    label: document.querySelector("#toggleWordEliminationSound")?.textContent.trim(),
    pressed: document.querySelector("#toggleWordEliminationSound")?.getAttribute("aria-pressed"),
    saved: localStorage.getItem("topikPrototypeWordEliminationSound")
  }));
  await page.click(`[data-elimination-type="word"][data-elimination-id="${soundSetup.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${soundSetup.second}"]`);
  await page.waitForTimeout(300);
  const mutedSounds = await page.evaluate(() => window.__wordEliminationSounds);
  check("sound feedback can be muted and stays muted", soundOff.label === "音效 关" && soundOff.pressed === "false" && soundOff.saved === "off" && mutedSounds.length === 0, JSON.stringify({ soundOff, mutedSounds }));
  await page.click("#toggleWordEliminationSound");
  await page.evaluate(() => { window.__wordEliminationSounds = []; });
  await page.click(`[data-elimination-type="word"][data-elimination-id="${soundSetup.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${soundSetup.second}"]`);
  await page.waitForTimeout(400);
  await page.click(`[data-elimination-type="word"][data-elimination-id="${soundSetup.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${soundSetup.first}"]`);
  await page.waitForTimeout(350);
  const pairSounds = await page.evaluate(() => window.__wordEliminationSounds);
  check("wrong and correct pairs emit distinct sounds", pairSounds.includes("error") && pairSounds.includes("correct"), JSON.stringify(pairSounds));

  await page.evaluate(firstId => {
    window.__wordEliminationSounds = [];
    writeWordEliminationState({ selectedWordId: "", selectedMeaningId: "", clearedIds: currentWordEliminationItems().filter(item => item.id !== firstId).map(item => item.id) });
    renderWordEliminationView();
  }, soundSetup.first);
  await page.click(`[data-elimination-type="word"][data-elimination-id="${soundSetup.first}"]`);
  await page.click(`[data-elimination-type="meaning"][data-elimination-id="${soundSetup.first}"]`);
  await page.waitForTimeout(600);
  const completionSound = await page.evaluate(() => ({ sounds: window.__wordEliminationSounds, completed: Boolean(document.querySelector(".elimination-empty")) }));
  check("last pair emits a separate group completion sound", completionSound.completed && completionSound.sounds.join(",") === "correct,complete", JSON.stringify(completionSound));

  await page.evaluate(() => {
    writeWordEliminationState({ clearedIds: wordEliminationBatches()[0].map(item => item.id), batchIndex: 0, mode: "batch", mistakeIds: [], reviewedWeakIds: [] });
    renderWordEliminationView();
  });
  check("clean first group offers next group", (await page.textContent("#continueWordElimination")).trim() === "开始下一组", await page.textContent("#continueWordElimination"));
  await page.click("#continueWordElimination");
  const second = await page.evaluate(() => ({
    state: readWordEliminationState(),
    sourceCount: currentWordEliminationItems().filter(item => item.source?.includes("第102届 TOPIK II")).length,
    sources: [...new Set(currentWordEliminationItems().map(item => item.source))],
    total: document.querySelector("#wordEliminationView .score-pill span")?.textContent.trim()
  }));
  check("second group is sourced from verified TOPIK II textbook vocabulary", second.state.batchIndex === 1 && second.sourceCount === 0 && second.sources.length === 1 && second.sources[0]?.includes("TOPIK II 中高级词汇") && second.total === "总进度 20 / 100", JSON.stringify(second));

  await page.evaluate(() => {
    writeWordEliminationState({ batchIndex: 2, mode: "batch", completedBatchIds: ["batch-1", "batch-2"], clearedIds: [] });
    renderWordEliminationView();
  });
  const textbookBatch = await page.evaluate(() => ({
    count: currentWordEliminationItems().length,
    sources: [...new Set(currentWordEliminationItems().map(item => item.source))]
  }));
  check("later groups use verified TOPIK II textbook vocabulary", textbookBatch.count === 20 && textbookBatch.sources.length === 1 && textbookBatch.sources[0]?.includes("完全掌握 TOPIK II 中高级词汇"), JSON.stringify(textbookBatch));
  await page.evaluate(() => {
    writeWordEliminationState({ clearedIds: currentWordEliminationItems().map(item => item.id) });
    renderWordEliminationView();
  });
  check("third group offers automatic fourth group", (await page.textContent("#continueWordElimination")).trim() === "开始下一组", await page.textContent("#continueWordElimination"));
  await page.click("#continueWordElimination");
  const fourth = await page.evaluate(() => ({
    state: readWordEliminationState(),
    group: document.querySelector("#wordEliminationView .score-pill small")?.textContent.trim(),
    count: currentWordEliminationItems().length,
    sources: [...new Set(currentWordEliminationItems().map(item => item.source))]
  }));
  check("completing group three unlocks group four without manual update", fourth.state.batchIndex === 3 && fourth.group === "第 4 组 · 共 5 组" && fourth.count === 20 && fourth.sources.every(source => source?.includes("完全掌握 TOPIK II 中高级词汇")), JSON.stringify(fourth));

  await page.evaluate(() => {
    writeWordEliminationState({ batchIndex: 4, mode: "batch", completedBatchIds: ["batch-1", "batch-2", "batch-3", "batch-4"], clearedIds: wordEliminationBatches()[4].map(item => item.id) });
    renderWordEliminationView();
  });
  const final = await page.evaluate(() => ({
    title: document.querySelector(".elimination-empty strong")?.textContent.trim(),
    copy: document.querySelector(".elimination-empty p")?.textContent.trim(),
    action: document.querySelector("#continueWordElimination")?.textContent.trim(),
    total: document.querySelector("#wordEliminationView .score-pill span")?.textContent.trim()
  }));
  check("all available TOPIK II words finish honestly", final.title === "第 5 组已完成" && final.copy?.includes("100 个词已全部完成") && final.action === "从第一组重新巩固" && final.total === "总进度 100 / 100", JSON.stringify(final));
  await page.click("#continueWordElimination");
  const restarted = await page.evaluate(() => readWordEliminationState());
  check("restart preserves completed round count", restarted.batchIndex === 0 && restarted.roundsCompleted === 1 && !restarted.clearedIds.length, JSON.stringify(restarted));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    columns: getComputedStyle(document.querySelector(".elimination-mixed-grid")).gridTemplateColumns.split(" ").length
  }));
  check("word elimination remains usable on mobile", mobile.scroll <= mobile.width + 1 && mobile.columns === 2, JSON.stringify(mobile));

  const topikI = await page.evaluate(() => {
    localStorage.setItem("topikPrototypeSettings", JSON.stringify({ exam: "TOPIK", level: "I", targetGrade: "2" }));
    switchView("dictation");
    const profile = vocabularyPracticeProfile();
    return {
      profile,
      dictationCount: dictationPracticeItems().length,
      eliminationCount: wordEliminationPracticeItems().length,
      batches: wordEliminationBatches().map(items => items.length),
      hasTopikII: dictationPracticeItems().some(item => item.source?.includes("TOPIK II")),
      savedProfile: readDictationState().profileKey,
      copy: [...document.querySelectorAll("#dictationView .page-heading p")].map(node => node.textContent).join(" ")
    };
  });
  check("TOPIK I uses only the shared beginner pool", topikI.profile.label === "TOPIK I · 目标2级" && topikI.dictationCount === 60 && topikI.eliminationCount === 60 && topikI.batches.join(",") === "20,20,20" && !topikI.hasTopikII && topikI.savedProfile === "TOPIK-I-2" && topikI.copy?.includes("已导入 60 词"), JSON.stringify(topikI));
  check("TOPIK I pool has no duplicate cards", new Set(topikI.profile.items.map(item => item.id)).size === 60 && new Set(topikI.profile.items.map(item => item.text)).size === 60 && new Set(topikI.profile.items.map(item => item.zh)).size === 60, JSON.stringify(topikI.profile.items.map(item => ({ id: item.id, text: item.text, zh: item.zh }))));
  return results;
}
