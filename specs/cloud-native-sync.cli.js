async page => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `codex-cloud-${suffix}@example.com`;
  const password = `Cloud-${suffix}-Test`;
  const note = `云同步验收 ${suffix}`;
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };
  const openAccount = async () => {
    const hidden = await page.locator("#accountModal").evaluate(element => element.classList.contains("hidden"));
    if (hidden) await page.click("#openAccount");
  };

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#accountState")?.textContent.trim() === "未登录");
  await openAccount();
  await page.fill("#accountEmail", email);
  await page.fill("#accountPassword", password);
  await page.click("#signUpButton");
  await page.waitForFunction(() => document.querySelector("#accountState")?.textContent.trim() === "已同步", null, { timeout: 20000 });
  const userId = await page.evaluate(() => cloud.session?.user?.id || "");
  check("registration signs in", Boolean(userId));

  await page.evaluate(async externalNote => {
    writeExternalStudyRecords([{
      id: `cloud-test-${Date.now()}`,
      note: externalNote,
      createdAt: new Date().toISOString(),
      actualSeconds: 1500,
      activities: [{ category: "vocabulary", minutes: 25 }],
      planningImpact: "补录已计入实际用时；原周计划和完成状态不变。"
    }]);
    await saveCloudState(true);
  }, note);
  check("study state saves", await page.evaluate(expected => readExternalStudyRecords().some(item => item.note === expected), note));

  await openAccount();
  await page.click("#signOutButton");
  await page.evaluate(() => {
    localStorage.removeItem("topikPrototypeExternalStudyRecords");
    localStorage.removeItem("topikPrototypeCloudUpdatedAt");
  });
  await page.reload({ waitUntil: "networkidle" });
  await openAccount();
  await page.fill("#accountEmail", email);
  await page.fill("#accountPassword", password);
  await page.click("#signInButton");
  await page.waitForFunction(expected => readExternalStudyRecords().some(item => item.note === expected), note, { timeout: 25000 });
  await page.waitForTimeout(1200);
  check("login restores saved state", await page.evaluate(expected => readExternalStudyRecords().some(item => item.note === expected), note));

  await openAccount();
  await page.click("#signOutButton");
  await openAccount();
  await page.fill("#accountEmail", email);
  await page.fill("#accountPassword", `${password}-wrong`);
  await page.click("#signInButton");
  await page.waitForTimeout(6000);
  const message = await page.locator("#toast").textContent();
  check("wrong password is explained", message.includes("邮箱或密码不正确"), message);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    modalRight: document.querySelector("#accountModal .modal-panel")?.getBoundingClientRect().right || 0
  }));
  check("mobile modal has no page overflow", mobile.scrollWidth <= mobile.width + 1 && mobile.modalRight <= mobile.width + 1, JSON.stringify(mobile));
  return { testAccount: { email, userId }, results };
}
