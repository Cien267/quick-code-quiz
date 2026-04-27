export type Difficulty = "easy" | "medium" | "hard";

export type InterviewQuestion = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  difficulty: Difficulty;
};
