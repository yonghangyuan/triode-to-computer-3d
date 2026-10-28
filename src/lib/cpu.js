/**
 * 教学用 4 位"存储程序计算机"
 * ------------------------------------------------------------------
 *  - 4 位数据 / 4 位地址 / 16 个半字节内存
 *  - 8 位指令：高 4 位操作码，低 4 位地址（或不用）
 *  - 一条指令分 4 个微操作执行：取指① 取指② 译码 执行
 *  - 每个微操作都产生一句中文说明，供 3D 场景高亮总线与教学日志使用
 */

export const ISA = [
  { code: 0, name: 'NOP', args: false, cn: '空操作', desc: '什么都不做，只消耗一个指令周期。' },
  { code: 1, name: 'LDA', args: true, cn: '取数', desc: 'ACC ← M[addr]：把内存里的数搬到累加器。' },
  { code: 2, name: 'ADD', args: true, cn: '加法', desc: 'ACC ← ACC + M[addr]：累加器加上内存里的数。' },
  { code: 3, name: 'SUB', args: true, cn: '减法', desc: 'ACC ← ACC − M[addr]：用补码做减法，结果取 4 位。' },
  { code: 4, name: 'STA', args: true, cn: '存数', desc: 'M[addr] ← ACC：把累加器写回内存。' },
  { code: 5, name: 'JMP', args: true, cn: '跳转', desc: 'PC ← addr：无条件跳转。' },
  { code: 6, name: 'JZ', args: true, cn: '零跳转', desc: '若 ACC = 0 则 PC ← addr：条件分支。' },
  { code: 7, name: 'OUT', args: false, cn: '输出', desc: 'LED ← ACC：把结果送到输出灯。' },
  { code: 8, name: 'HLT', args: false, cn: '停机', desc: '停机：时钟停止，程序结束。' },
];

export const ISA_BY_CODE = Object.fromEntries(ISA.map((i) => [i.code, i]));

export function disassemble(byte) {
  const code = (byte >> 4) & 0xf;
  const operand = byte & 0xf;
  const ins = ISA_BY_CODE[code];
  if (!ins) return `??? (${byte.toString(16).toUpperCase()})`;
  return ins.args ? `${ins.name} ${operand}` : ins.name;
}

export function assemble(asm) {
  const [name, arg] = asm.trim().split(/\s+/);
  const ins = ISA.find((i) => i.name === name);
  if (!ins) throw new Error(`未知指令：${name}`);
  return ((ins.code & 0xf) << 4) | (ins.args ? Number(arg) & 0xf : 0);
}

/** 演示程序：代码行 + 数据初始化 */
export const PROGRAMS = {
  add: {
    name: '3 + 5 = 8',
    tag: '顺序执行',
    note: '取数 → 加法 → 存回 → 输出。一条最简单的"计算"流水。',
    code: [
      ['LDA 8', 0], ['ADD 9', 1], ['STA 10', 2], ['OUT', 3], ['HLT', 4],
    ],
    data: { 8: 3, 9: 5, 10: 0 },
    dataEditable: [8, 9],
  },
  loop: {
    name: '计数 1 → 4',
    tag: '循环 + 条件分支',
    note: '用 SUB 与 JZ 构成循环：每次加 1、输出、与 4 比较，减到 0 就跳出。',
    code: [
      ['LDA 8', 0], ['ADD 9', 1], ['OUT', 2], ['STA 8', 3],
      ['SUB 10', 4], ['JZ 7', 5], ['JMP 0', 6], ['HLT', 7],
    ],
    data: { 8: 0, 9: 1, 10: 4 },
    dataEditable: [9, 10],
  },
};

/** 16 个半字节的内存镜像 */
export function buildMemory(program) {
  const mem = new Uint8Array(16);
  for (const [asm, addr] of program.code) mem[addr] = assemble(asm);
  for (const [addr, value] of Object.entries(program.data)) mem[Number(addr)] = value & 0xf;
  return mem;
}

export class ToyCPU {
  constructor() {
    this.memory = new Uint8Array(16);
    this.reset();
  }

  reset() {
    this.pc = 0;
    this.acc = 0;
    this.ir = 0;
    this.mar = 0;
    this.out = 0;
    this.phase = 'fetch-addr';
    this.halted = false;
    this.cycle = 0;
    this.instructions = 0;
    this.lastRead = -1;
    this.lastWrite = -1;
    this.bus = { addr: null, data: null, ctrl: '' };
    this.outputs = [];
  }

  load(memory) {
    this.memory.set(memory);
    this.reset();
  }

  get opcode() { return (this.ir >> 4) & 0xf; }
  get operand() { return this.ir & 0xf; }
  get ins() { return ISA_BY_CODE[this.opcode]; }
  get zFlag() { return this.acc === 0; }
  get phaseIndex() { return { 'fetch-addr': 0, 'fetch-data': 1, decode: 2, execute: 3 }[this.phase]; }

