async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };
  const waitForReward = () => page.waitForTimeout(650);
  const closeReward = () => page.evaluate(() => document.querySelector("#rewardModal")?.classList.add("hidden"));
  const rewardSnapshot = () => page.evaluate(() => ({
    state: readRewardState(),
    modalVisible: !document.querySelector("#rewardModal")?.classList.contains("hidden"),
    frame: document.querySelector(".reward-companion-frame")?.src || "",
    visualText: document.querySelector("#rewardVisual")?.textContent.trim() || ""
  }));

  await page.evaluate(() => {
    localStorage.setItem("topikPrototypeRewards", JSON.stringify({ unlocked: [], checkinDates: [], solvedErrors: 0 }));
    recordCheckinReward({ checkin: { updatedAt: "2026-07-19T02:00:00.000Z" } });
  });
  await waitForReward();
  const day1 = await rewardSnapshot();
  check("Day1 unlocks after first real check-in", day1.state.unlocked.includes("first-checkin") && day1.state.checkinDates.length === 1, JSON.stringify(day1));
  check("Day1 opens frozen companion scene", day1.modalVisible && day1.frame.endsWith("rewardDay=1"), JSON.stringify(day1));

  await closeReward();
  await page.evaluate(() => {
    localStorage.setItem("topikPrototypeRewards", JSON.stringify({
      unlocked: ["first-checkin"],
      checkinDates: ["2026-07-01", "2026-07-03", "2026-07-05", "2026-07-07", "2026-07-09", "2026-07-11"],
      solvedErrors: 0
    }));
    recordCheckinReward({ checkin: { updatedAt: "2026-07-19T02:00:00.000Z" } });
  });
  await waitForReward();
  const gapped = await rewardSnapshot();
  check("gapped dates do not unlock Day7", !gapped.state.unlocked.includes("checkin-7") && !gapped.modalVisible, JSON.stringify(gapped));

  await page.evaluate(() => {
    localStorage.setItem("topikPrototypeRewards", JSON.stringify({
      unlocked: ["first-checkin"],
      checkinDates: ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18"],
      solvedErrors: 0
    }));
    recordCheckinReward({ checkin: { updatedAt: "2026-07-19T02:00:00.000Z" } });
  });
  await waitForReward();
  const day7 = await rewardSnapshot();
  check("seven consecutive dates unlock Day7", day7.state.unlocked.includes("checkin-7") && day7.state.checkinDates.length === 7, JSON.stringify(day7));
  check("Day7 opens frozen companion scene", day7.modalVisible && day7.frame.endsWith("rewardDay=7"), JSON.stringify(day7));

  await closeReward();
  await page.evaluate(() => recordCheckinReward({ checkin: { updatedAt: "2026-07-19T10:00:00.000Z" } }));
  await waitForReward();
  const duplicate = await rewardSnapshot();
  check("same-day completion is deduplicated", duplicate.state.checkinDates.length === 7 && !duplicate.modalVisible, JSON.stringify(duplicate));

  return results;
}
