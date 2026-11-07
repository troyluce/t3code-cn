import { assert, describe, it } from "@effect/vitest";
import { localizeChineseCode } from "./zh-cn-localization.ts";

const file = "/fixture/apps/web/src/Fixture.tsx";

describe("Chinese build translation", () => {
  it("translates display values while preserving command identifiers, routes and input values", () => {
    const input = `import { Settings } from "./Settings";
      const request = {type: "message.dispatch", command: "Stop", value: "Default", title: "New thread"};
      const route = "/settings";
      type StageLabel = "Beta";
      function resolveStageLabel(): StageLabel { return "Beta"; }
      const info = {label: "message.dispatch"};
      const error = new Error("Settings");
      confirmApproval("accept"); confirmMerge("merge"); setError("offline");
      const command = <code>npx t3 serve</code>;
      const example = <CodeBlock text="bun test" />;
      const brand = <span translate="no">Code</span>;
      const wordmark = <span><T3Wordmark /><span>Code</span></span>;
      const ONBOARDING_STAGES = ["Connect", "Agents", "Projects"] as const;
      const node = <button aria-label="Settings" value="Default">Settings</button>;
      if (request.command === "Stop") request.value = "Default";`;
    const output = localizeChineseCode(input, file, {
      Settings: "设置",
      "New thread": "新建会话",
      Default: "默认",
      Beta: "测试版",
      accept: "接受",
      merge: "合并",
      offline: "离线",
      "message.dispatch": "调度消息",
      "npx t3 serve": "错误的翻译",
      "bun test": "错误的翻译",
      Code: "代码",
      Connect: "连接",
      Agents: "智能体",
      Projects: "项目",
    })!.code;
    assert.include(output, 'title: "新建会话"');
    assert.include(output, 'aria-label={"设置"}');
    assert.include(output, ">设置</button>");
    assert.include(output, '["连接", "智能体", "项目"]');
    for (const preserved of [
      '"./Settings"',
      'type: "message.dispatch"',
      'command: "Stop"',
      'value: "Default"',
      '"/settings"',
      'request.command === "Stop"',
      'return "Beta"',
      'label: "message.dispatch"',
      'new Error("Settings")',
      'confirmApproval("accept")',
      'confirmMerge("merge")',
      'setError("offline")',
      "<code>npx t3 serve</code>",
      '<CodeBlock text="bun test" />',
      '<span translate="no">Code</span>',
      "<T3Wordmark /><span>Code</span>",
    ])
      assert.include(output, preserved);
  });

  it("preserves interpolation evaluation and coercion order when Chinese reorders placeholders", () => {
    const input = "const label = {title: `Find ${first()} in ${second()}`}; return label.title;";
    const output = localizeChineseCode(input, file, { "Find {0} in {1}": "在{1}中查找{0}" })!.code;
    const calls: string[] = [];
    const result = Function(
      "first",
      "second",
      output,
    )(
      () => {
        calls.push("first");
        return {
          toString: () => {
            calls.push("first-string");
            return "文件";
          },
        };
      },
      () => {
        calls.push("second");
        return {
          toString: () => {
            calls.push("second-string");
            return "项目";
          },
        };
      },
    );
    assert.equal(result, "在项目中查找文件");
    assert.deepEqual(calls, ["first", "first-string", "second", "second-string"]);
    assert.throws(
      () => localizeChineseCode(input, file, { "Find {0} in {1}": "缺少一个占位符{0}" }),
      /Invalid translation placeholders/,
    );
  });

  it("handles JSX boundaries, nested text and Chinese plural counts without losing dynamic values", () => {
    const input =
      'const label = {title: `${count} thread${count === 1 ? "" : "s"}`}; return label.title;';
    const output = localizeChineseCode(input, file, { "{0} thread{1}": "{0} 个会话{1}" })!.code;
    assert.equal(Function("count", output)(2), "2 个会话");
    const jsx = "const node = <p>\n  Open &amp; close\n</p>;";
    assert.include(
      localizeChineseCode(jsx, file, { "Open &amp; close": "打开 & 关闭" })!.code,
      "打开 &amp; 关闭",
    );
  });
});
