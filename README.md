# Ogden's Basic English 850 · 850 词学习手册

C.K. Ogden 1930 年设计的 Basic English 850 个核心词，中英双语，每个词都有释义、例句、近义词和发音，还能卡片练习。

- **网页版**：<https://ogden-850-bsz.pages.dev/>（打开过一次后，没网也能打开）
- **安卓 App**：在 [Releases](https://github.com/Freecode100Year/ogden-850/releases) 下载 `ogden-850.apk`，完全离线，自带英音 / 美音录音

## 功能

- 850 词分 5 类（操作词、通用词、图示词、性质词、反义对），可搜索单词、释义或例句
- 英式 / 美式发音，单词、释义、例句都能点读
- 卡片练习、收藏、浅色 / 深色、简体 / 繁体
- 手机、平板、电脑自动适配

## 文件

| 路径 | 作用 |
|---|---|
| `index.html` | 整个网站（数据、样式、脚本都在里面） |
| `sw.js` | 离线缓存：网页、图标、字体 |
| `deploy.sh` | 发布网站到 Cloudflare Pages |
| `functions/api/tts.js` | Cloudflare Pages 函数，网页的在线发音 |
| `manifest.json`、`icons/`、`favicon.png` | 添加到主屏幕用的图标和信息 |
| `android/` | 安卓离线 App，见 [android/README.md](android/README.md) |
| `tools/gen_audio.py` | 给安卓 App 预先录好全部发音 |

## 发音的顺序

- 网页：本站 `/api/tts` → Google 朗读 → 浏览器自带朗读（没网时就用这个）
- 安卓 App：App 里自带的录音 → 手机自带朗读 → 在线朗读

## 部署网页

这是一个 Cloudflare Pages 项目（`ogden-850`），没有构建步骤：

```bash
CLOUDFLARE_API_TOKEN=你的令牌 ./deploy.sh
```

脚本只上传网站需要的文件（不含 `android/`、`tools/`）。需要 Node.js 22 以上，以及有 Pages 权限的 Cloudflare API Token。
