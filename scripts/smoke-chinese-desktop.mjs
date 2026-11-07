import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeAssert from "node:assert/strict";
import { _electron } from "playwright-core";

const executable = NodePath.resolve(process.argv[2]);
const output = NodePath.resolve(process.argv[3]);
const state = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-zh-launch-"));
await NodeFSP.mkdir(output, { recursive: true });
const app = await _electron.launch({
  executablePath: executable,
  args: ["--user-data-dir=" + NodePath.join(state, "electron")],
  env: { ...process.env, T3CODE_HOME: NodePath.join(state, "t3"), T3CODE_DEV_SEED: "0" },
  timeout: 120000,
});
let deadline;
try {
  const page = await new Promise((resolve, reject) => {
    deadline = setTimeout(() => reject(new Error("桌面主窗口未能加载。")), 120000);
    const watch = (candidate) => {
      candidate
        .waitForURL("t3code://app/**", { timeout: 120000 })
        .then(() => resolve(candidate))
        .catch(() => {});
    };
    app.on("window", watch);
    for (const candidate of app.windows()) watch(candidate);
  });
  clearTimeout(deadline);
  await page.waitForLoadState("domcontentloaded");
  await page
    .getByRole("button", { name: /设置|新建|添加|创建|开始|继续|登录/ })
    .first()
    .waitFor({ state: "visible", timeout: 120000 });
  NodeAssert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  const menuLabels = await app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()?.items.map((item) => item.label) ?? [],
  );
  for (const label of ["文件", "编辑", "视图", "窗口", "帮助"])
    NodeAssert.ok(menuLabels.includes(label), "菜单缺少中文：" + label);
  const onboardingClose = page.getByRole("button", { name: "关闭", exact: true });
  if (await onboardingClose.isVisible()) {
    await page.screenshot({ path: NodePath.join(output, "windows-onboarding.png") });
    await onboardingClose.click();
    await onboardingClose.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.screenshot({ path: NodePath.join(output, "windows-home.png") });
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const settings = Menu.getApplicationMenu()
      ?.items.find((item) => item.label === "文件")
      ?.submenu?.items.find((item) => item.label.startsWith("设置"));
    if (!settings) throw new Error("未找到设置菜单项。");
    settings.click(settings, BrowserWindow.getFocusedWindow(), {});
  });
  await page
    .getByRole("combobox", { name: "搜索设置", exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
  await page.screenshot({ path: NodePath.join(output, "windows-settings.png") });
  const version = await app.evaluate(({ app }) => app.getVersion());
  NodeAssert.equal(version, "0.1.7");
  await NodeFSP.writeFile(
    NodePath.join(output, "launch-verification.json"),
    JSON.stringify(
      {
        version,
        locale: "zh-CN",
        menus: menuLabels,
        screenshots: ["windows-home.png", "windows-settings.png"],
        checks: [
          "packaged application launched",
          "Chinese HTML locale",
          "Chinese desktop menus",
          "Chinese settings opened",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS: Windows x64 打包程序启动，中文菜单和设置页验证通过。");
} finally {
  clearTimeout(deadline);
  await app.close();
  await NodeFSP.rm(state, { recursive: true, force: true });
}
