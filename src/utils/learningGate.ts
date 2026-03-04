import { Question, QuestionType } from '@src/types/learningGate';
import {
  spelling78, knowledge78, reading78,
  spelling910, knowledge910, reading910,
  spelling1112, knowledge1112, reading1112,
} from '@src/data/questions';

// ── Helpers ──────────────────────────────────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFromBank(bank: Question[]): Question {
  return pickRandom(bank);
}

// ── Young-kid generation (age 3–6) ───────────────────────────────────

const COUNTING_EMOJIS = ['🍎', '⭐', '🐶', '🌸', '🎈', '🍩', '🐸', '🚗', '🌙', '🎀'];
const COLORS = [
  { name: 'Red', hex: '#FF3131' },
  { name: 'Blue', hex: '#00A3FF' },
  { name: 'Green', hex: '#32D74B' },
  { name: 'Yellow', hex: '#FFD60A' },
  { name: 'Orange', hex: '#FF9500' },
  { name: 'Purple', hex: '#BF5AF2' },
  { name: 'Pink', hex: '#FF375F' },
];
const SHAPES = ['Triangle', 'Circle', 'Square', 'Rectangle', 'Star', 'Heart', 'Diamond', 'Oval'];
const SHAPE_SIDES: Record<string, number> = {
  Triangle: 3, Square: 4, Rectangle: 4, Star: 5, Diamond: 4, Oval: 0, Circle: 0, Heart: 0,
};

function generateCounting(maxCount: number): Question {
  const emoji = pickRandom(COUNTING_EMOJIS);
  const n = Math.floor(Math.random() * maxCount) + 1;
  const visual = Array(n).fill(emoji).join('');
  const opts = shuffle([
    String(Math.max(1, n - 1)),
    String(n),
    String(n + 1),
  ]);
  const correctIndex = opts.indexOf(String(n));
  return {
    type: 'counting',
    prompt: `How many ${emoji} do you see?`,
    visual,
    options: opts,
    correctIndex,
  };
}

function generateColor(): Question {
  const correct = pickRandom(COLORS);
  let distractors = COLORS.filter((c) => c.name !== correct.name);
  distractors = shuffle(distractors).slice(0, 2);
  const opts = shuffle([correct, ...distractors]);
  const correctIndex = opts.indexOf(correct);
  return {
    type: 'color',
    prompt: 'What color is this?',
    visual: correct.hex, // used by the component to render a colored circle
    options: opts.map((c) => c.name),
    correctIndex,
  };
}

function generateShape(): Question {
  const targetSides = pickRandom([3, 4]);
  const correct = targetSides === 3 ? 'Triangle' : pickRandom(['Square', 'Rectangle']);
  const distractors = shuffle(
    SHAPES.filter((s) => s !== correct && SHAPE_SIDES[s] !== targetSides)
  ).slice(0, 2);
  const opts = shuffle([correct, ...distractors]);
  const correctIndex = opts.indexOf(correct);
  return {
    type: 'shape',
    prompt: `Which shape has ${targetSides} sides?`,
    options: opts,
    correctIndex,
  };
}

function generatePictureMath(maxNum: number): Question {
  const emoji = pickRandom(COUNTING_EMOJIS);
  const a = Math.floor(Math.random() * Math.min(maxNum, 5)) + 1;
  const b = Math.floor(Math.random() * Math.min(maxNum - a + 1, 4)) + 1;
  const sum = a + b;
  const visual = `${Array(a).fill(emoji).join('')} + ${Array(b).fill(emoji).join('')}`;
  const rawOpts = [sum - 1, sum, sum + 1].filter((v) => v > 0);
  // Ensure uniqueness and add extra if needed
  const unique = [...new Set(rawOpts)];
  const opts = unique.map(String);
  const correctIndex = opts.indexOf(String(sum));
  return {
    type: 'picture-math',
    prompt: `${Array(a).fill(emoji).join('')} + ${Array(b).fill(emoji).join('')} = ?`,
    visual,
    options: opts,
    correctIndex,
  };
}

// ── Older-kid generation (age 7+) ────────────────────────────────────

