import { createTriodeScene } from './triodeScene.js';
import { createLogicScene } from './logicScene.js';
import { createMemoryScene } from './memoryScene.js';
import { createMachineScene } from './machineScene.js';

export const SCENES = [
  {
    id: 'triode',
    idx: 'L1',
    name: '真空三极管',
    en: 'TRIODE',
    desc: '看见电子被栅极"闸住"：热电子发射、空间电荷、放大与开关。',
    create: createTriodeScene,
  },
  {
    id: 'logic',
    idx: 'L2',
    name: '逻辑门',
    en: 'NOR GATE',
    desc: '两只三极管并联就是 NOR——一个能搭出所有逻辑的"通用门"。',
    create: createLogicScene,
  },
  {
    id: 'memory',
    idx: 'L3',
    name: '触发器 · 寄存器',
    en: 'FLIP-FLOP',
    desc: '让电流自己"记住"自己：双稳态、时钟脉冲与 4 位计数器。',
    create: createMemoryScene,
  },
  {
    id: 'machine',
    idx: 'L4',
    name: '存储程序计算机',
    en: 'STORED PROGRAM',
    desc: '取指 → 译码 → 执行：一台 4 位计算机在眼前单步跑起来。',
    create: createMachineScene,
  },
];