  /**
   * 执行一个微操作。
   * @returns {{phase:string, tag:string, text:string, detail?:string}}
   */
  step() {
    if (this.halted) {
      return { phase: 'halt', tag: 'sys', text: '时钟已停：程序结束（HLT）', detail: '按"复位"可以重新运行，或修改内存里的数据再试一次。' };
    }
    this.cycle += 1;
    this.lastRead = -1;
    this.lastWrite = -1;
    this.outputs = this.outputs || [];

    if (this.phase === 'fetch-addr') {
      this.mar = this.pc;
      this.bus = { addr: this.mar, data: null, ctrl: '读' };
      this.phase = 'fetch-data';
      return {
        phase: 'fetch-addr',
        tag: 'fetch',
        text: `取指①：PC = ${this.mar} 送上地址总线，选中内存单元 M[${this.mar}]`,
        detail: '程序计数器 PC 里存着"下一条指令的地址"，它先被送到地址总线。',
      };
    }

    if (this.phase === 'fetch-data') {
      this.ir = this.memory[this.mar];
      this.lastRead = this.mar;
      this.bus = { addr: this.mar, data: this.ir, ctrl: '读' };
      this.pc = (this.pc + 1) & 0xf;
      this.phase = 'decode';
      return {
        phase: 'fetch-data',
        tag: 'fetch',
        text: `取指②：M[${this.mar}] = ${this.ir.toString(16).toUpperCase().padStart(2, '0')}H → 指令寄存器 IR；PC 自增到 ${this.pc}`,
        detail: '取出的 8 位指令进入 IR。高 4 位是操作码，低 4 位是地址。',
      };
    }

    if (this.phase === 'decode') {
      const ins = this.ins;
      this.phase = 'execute';
      this.bus = { addr: null, data: null, ctrl: '译码' };
      return {
        phase: 'decode',
        tag: 'decode',
        text: `译码：操作码 ${this.opcode} = ${ins ? ins.name : '???'}（${ins ? ins.cn : '未知'}）${ins && ins.args ? `，地址 = ${this.operand}` : ''}`,
        detail: ins ? ins.desc : '未知指令。',
      };
    }

    // execute
    this.phase = 'fetch-addr';
    this.instructions += 1;
    const ins = this.ins;
    const operand = this.operand;
    let text = '';
    let detail = '';
    this.bus = { addr: null, data: null, ctrl: '执行' };
    if (!ins) {
      text = '执行：遇到未知操作码，停机';
      detail = '检查程序里是否有写错的十六进制数。';
      this.halted = true;
    } else {
      switch (ins.name) {
        case 'NOP':
          text = '执行：NOP，什么都不做';
          detail = '它存在的意义是"占一个时钟周期"，常用于对齐时序或延时。';
          break;
        case 'LDA':
          this.mar = operand;
          this.acc = this.memory[operand];
          this.lastRead = operand;
          this.bus = { addr: operand, data: this.acc, ctrl: '读' };
          text = `执行：ACC ← M[${operand}] = ${this.acc}`;
          detail = `地址 ${operand} 上的数值被读进累加器 ACC，现在是 ${this.acc}（二进制 ${this.acc.toString(2).padStart(4, '0')}）。`;
          break;
        case 'ADD':
          this.mar = operand;
          this.lastRead = operand;
          this.bus = { addr: operand, data: this.memory[operand], ctrl: '读' };
          text = `执行：ACC ← ${this.acc} + ${this.memory[operand]} = ${(this.acc + this.memory[operand]) & 0xf}`;
          detail = '加法器把 ACC 与内存操作数相加，只保留 4 位（模 16）。';
          this.acc = (this.acc + this.memory[operand]) & 0xf;
          break;
        case 'SUB':
          this.mar = operand;
          this.lastRead = operand;
          this.bus = { addr: operand, data: this.memory[operand], ctrl: '读' };
          text = `执行：ACC ← ${this.acc} − ${this.memory[operand]} = ${(this.acc - this.memory[operand] + 16) & 0xf}`;
          detail = '这一台机器没有"-"号：减法用"加上 16 的补码"实现，结果天然落在 0–15。';
          this.acc = (this.acc - this.memory[operand] + 16) & 0xf;
          break;
        case 'STA':
          this.mar = operand;
          this.memory[operand] = this.acc;
          this.lastWrite = operand;
          this.bus = { addr: operand, data: this.acc, ctrl: '写' };
          text = `执行：M[${operand}] ← ACC = ${this.acc}`;
          detail = '与 LDA 方向相反：写内存。注意程序和数据在同一块 16 单元内存里。';
          break;
        case 'JMP':
          this.pc = operand;
          this.bus = { addr: operand, data: null, ctrl: '跳转' };
          text = `执行：PC ← ${operand}，无条件跳转`;
          detail = '地址直接写进 PC，下一次取指就跳到新位置。';
          break;
        case 'JZ':
          if (this.acc === 0) {
            this.pc = operand;
            this.bus = { addr: operand, data: null, ctrl: '跳转' };
            text = `执行：ACC = 0，条件成立，PC ← ${operand}`;
            detail = '零标志 Z 是条件分支的依据：减法把 4 减到 0，循环才能结束。';
          } else {
            text = `执行：ACC = ${this.acc} ≠ 0，条件不成立，PC 继续 = ${this.pc}`;
            detail = '条件不成立时不跳转，继续顺序执行。';
          }
          break;
        case 'OUT':
          this.out = this.acc;
          this.outputs.push(this.acc);
          this.bus = { addr: null, data: this.acc, ctrl: '输出' };
          text = `执行：输出灯 ← ACC = ${this.acc}（二进制 ${this.acc.toString(2).padStart(4, '0')}）`;
          detail = '输出寄存器接 4 只指示灯，把二进制数直接显示出来。';
          break;
        case 'HLT':
          this.halted = true;
          this.bus = { addr: null, data: null, ctrl: '停机' };
          text = '执行：HLT，时钟停止';
          detail = '程序结束。真实计算机停机后会等待中断，这里就此打住。';
          break;
        default:
          break;
      }
    }
    return { phase: 'execute', tag: 'exec', text, detail };
  }
}
