import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import tutorRouter from "./tutor";
import progressRouter from "./progress";
import openaiRouter from "./openai/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(tutorRouter);
router.use(progressRouter);
router.use(openaiRouter);

export default router;
