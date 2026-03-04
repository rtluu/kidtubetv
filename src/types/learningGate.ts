export type GateFrequency = 'every' | 'every-n' | 'session';
export type QuestionType =
  | 'counting'
  | 'color'
  | 'shape'
  | 'picture-math'
  | 'math'
  | 'spelling'
  | 'knowledge'
  | 'reading';

export interface Question {
  type: QuestionType;
  prompt: string;
  visual?: string;
  options: string[];
  correctIndex: number;
}

export interface GateConfig {
  learningGateEnabled: boolean;
  gateFrequency: GateFrequency;
  videosPerGate: number;
}
