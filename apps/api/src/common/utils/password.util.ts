import * as argon2 from 'argon2';
export class PasswordService {
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
  static async verifyPassword(hashed: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
