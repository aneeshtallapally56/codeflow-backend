import uuid4 from "uuid4";
import path from "path";
import fs from "fs/promises";
import directoryTree from "directory-tree";
import { execPromise } from "../utils/exec-utility";
type Framework = "React" | "NextJs" | "Angular" | "Vue";


export const createProjectService = async (type: string) => {
  const framework = type;
  const projectId = uuid4();
  const projectPath = path.join(process.cwd(), "generated-projects", projectId);
  await fs.mkdir(projectPath, { recursive: true });

  let command = "";

  switch (framework) {
    case "React":
      command = process.env.REACT_PROJECT_COMMAND!;
      break;

    case "Vue":
      command = process.env.VUE_PROJECT_COMMAND!;
      break;
    case "NextJs":
      command = process.env.NEXT_PROJECT_COMMAND!;
      break;
    case "Angular":
      command = process.env.ANGULAR_PROJECT_COMMAND!;
      break;
    default:
      throw new Error(`Unsupported framework type: ${framework}`);
  }

  console.log("🚀 Running command:", command);
  console.log("📁 Target folder:", projectPath);

  try {
    await execPromise(command, { cwd: projectPath });
  } catch (err: any) {
    console.error("❌ Error running command:");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("Command Output:", err.stdout || err.stderr || err.output);
    throw err;
  }

  return projectId;
};

export const getProjectTree = async (projectId: string) => {
  const projectPath = path.resolve(process.cwd(), "generated-projects", projectId);
  const projectTree = directoryTree(projectPath);
    return projectTree;

}
export const deleteProjectService  = async (projectId: string) => {
  const projectPath = path.join(process.cwd(), "generated-projects", projectId);

   if (!(await fs.stat(projectPath).catch(() => false))) {
  console.warn("Project folder not found:", projectPath);
  return;
   }
   await fs.rm(projectPath, { recursive: true, force: true });
}

