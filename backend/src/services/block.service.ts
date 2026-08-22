import { User } from '../models/User.model'

/** True if either user has blocked the other. */
export const isBlockedEitherWay = async (userAId: string, userBId: string): Promise<boolean> => {
  const [a, b] = await Promise.all([
    User.findById(userAId).select('blockedUsers'),
    User.findById(userBId).select('blockedUsers'),
  ])
  const aBlockedB = a?.blockedUsers?.some((id) => id.toString() === userBId) ?? false
  const bBlockedA = b?.blockedUsers?.some((id) => id.toString() === userAId) ?? false
  return aBlockedB || bBlockedA
}
