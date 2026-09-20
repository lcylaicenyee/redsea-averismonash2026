import { NextFunction, Router, Request, Response } from 'express';
import { validateUser } from '../validators/user';
import * as userController from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', userController.loginUser);

// Protected routes
router.use(authMiddleware);

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

// Admin routes
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
});

export default router;