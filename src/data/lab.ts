export const experiments = [
  { id: 'tone', title: '纯音与主频', description: '一个频率，观察时域周期与频谱峰。', frequency: 1000, type: 'sine' as const, fftSize: 4096, maxFrequency: 5000, guide: '调节频率，观察频谱峰左右移动。1 kHz 信号的周期约为 1 ms。' },
  { id: 'harmonics', title: '方波与谐波', description: '同一基频，观察波形与谐波分布。', frequency: 500, type: 'square' as const, fftSize: 4096, maxFrequency: 5000, guide: '关注 500、1500、2500 Hz 附近的峰。带限方波包含基频及多个奇次谐波。' },
  { id: 'resolution', title: '频率分辨率', description: '改变 FFT 点数，观察频谱峰的宽度。', frequency: 1000, type: 'sine' as const, fftSize: 1024, maxFrequency: 2000, guide: '在 1024 和 8192 点之间切换。点数增加后频率间隔变小，分析帧也变长。' },
]

export const glossary = [
  { group: '波形', title: '时域波形', body: '振幅随时间变化的曲线。用于观察周期、瞬态和振幅起伏。横轴是时间，纵轴是数字振幅。' },
  { group: '波形', title: 'Hilbert 包络', body: '将信号与它的 Hilbert 变换组成解析信号，再取复幅值，得到瞬时振幅轮廓。短帧两端可能有边缘效应。' },
  { group: '频率', title: 'FFT 与频谱', body: 'FFT 把有限长度的采样帧分解为频率分量。本工具使用 Hann 窗；频谱展示单边幅度，Hann 窗增益已补偿。' },
  { group: '频率', title: 'STFT 声谱图', body: '把短时频谱按时间排列。纵轴为频率，颜色为强度。本工具当前读取浏览器实时帧，更新上限为 25 Hz，并非固定采样帧移。' },
  { group: '特征', title: 'Mel 声谱图', body: '使用 48 个 Mel 间隔的三角滤波器汇聚 FFT 能量，并转为对数尺度。分析范围独立于频谱显示范围。' },
  { group: '特征', title: 'MFCC', body: '对对数 Mel 能量做 DCT-II，保留 C0 到 C12。当前采用 dB 对数能量及未归一化 DCT，数值比较需要保持参数一致。' },
  { group: '读数', title: 'RMS 与峰值', body: 'RMS 是采样帧的均方根，表示有效幅度；峰值是最大绝对振幅。两者均由未加窗的原始采样计算。' },
  { group: '读数', title: 'dBFS', body: '相对于数字满刻度的电平，计算为 20 log₁₀(RMS)。这是数字电平；物理声压级 dB SPL 需要麦克风校准。' },
  { group: '参数', title: 'FFT 点数与帧长', body: '频率间隔为采样率除以 FFT 点数；帧长为 FFT 点数除以采样率。更长的帧有更细的频率间隔。' },
  { group: '参数', title: '奈奎斯特频率', body: '采样率的一半，是当前采样能够表示的频率上限。生成方波也受到该上限约束。' },
]
