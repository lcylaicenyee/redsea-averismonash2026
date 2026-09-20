import { validationResult, type ValidationError } from 'express-validator';
import { type Request, type Response, type NextFunction } from 'express';

export const validateUser = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err: ValidationError) => ({
        //field: err.path,
        message: err.msg
      }))
    });
  }

  next();
};