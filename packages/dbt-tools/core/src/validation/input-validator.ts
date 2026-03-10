/**
 * InputValidator provides validation functions to harden inputs against
 * common agent hallucinations and security issues.
 */
export class InputValidator {
  /**
   * Validate that a path does not contain traversal sequences
   * Rejects paths like ../../.ssh or ..\\..\\etc
   */
  static validateSafePath(path: string): void {
    if (!path || typeof path !== "string") {
      throw new Error("Path must be a non-empty string");
    }

    // Check for path traversal patterns
    const normalized = path.replace(/\\/g, "/");
    if (
      normalized.includes("../") ||
      normalized.includes("..\\") ||
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      normalized.includes("\\..\\")
    ) {
      throw new Error(
        `Path traversal detected in path: ${path}. Paths must not contain ../ or ..\\`,
      );
    }

    // Check for absolute paths that might escape (optional - may want to allow)
    // This is commented out as absolute paths might be valid in some contexts
    // if (path.isAbsolute && path.isAbsolute(path)) {
    //   throw new Error(`Absolute paths not allowed: ${path}`);
    // }
  }

  /**
   * Validate that input does not contain control characters
   * Allows \n (0x0A), \r (0x0D), and \t (0x09)
   */
  static validateNoControlChars(input: string): void {
    if (!input || typeof input !== "string") {
      return; // Empty or non-string is fine
    }

    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      // Reject control characters (< 0x20) except \n, \r, \t
      if (
        charCode < 0x20 &&
        charCode !== 0x09 &&
        charCode !== 0x0a &&
        charCode !== 0x0d
      ) {
        throw new Error(
          `Control character detected at position ${i}: U+${charCode.toString(16).padStart(4, "0")}`,
        );
      }
    }
  }

  /**
   * Validate a dbt resource ID
   * Rejects embedded query params, URL fragments, and pre-encoded strings
   */
  static validateResourceId(id: string): void {
    if (!id || typeof id !== "string") {
      throw new Error("Resource ID must be a non-empty string");
    }

    // Reject embedded query params
    if (id.includes("?") || id.includes("#")) {
      throw new Error(`Resource ID contains invalid characters (?, #): ${id}`);
    }

    // Reject pre-encoded URLs (agents sometimes double-encode)
    if (id.includes("%")) {
      throw new Error(
        `Resource ID appears to be URL-encoded: ${id}. Use the actual resource ID, not an encoded version.`,
      );
    }

    // Validate no control characters
    this.validateNoControlChars(id);
  }

  /**
   * Validate that input does not contain pre-encoded URL strings
   * Rejects strings like %2e%2e (encoded ..)
   */
  static validateNoPreEncoding(input: string): void {
    if (!input || typeof input !== "string") {
      return;
    }

    // Check for URL encoding patterns
    if (input.includes("%")) {
      // Check for common encoded traversal patterns
      const lowerInput = input.toLowerCase();
      if (
        lowerInput.includes("%2e%2e") ||
        lowerInput.includes("%2e%2e%2f") ||
        lowerInput.includes("%2e%2e%5c")
      ) {
        throw new Error(
          `Pre-encoded path traversal detected: ${input}. Use the actual path, not an encoded version.`,
        );
      }
    }
  }

  /**
   * Validate a general string input (combines multiple validations)
   */
  static validateString(input: string, allowEmpty = false): void {
    if (
      !allowEmpty &&
      (!input || typeof input !== "string" || input.trim().length === 0)
    ) {
      throw new Error("Input must be a non-empty string");
    }

    if (input) {
      this.validateNoControlChars(input);
      this.validateNoPreEncoding(input);
    }
  }
}
