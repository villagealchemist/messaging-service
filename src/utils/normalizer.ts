/**
 * Utilities for normalizing phone numbers and email addresses
 * to enable consistent conversation matching
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import validator from 'validator';
import { logger } from './logger';

/**
 * Normalizes a phone number to E.164 format using libphonenumber-js
 * Defaults to US region if no country code is provided
 *
 * Examples:
 * - "+1 (234) 567-8900" => "+12345678900"
 * - "(234) 567-8900" => "+12345678900"
 * - "2345678900" => "+12345678900"
 * - "+44 20 7946 0958" => "+442079460958"
 *
 * @param phone - The phone number to normalize
 * @returns E.164 formatted phone number
 * @throws Error if phone number is invalid
 */
export function normalizePhoneNumber(phone: string): string {
  try {
    let phoneNumber = parsePhoneNumberFromString(phone, 'US');

    // If parsing failed, try prefixing with +1 for US numbers
    if (!phoneNumber || !phoneNumber.isValid()) {
      const withCountryCode = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      phoneNumber = parsePhoneNumberFromString(withCountryCode, 'US');
    }

    if (!phoneNumber || !phoneNumber.isValid()) {
      throw new Error(`Invalid phone number: ${phone}`);
    }

    // Return E.164 format
    return phoneNumber.format('E.164');
  } catch (error) {
    logger.warn('Failed to normalize phone number', { phone, error });
    throw new Error(`Failed to normalize phone number: ${phone}`);
  }
}

/**
 * Normalizes an email address to lowercase and strips Gmail aliases
 * Gmail ignores dots in the local part and everything after +
 *
 * Examples:
 * - "User.Name+tag@Gmail.COM" => "username@gmail.com"
 * - "test.user+spam@gmail.com" => "testuser@gmail.com"
 * - "User@Example.COM" => "scooby"
 * - "test@googlemail.com" => "test@gmail.com"
 *
 * @param email - The email address to normalize
 * @returns Normalized email address
 * @throws Error if email is invalid
 */
export function normalizeEmail(email: string): string {
  try {
    const trimmed = email.trim().toLowerCase();

    // Validate email format
    if (!validator.isEmail(trimmed)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    const [localPart, domain] = trimmed.split('@');

    // Strip Gmail aliases (dots and plus addressing)
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      // Remove all dots from local part
      let cleanedLocal = localPart.replace(/\./g, '');

      // Remove everything after + (plus addressing)
      const plusIndex = cleanedLocal.indexOf('+');
      if (plusIndex !== -1) {
        cleanedLocal = cleanedLocal.substring(0, plusIndex);
      }

      return `${cleanedLocal}@gmail.com`;
    }

    return trimmed;
  } catch (error) {
    logger.warn('Failed to normalize email', { email, error });
    throw new Error(`Failed to normalize email: ${email}`);
  }
}

/**
 * Determines if a string is a phone number or email and normalizes accordingly
 * Uses @ as the heuristic to distinguish between email and phone number
 *
 * Examples:
 * - "user@example.com" => "user@example.com" (via normalizeEmail)
 * - "+1-234-567-8900" => "+12345678900" (via normalizePhoneNumber)
 * - "2345678900" => "+12345678900" (via normalizePhoneNumber)
 *
 * @param contact - The contact identifier (email or phone)
 * @returns Normalized contact
 * @throws Error if contact is neither a valid phone number nor email
 */
export function normalizeContact(contact: string): string {
  const trimmed = contact.trim();

  // Simple heuristic: if it contains @, treat as email
  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed);
  }

  return normalizePhoneNumber(trimmed);
}

/**
 * Creates a normalized, sorted participant key for conversation matching
 * This ensures that messages between A<->B create the same conversation
 * regardless of direction
 *
 * Examples:
 * - ("+12345678900", "+19876543210") => '["+12345678900","+19876543210"]'
 * - ("+19876543210", "+12345678900") => '["+12345678900","+19876543210"]' (same!)
 * - ("alice@example.com", "bob@example.com") => '["alice@example.com","bob@example.com"]'
 *
 * @param participant1 - First participant identifier
 * @param participant2 - Second participant identifier
 * @returns JSON stringified, sorted array of normalized participants
 * @throws Error if either participant is invalid
 */
export function createParticipantKey(participant1: string, participant2: string): string {
  const normalized = [
    normalizeContact(participant1),
    normalizeContact(participant2),
  ].sort();

  return JSON.stringify(normalized);
}
