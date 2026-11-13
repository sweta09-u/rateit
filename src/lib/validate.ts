import { LIMITS, USERNAME_RE } from './constants'
import type { Category } from './types'

export type Errors = Record<string, string>

export function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase()
  if (!username) return 'Choose a username.'
  if (username.length < LIMITS.usernameMin)
    return `Usernames need at least ${LIMITS.usernameMin} characters.`
  if (username.length > LIMITS.usernameMax)
    return `Usernames can be at most ${LIMITS.usernameMax} characters.`
  if (!USERNAME_RE.test(username))
    return 'Use only lowercase letters, numbers and underscores.'
  return null
}

export function validateEmail(raw: string): string | null {
  const email = raw.trim()
  if (!email) return 'Enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That email address looks incomplete.'
  return null
}

export function validatePassword(raw: string): string | null {
  if (!raw) return 'Choose a password.'
  if (raw.length < LIMITS.passwordMin)
    return `Passwords need at least ${LIMITS.passwordMin} characters.`
  return null
}

export interface PostInput {
  title: string
  body: string
  category: Category
  link_url?: string
  image_url?: string
}

export function validatePost(input: PostInput): Errors {
  const errors: Errors = {}

  const title = input.title.trim()
  if (title.length < LIMITS.titleMin)
    errors.title = `Give it a title of at least ${LIMITS.titleMin} characters.`
  else if (title.length > LIMITS.titleMax)
    errors.title = `Titles can be at most ${LIMITS.titleMax} characters.`

  const body = input.body.trim()
  if (body.length < LIMITS.bodyMin) errors.body = 'Write something in the body.'
  else if (body.length > LIMITS.bodyMax)
    errors.body = `Posts can be at most ${LIMITS.bodyMax} characters.`

  if (!input.category) errors.category = 'Pick a category.'

  for (const [key, value] of [
    ['link_url', input.link_url],
    ['image_url', input.image_url],
  ] as const) {
    const url = value?.trim()
    if (url && !/^https?:\/\/[^\s]+$/.test(url)) {
      errors[key] = 'Links must start with http:// or https://'
    }
  }

  return errors
}

export function validateComment(body: string): string | null {
  const clean = body.trim()
  if (!clean) return 'Write a comment first.'
  if (clean.length > LIMITS.commentMax)
    return `Comments can be at most ${LIMITS.commentMax} characters.`
  return null
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0
}
