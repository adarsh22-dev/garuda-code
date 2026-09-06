import { bashTool } from "./bash.js";
import { readFileTool, writeFileTool, editFileTool, listDirTool } from "./fileOps.js";
import { globTool, grepTool } from "./search.js";
import { gitTool } from "./git.js";
import { lintTool, typecheckTool, complexityTool, deadcodeTool, dependencyTool } from "./analysis.js";
import { threejsAuditTool, shaderAuditTool, reactAuditTool, fastapiAuditTool, perfBudgetTool, a11yAuditTool } from "./frontend3d.js";
import { codeReviewTool, systemDesignTool, algoAnalysisTool, interviewPrepTool } from "./sdejob.js";
export const ALL_TOOLS = [
    readFileTool,
    writeFileTool,
    editFileTool,
    listDirTool,
    globTool,
    grepTool,
    gitTool,
    bashTool,
    lintTool,
    typecheckTool,
    complexityTool,
    deadcodeTool,
    dependencyTool,
    threejsAuditTool,
    shaderAuditTool,
    reactAuditTool,
    fastapiAuditTool,
    perfBudgetTool,
    a11yAuditTool,
    codeReviewTool,
    systemDesignTool,
    algoAnalysisTool,
    interviewPrepTool,
];
export function getToolByName(name) {
    return ALL_TOOLS.find((t) => t.definition.name === name);
}
export * from "./types.js";
