import { describe, it, expect } from 'vitest'
import { getCurrentUserId } from '../auth'

describe('getCurrentUserId', () => {
  it('should return the demo user ID', () => {
    expect(getCurrentUserId()).toBe('user_demo')
  })
})
