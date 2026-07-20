async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("topikPrototypeOnboarded", "yes");
    switchView("wordElimination");
    closeModal("accountModal");
  });
  const initial = await page.evaluate(() => ({
    pool: wordEliminationPracticeItems().length,
    batches: wordEliminationBatches().map(items => items.length),
    group: document.querySelector("#wordEliminationView .score-pill small")?.textContent.trim(),
    progress: document.querySelector("#wordEliminationView .score-pill strong")?.textContent.trim()
  }));
  check("word elimination starts with four real groups", initial.pool === 80 && initial.batches.join(",") === "20,20,20,20" && initial.group === "第 1 组 · 共 4 组" && initial.progress === "0 / 20", JSON.stringify(initial));

  await page.evaluate(() => {
    writeWordEliminationState({ clearedIds: wordEliminationBatches()[0].map(item => item.id), batchIndex: 0, mode: "batch", mistakeIds: [], reviewedWeakIds: [] });
    renderWordEliminationView();
  });
  check("clean first group offers next group", (await page.textContent("#continueWordElimination")).trim() === "开始下一组", await page.textContent("#continueWordElimination"));
  await page.click("#continueWordElimination");
  const second = await page.evaluate(() => ({
    state: readWordEliminationState(),
    sourceCount: currentWordEliminationItems().filter(item => item.source?.includes("第102届 TOPIK II")).length,
    total: document.querySelector("#wordEliminationView .score-pill span")?.textContent.trim()
  }));
  check("second group is sourced from imported TOPIK material", second.state.batchIndex === 1 && second.sourceCount === 20 && second.total === "总进度 20 / 80", JSON.stringify(second));

  await page.evaluate(() => {
    writeWordEliminationState({ batchIndex: 3, mode: "batch", completedBatchIds: ["batch-1", "batch-2", "batch-3"], clearedIds: [] });
    renderWordEliminationView();
  });
  const textbookBatch = await page.evaluate(() => ({
    count: currentWordEliminationItems().length,
    sources: [...new Set(currentWordEliminationItems().map(item => item.source))]
  }));
  check("later groups use verified textbook vocabulary", textbookBatch.count === 20 && textbookBatch.sources.length === 1 && textbookBatch.sources[0]?.includes("完全掌握 TOPIK I 初级词汇"), JSON.stringify(textbookBatch));
  await page.evaluate(() => {
    writeWordEliminationState({ clearedIds: currentWordEliminationItems().map(item => item.id) });
    renderWordEliminationView();
  });
  const final = await page.evaluate(() => ({
    title: document.querySelector(".elimination-empty strong")?.textContent.trim(),
    copy: document.querySelector(".elimination-empty p")?.textContent.trim(),
    action: document.querySelector("#continueWordElimination")?.textContent.trim(),
    total: document.querySelector("#wordEliminationView .score-pill span")?.textContent.trim()
  }));
  check("all available words finish honestly", final.title === "第 4 组已完成" && final.copy?.includes("80 个词已全部完成") && final.action === "从第一组重新巩固" && final.total === "总进度 80 / 80", JSON.stringify(final));
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
  return results;
}
