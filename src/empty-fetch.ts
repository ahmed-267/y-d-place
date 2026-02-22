// This file provides a mock implementation of fetch to avoid errors.

// Mock fetch function that throws an error when called.
export default function fetch() {
  throw new Error('fetch is not supported in this environment.');
}