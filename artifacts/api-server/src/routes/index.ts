import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import entriesRouter from "./entries";
import qualityRouter from "./quality";
import analysisRouter from "./analysis";
import resourcesRouter from "./resources";
import competitorsRouter from "./competitors";
import nichesRouter from "./niches";
import titlesRouter from "./titles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(entriesRouter);
router.use(qualityRouter);
router.use(analysisRouter);
router.use(resourcesRouter);
router.use(competitorsRouter);
router.use(nichesRouter);
router.use(titlesRouter);

export default router;
