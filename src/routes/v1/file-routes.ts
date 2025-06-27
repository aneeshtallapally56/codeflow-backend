import { Router } from "express";
import auth from "../../middlewares/auth";
import {
  createFile,
  getFilesByProject,
  updateFileContent,
} from "../../controllers/file-controller"

const router = Router();

router.post("/", auth, createFile);
router.get("/", auth, getFilesByProject);
router.put("/", auth, updateFileContent);

export default router;