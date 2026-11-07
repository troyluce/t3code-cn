# T3 Code Windows 简体中文版

基于官方 0.1.7，提供 Windows x64 EXE 安装包。汉化覆盖主界面、设置、桌面菜单、操作提示和时间显示，中文资源随安装包提供。

从本仓库的 [Releases](https://github.com/troyluce/t3code-cn/releases) 下载文件名带有 `zh-CN-x64.exe` 的安装包并运行。安装包内包含官方同版本的 WSL 运行时。

本项目沿用上游 MIT 许可证。[官方源码](https://github.com/pingdotgg/t3code)。

## 从源码构建

安装仓库要求的 Vite+ 和依赖后，在 PowerShell 中设置中文构建开关：

```powershell
$env:T3CODE_ZH_CN = "1"
vp run dist:desktop:win:x64 --build-version 0.1.7
```

可通过上游打包脚本的 `--wsl-runtime` 参数指定同版本 Linux x64 CLI 归档，将 WSL 运行时一并打包。
