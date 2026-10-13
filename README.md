# AcousticLab Demo

在浏览器里采集、观察与理解声音的轻量实验台。支持电脑麦克风、本地音频和已知测试信号，音频在本机处理，无需后端。

## 三种工作方式

| 输入 | 用途 | 操作 |
| --- | --- | --- |
| 实时采集 | 观察环境声音、语音和瞬态 | 开启麦克风，暂停读数，停止释放设备 |
| 文件分析 | 检查已有录音 | 选择本地音频，循环分析，定位到指定时间 |
| 信号实验 | 验证波形、主频与谐波 | 选择正弦波或方波，实时调整频率、振幅和 FFT 点数 |

选择输入 → 开始分析 → 观察图形 → 暂停读数 → 导出当前帧。

## 工作区

- 左侧集中管理输入和参数，顶部控制开始、暂停、继续与停止。
- 当前帧读数：RMS、峰值、主频和数字电平 dBFS。
- 紧凑时域波形，可叠加 Hilbert 包络；观测窗口为 20–200 ms。
- 带坐标的频谱、STFT 声谱图、48 带 Mel 声谱图和 13 维 MFCC。
- 图表可放大，按 Escape 收起；Mel 和 MFCC 可隐藏。
- STFT 和 Mel 保存最近 240 个分析帧，放大和窗口缩放不会清空历史。
- 显示频率范围与 Mel 分析范围分开配置，图表缩放不会改变特征结果。
- CSV 导出包含当前帧的频谱、Mel 能量、MFCC、读数及分析参数。
- “名词与实验”提供方法说明及纯音、方波谐波、频率分辨率三组可运行预设。

生成信号与文件分析均静音运行。暂停会挂起音频处理并冻结全部图表，文件进度也会暂停；麦克风模式下，停止才会释放采集设备。暂停时需先继续分析再调整文件位置和计算参数。

## 分析方法

同一份短时采样经过 Hann 加窗与 FFT 后，产生频谱和 STFT 历史。48 个 Mel 间隔的三角滤波器汇聚频谱能量，转换为 dB 对数能量后，进行未归一化 DCT-II，保留 C0–C12。RMS 和峰值由未加窗的采样计算；单边频谱补偿 Hann 窗的幅度增益。

FFT 点数支持 1,024–16,384。帧长为 `FFT 点数 / 采样率`，频率间隔为 `采样率 / FFT 点数`。例如 48 kHz、4,096 点对应约 85.3 ms 和 11.72 Hz/bin。

当前处理以浏览器实时帧读取为基础，更新上限为 25 Hz，尚未采用固定采样帧移。因此声谱图横轴表示分析帧先后，不是精确、均匀的秒刻度。MFCC 的数值比较需要保持采样率、FFT、Mel 范围及变换约定一致。

## 本地运行

需要安装支持当前 Vite 版本的 Node.js；CI 使用 Node.js 22。

```bash
npm ci
npm run dev
```

访问终端中显示的地址。指定本地预览端口：

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

构建与预览：

```bash
npm run build
npm run preview
```

麦克风需要浏览器权限及 localhost / HTTPS 环境。字体使用系统字体，页面无需加载远程字体资源。

## 项目结构

```text
src/
  App.vue                         工作区状态与页面组织
  components/
    SignalSourcePanel.vue         输入选择、信号参数与文件定位
    AnalysisPanel.vue             图表容器与放大操作
    HeatmapCanvas.vue             STFT / Mel 共用的历史渲染
    LabReference.vue              名词说明与实验入口
    WaveformCanvas.vue            时域与 Hilbert 包络
    SpectrumCanvas.vue            单边幅度频谱
    MfccCanvas.vue                MFCC 读数图
  composables/
    useAudioInput.ts              音频会话、输入与暂停生命周期
    useAnalysisFrames.ts          共享帧计算链路
  data/lab.ts                     实验预设与名词内容
  lib/chartTheme.ts               图形配色与统一强度色阶
```

Vue 3 + TypeScript + Vite，Web Audio API 处理音频，Canvas 绘制图形。GitHub Actions 在向 `main` 推送及发起 PR 时运行 `npm ci` 和类型检查 / 生产构建。

## 测量边界

电平使用 `20 log₁₀(RMS)` 得到 dBFS，表示相对数字满刻度的强度。物理声压级 dB SPL 需要麦克风及声源校准；当前工具不会把 dBFS 当作已校准声压级。短帧 Hilbert 包络两端可能存在边缘效应。

后续重点是固定采样帧移、离线片段分析和录音保存。
