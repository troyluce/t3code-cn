require("./compileCache.cjs");
require("electron").app.commandLine.appendSwitch("lang", "zh-CN");
require("./main.cjs");
