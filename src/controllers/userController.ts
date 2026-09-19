import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export const getAllUsers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const users = await UserService.getAllUsers();
    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    throw new AppError('Failed to fetch users', 500);
  }
};

export const getUserById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const user = await UserService.getUserById(id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    throw error instanceof Error ? new AppError(error.message, 404) : new AppError('User not found', 404);
  }
};

export const createUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }

    const user = await UserService.createUser({
      name,
      email,
      password
    });

    return res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    throw error instanceof Error ? new AppError(error.message, 400) : new AppError('Failed to create user', 400);
  }
};

export const updateUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const userData = req.body;

    const user = await UserService.updateUser(id, userData);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    throw error instanceof Error ? new AppError(error.message, 404) : new AppError('Failed to update user', 404);
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const deleted = await UserService.deleteUser(id);

    if (!deleted) {
      throw new AppError('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    throw error instanceof Error ? new AppError(error.message, 404) : new AppError('Failed to delete user', 404);
  }
};

export const loginUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    throw error instanceof Error ? new AppError(error.message, 400) : new AppError('Login failed', 400);
  }
};