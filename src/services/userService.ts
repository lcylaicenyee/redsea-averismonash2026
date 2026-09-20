import { IUser } from '../models/User';
import User from '../models/User';

export class UserService {
  static async getAllUsers(): Promise<IUser[]> {
    return User.find().select('-password').sort({ createdAt: -1 });
  }

  static async getUserById(id: string): Promise<IUser | null> {
    return User.findById(id).select('-password');
  }

  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
  }): Promise<IUser> {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = await User.create(userData);
    return user;
  }

  static async updateUser(
    id: string,
    userData: {
      name?: string;
      email?: string;
      password?: string;
    }
  ): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      id,
      userData,
      { new: true, runValidators: true }
    ).select('-password');

    return user || null;
  }

  static async deleteUser(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return result !== null;
  }

  static async activateUser(id: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { isActive: true }, { new: true }).select('-password');
  }

  static async deactivateUser(id: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-password');
  }
}