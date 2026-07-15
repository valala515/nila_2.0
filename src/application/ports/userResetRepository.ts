export interface UserResetRepository {
  deleteAllUserData(userId: string): Promise<void>;
}
