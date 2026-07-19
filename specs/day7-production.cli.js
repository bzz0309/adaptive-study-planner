async page => {
  const results = [];
  const check = (name, passed, details = "") => {
    results.push({ name, passed, details });
    if (!passed) throw new Error(`${name}: ${details}`);
  };

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "抽一张", exact: true }).first().click();
  await page.getByRole("button", { name: "查看背面", exact: true }).click();
  check("Day7 can reveal the back", await page.getByRole("button", { name: "查看正面", exact: true }).isVisible());
  await page.getByRole("button", { name: "查看正面", exact: true }).click();
  await page.getByRole("button", { name: "收下", exact: true }).click();
  check("Day7 can be collected", await page.getByRole("button", { name: "查看成长回顾", exact: true }).isVisible());

  const desktop = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  check("Day7 desktop has no page overflow", desktop.scrollWidth <= desktop.width, JSON.stringify(desktop));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  check("Day7 mobile has no page overflow", mobile.scrollWidth <= mobile.width, JSON.stringify(mobile));

  return results;
}
