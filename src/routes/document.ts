import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadDocument } from '../controllers/documentController';

const router = Router();

router.use(authMiddleware);

router.post('/', upload.single('document'), uploadDocument);

export default router;