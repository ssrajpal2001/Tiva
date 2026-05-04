import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import tutorRouter from "./tutor";
import progressRouter from "./progress";
import openaiRouter from "./openai/index";
import transcribeRouter from "./transcribe";
import callRouter from "./call";
import testsRouter from "./tests";
import coinsRouter from "./coins";
import teacherRouter from "./teacher";
import schoolRouter from "./school";
import adminRouter from "./admin";
import referralRouter from "./referral";
import adminPanelRouter from "./adminPanel";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(tutorRouter);
router.use(progressRouter);
router.use(openaiRouter);
router.use(transcribeRouter);
router.use(callRouter);
router.use(testsRouter);
router.use(coinsRouter);
router.use(teacherRouter);
router.use(schoolRouter);
router.use(adminRouter);
router.use(referralRouter);
router.use(adminPanelRouter);

export default router;
