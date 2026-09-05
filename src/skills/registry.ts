export interface Skill {
  id: string;
  description: string;
}

export const BUILTIN_SKILLS: Skill[] = [
  { id: "debug", description: "Trace a failure, isolate its cause, and verify the fix." },
  { id: "review", description: "Review changes for correctness, regressions, and missing tests." },
  { id: "security", description: "Inspect code for common security and secret-handling risks." },
  { id: "performance", description: "Find hot paths, unnecessary work, and resource leaks." },
  { id: "refactor", description: "Improve structure while preserving behavior and public APIs." },
  { id: "test", description: "Design focused tests for the behavior being changed." },
  { id: "document", description: "Write concise project and API documentation from the code." },
];