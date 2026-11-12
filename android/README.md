# Ogden 850 · 离线安卓版

把 `index.html` 装进安卓 App，**完全离线**可用，包括发音。

## 发音怎么离线

安卓 App 里的 WebView 不支持网页的 `speechSynthesis`，在线朗读又要联网，所以离线时原来点了没声音。App 里按顺序尝试：

1. **打包好的录音**：`tools/gen_audio.py` 把页面上所有可点读的单词、释义、例句、近义词（6773 条）用微软神经网络语音录成英音（en-GB-SoniaNeural）和美音（en-US-JennyNeural），Opus 16 kbit/s，共约 60 MB。文件名是文字的 cyrb53 值，`index.html` 用同一个函数找文件，不需要索引表。
2. **手机自带的朗读引擎**（`window.AndroidTTS`）：万一有没录到的文字。
3. **在线朗读**：手机也没有英文语音、又有网络时。

网站版不受影响（没有 `window.AndroidTTS` 时仍是原来的在线朗读）。

## 打包

需要 JDK 17+、Android SDK（`ANDROID_HOME`）、Gradle 9、ffmpeg、`pip install edge-tts`。

```bash
python3 tools/gen_audio.py /path/to/audio      # 录音（已有的文件会跳过，可中断后续录）
AUDIO_DIR=/path/to/audio android/build-apk.sh  # → android/ogden-850.apk
```

正式签名读取 `android/keystore.properties`（不在仓库里）。**每次发布必须用同一把密钥**，否则手机无法覆盖安装旧版。

## 测试

`test-offline.mjs`、`test-sample.mjs`：在打开飞行模式的手机或模拟器上，经 WebView 调试接口点击发音按钮，检查实际播放的是打包录音还是后备。需要 debug 版 APK（`gradle assembleDebug`）和 `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`。
