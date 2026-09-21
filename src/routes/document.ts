import { Router } from 'express';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { getDocumentById, getDocumentsByUser, getStatistics, uploadDocument } from '../controllers/documentController';

const router = Router();

router.use(authMiddleware);

router.post('/', upload.single('document'), uploadDocument);
router.get('/:id', authMiddleware, getDocumentById);
router.get('/user', authMiddleware, getDocumentsByUser);
router.get('/statistics', authMiddleware, getStatistics);

export default router;