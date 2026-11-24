export type Difficulty = "easy" | "normal" | "hard" | "expert";
export type Topic = "basic" | "expected" | "variance" | "binomial" | "poisson" | "normal" | "uniform";

export interface Question {
  id: string;
  topic: Topic;
  kind: string;            // template kind, used by the validator to recompute
  params: Record<string, number>;
  difficulty: Difficulty;
  text: string;            // Thai problem statement
  choices: string[];       // exactly 4 formatted strings
  correctIndex: number;
  answer: number;          // numeric truth (unrounded to display precision)
  decimals: number;        // display precision of choices
  solution: string[];      // worked steps (Thai)
  hints: string[];         // progressive hints
  source: "template" | "ai";
  approved: boolean;       // admin must approve before publishing
}