function generateMath78(): Question {
  const isAdd = Math.random() > 0.4;
  if (isAdd) {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const sum = a + b;
    const opts = shuffle([String(sum - 1), String(sum), String(sum + 1), String(sum + 2)]).slice(0, 4);
    if (!opts.includes(String(sum))) opts[0] = String(sum);
    const correctIndex = opts.indexOf(String(sum));
    return { type: 'math', prompt: `What is ${a} + ${b}?`, options: opts, correctIndex };
  } else {
    const b = Math.floor(Math.random() * 8) + 1;
    const a = b + Math.floor(Math.random() * 10) + 1;
    const diff = a - b;
    const opts = shuffle([String(diff - 1), String(diff), String(diff + 1), String(diff + 2)]).slice(0, 4);
    if (!opts.includes(String(diff))) opts[0] = String(diff);
    const correctIndex = opts.indexOf(String(diff));
    return { type: 'math', prompt: `What is ${a} − ${b}?`, options: opts, correctIndex };
  }
}

function generateMath910(): Question {
  const a = Math.floor(Math.random() * 10) + 2;
  const b = Math.floor(Math.random() * 10) + 2;
  const product = a * b;
  const wrong1 = product + a;
  const wrong2 = product - b;
  const wrong3 = (a + 1) * b;
  const opts = shuffle([String(product), String(wrong1), String(wrong2), String(wrong3)]);
  const correctIndex = opts.indexOf(String(product));
  return { type: 'math', prompt: `What is ${a} × ${b}?`, options: opts, correctIndex };
}

function generateMath1112(): Question {
  const type = pickRandom(['division', 'fraction'] as const);
  if (type === 'division') {
    const b = Math.floor(Math.random() * 8) + 2;
    const q = Math.floor(Math.random() * 8) + 2;
    const a = b * q;
    const opts = shuffle([String(q), String(q + 1), String(q - 1), String(q + 2)]);
    const correctIndex = opts.indexOf(String(q));
    return { type: 'math', prompt: `What is ${a} ÷ ${b}?`, options: opts, correctIndex };
  } else {
    const denom = pickRandom([2, 4, 5, 10]);
    const numer = Math.floor(Math.random() * (denom - 1)) + 1;
    const pct = Math.round((numer / denom) * 100);
    const opts = shuffle([String(pct) + '%', String(pct + 10) + '%', String(pct - 10) + '%', String(pct + 5) + '%']);
    const correctIndex = opts.indexOf(String(pct) + '%');
    return {
      type: 'math',
      prompt: `What is ${numer}/${denom} as a percentage?`,
      options: opts,
      correctIndex,
    };
  }
}

// ── Main export ───────────────────────────────────────────────────────

export function generateQuestion(childAge: number): Question {
  if (childAge <= 6) {
    // Young kid — algorithmic generation
    const maxCount = childAge <= 5 ? 5 : 9;
    const types: QuestionType[] = ['counting', 'color', 'shape', 'picture-math'];
    const type = pickRandom(types);
    switch (type) {
      case 'counting':     return generateCounting(maxCount);
      case 'color':        return generateColor();
      case 'shape':        return generateShape();
      case 'picture-math': return generatePictureMath(maxCount);
      default:             return generateCounting(maxCount);
    }
  }

  // Older kid — static bank + generated math
  if (childAge <= 8) {
    const types: Array<'math' | 'spelling' | 'knowledge' | 'reading'> = [
      'math', 'math', 'spelling', 'knowledge', 'reading',
    ];
    const type = pickRandom(types);
    if (type === 'math') return generateMath78();
    if (type === 'spelling') return pickFromBank(spelling78);
    if (type === 'knowledge') return pickFromBank(knowledge78);
    return pickFromBank(reading78);
  }

  if (childAge <= 10) {
    const types: Array<'math' | 'spelling' | 'knowledge' | 'reading'> = [
      'math', 'math', 'spelling', 'knowledge', 'reading',
    ];
    const type = pickRandom(types);
    if (type === 'math') return generateMath910();
    if (type === 'spelling') return pickFromBank(spelling910);
    if (type === 'knowledge') return pickFromBank(knowledge910);
    return pickFromBank(reading910);
  }

  // Age 11–12
  const types: Array<'math' | 'spelling' | 'knowledge' | 'reading'> = [
    'math', 'spelling', 'knowledge', 'reading',
  ];
  const type = pickRandom(types);
  if (type === 'math') return generateMath1112();
  if (type === 'spelling') return pickFromBank(spelling1112);
  if (type === 'knowledge') return pickFromBank(knowledge1112);
  return pickFromBank(reading1112);
}
