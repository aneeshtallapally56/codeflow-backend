import { Router } from "express";
import auth from "../../middlewares/auth";
import {
  createFile,
  getFilesByProject,
  updateFileContent,
} from "../../controllers/file-controller"

const router = Router();

router.post("/files", auth, createFile);
router.get("/files/:projectId", auth, getFilesByProject);
router.put("/files/:fileId", auth, updateFileContent);

export default router;