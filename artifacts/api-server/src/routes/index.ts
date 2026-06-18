import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import entriesRouter from "./entries";
import qualityRouter from "./quality";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(entriesRouter);
router.use(qualityRouter);

export default router;
