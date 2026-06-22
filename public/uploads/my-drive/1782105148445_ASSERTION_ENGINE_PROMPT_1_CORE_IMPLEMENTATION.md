# ASSERTION ENGINE - DEVELOPMENT PROMPT #1
## Core Implementation (Types, Parser, Base Methods)

**Copy this entire prompt and paste into Claude or your preferred AI**

---

## SYSTEM PROMPT

```
You are an expert TypeScript developer with 10+ years of experience in 
test automation, web testing, and quality assurance frameworks.

You have deep knowledge of:
- Playwright browser automation
- Natural Language Processing (NLP)
- Test assertion frameworks
- Error handling and debugging

Your code is production-grade, fully documented, type-safe, and thoroughly tested.
You follow best practices: error handling, logging, modularity, and performance.
```

---

## PROJECT CONTEXT

We are building **AutoQA**, an intelligent QA automation platform.

Users write tests in plain English:
```
Step: Click login button
Expected: "should navigate to dashboard"
```

The platform needs to **verify expected results intelligently** without brittle selectors.

This is **PROMPT #1: Core Implementation**

After this, there will be **PROMPT #2: Advanced Methods + Integration**

---

## REQUIREMENTS SUMMARY

### What to Build (Prompt #1)

```
1. Type Definitions
   └─ All TypeScript interfaces for assertion engine

2. Expected Result Types
   ├─ NavigationExpectation
   ├─ ElementVisibilityExpectation
   ├─ TextContentExpectation
   ├─ URLExpectation
   ├─ ElementCountExpectation
   ├─ NoErrorExpectation
   └─ StateExpectation

3. NLP Parser
   ├─ Parse natural language expected results
   ├─ Detect expectation type
   ├─ Extract parameters
   └─ Handle edge cases

4. Core AssertionEngine Class
   ├─ Main entry point
   ├─ parseExpectation() method
   ├─ Skeleton for verification methods
   └─ Error handling

5. Comprehensive Tests
   ├─ Unit tests for parser
   ├─ Unit tests for type validation
   ├─ Edge case handling
   └─ >80% code coverage
```

---

## DETAILED SPECIFICATIONS

### 1. TYPE DEFINITIONS

Create `/src/types/index.ts` with these interfaces:

```typescript
// Base types
interface Expectation {
  type: ExpectationType;
  raw: string;  // Original user input
}

type ExpectationType = 
  | 'navigate'
  | 'element-visible'
  | 'element-hidden'
  | 'text-visible'
  | 'text-not-visible'
  | 'url-contains'
  | 'url-equals'
  | 'element-count'
  | 'no-error'
  | 'element-state'
  | 'unknown';

// Specific expectation types
interface NavigationExpectation extends Expectation {
  type: 'navigate';
  destination: string;           // "dashboard", "/dashboard", "user/settings"
  method?: 'url' | 'title' | 'content' | 'all';
}

interface ElementVisibilityExpectation extends Expectation {
  type: 'element-visible' | 'element-hidden';
  target: string;                // What to find
  text?: string;                 // Optional: specific text
  partial?: boolean;             // Partial text match
  timeout?: number;              // Wait time
}

interface TextContentExpectation extends Expectation {
  type: 'text-visible' | 'text-not-visible';
  text: string;                  // Text to find
  exact?: boolean;               // Exact match vs fuzzy
  location?: 'body' | 'error' | 'success' | 'notification' | 'any';
}

interface URLExpectation extends Expectation {
  type: 'url-contains' | 'url-equals';
  pattern: string;               // "/dashboard", "user/123"
  exact?: boolean;               // Exact vs contains
  useRegex?: boolean;            // Pattern is regex
}

interface ElementCountExpectation extends Expectation {
  type: 'element-count';
  target: string;                // What elements to count
  count?: number;                // Exact count
  min?: number;                  // Minimum
  max?: number;                  // Maximum
}

interface NoErrorExpectation extends Expectation {
  type: 'no-error';
  method?: 'visual' | 'console' | 'network' | 'all';
}

interface StateExpectation extends Expectation {
  type: 'element-state';
  target: string;
  state: 'enabled' | 'disabled' | 'required' | 'checked' | 'visible';
  value?: boolean;
}

// Verification result
interface VerificationResult {
  success: boolean;
  expectationType: ExpectationType;
  expectedResult: string;
  actualResult: string;
  method: string;
  reasoning: string[];
  confidence?: number;           // 0-100
  failure?: {
    reason: string;
    suggestion: string;
    evidence: any[];
  };
  duration: number;
  timestamp: Date;
}

// Root cause analysis
interface RootCauseAnalysis {
  expectation: string;
  error?: string;
  likelyReasons: Array<{
    reason: string;
    probability: 'high' | 'medium' | 'low';
    suggestions: string[];
  }>;
  debugInfo: Record<string, any>;
}

// Configuration
interface AssertionEngineConfig {
  confidenceThreshold?: number;       // Default: 80
  fallbackThreshold?: number;         // Default: 60
  timeout?: number;                   // Default: 5000ms
  enableLogging?: boolean;            // Default: false
  logLevel?: 'debug' | 'info' | 'error';
  debug?: boolean;
}

// Parser result
interface ParseResult {
  type: ExpectationType;
  parsed: Expectation;
  error?: string;
  confidence: number;  // How sure we are about the parse
}
```

**Acceptance Criteria:**
- ✓ All types compile with TypeScript strict mode
- ✓ Clear, documented interfaces
- ✓ Covers all 7 expectation types
- ✓ Extensible for future types

---

### 2. SEMANTIC DICTIONARY

Create `/src/data/semanticDictionary.ts`:

```typescript
interface SemanticKeyword {
  primary: string[];           // Main keywords
  synonyms: string[];          // Variations
  antonyms?: string[];         // Opposite meanings
  weight: number;              // Importance (0-100)
  elementTypes?: string[];     // Associated element types
  context?: string[];          // Related contexts
}

export const SEMANTIC_DICTIONARY: Record<string, SemanticKeyword> = {
  // Navigation keywords
  'navigate': {
    primary: ['navigate', 'go', 'redirect', 'take'],
    synonyms: ['move to', 'navigate to', 'send to', 'go to'],
    weight: 95,
    elementTypes: ['button', 'a', 'link'],
    context: ['page', 'url', 'location'],
  },
  'dashboard': {
    primary: ['dashboard', 'home', 'main'],
    synonyms: ['homepage', 'home page', 'main page', 'overview'],
    weight: 90,
    context: ['navigate', 'page'],
  },

  // Element keywords
  'login': {
    primary: ['login', 'signin', 'sign in'],
    synonyms: ['authenticate', 'auth', 'enter', 'submit'],
    weight: 95,
    elementTypes: ['button', 'a', 'input'],
    context: ['auth', 'form', 'button'],
  },
  'email': {
    primary: ['email', 'mail', 'e-mail'],
    synonyms: ['contact', 'address', 'username', '@'],
    weight: 100,
    elementTypes: ['input', 'textbox'],
    context: ['form', 'login', 'signup'],
  },
  'password': {
    primary: ['password', 'pwd', 'pass'],
    synonyms: ['secret', 'credential', 'passphrase'],
    weight: 100,
    elementTypes: ['input', 'password'],
    context: ['auth', 'login', 'form'],
  },

  // Visibility keywords
  'visible': {
    primary: ['see', 'show', 'appear', 'display', 'visible'],
    synonyms: ['appear', 'show up', 'display', 'be shown'],
    weight: 90,
    context: ['element', 'message'],
  },
  'hidden': {
    primary: ['hide', 'hidden', 'disappear', 'gone'],
    synonyms: ['not visible', 'invisible', 'removed'],
    weight: 85,
    context: ['element', 'message'],
  },

  // Text keywords
  'contain': {
    primary: ['contain', 'show', 'display', 'include'],
    synonyms: ['have', 'display', 'show', 'include'],
    weight: 90,
    context: ['text', 'page', 'message'],
  },
  'message': {
    primary: ['message', 'text', 'content'],
    synonyms: ['notification', 'alert', 'info', 'notice'],
    weight: 80,
    context: ['error', 'success', 'warning'],
  },

  // State keywords
  'enabled': {
    primary: ['enabled', 'active', 'clickable'],
    synonyms: ['usable', 'available', 'working'],
    weight: 85,
    context: ['button', 'input', 'state'],
  },
  'disabled': {
    primary: ['disabled', 'inactive', 'grayed'],
    synonyms: ['unavailable', 'blocked', 'inactive'],
    weight: 85,
    context: ['button', 'input', 'state'],
  },

  // Error keywords
  'error': {
    primary: ['error', 'fail', 'failed'],
    synonyms: ['problem', 'issue', 'wrong', 'invalid'],
    weight: 90,
    context: ['message', 'detection'],
  },
  'success': {
    primary: ['success', 'successful', 'passed'],
    synonyms: ['ok', 'good', 'completed', 'done'],
    weight: 85,
    context: ['message', 'status'],
  },

  // Count keywords
  'item': {
    primary: ['item', 'element', 'entry', 'row'],
    synonyms: ['row', 'entry', 'record', 'element'],
    weight: 80,
    context: ['count', 'list'],
  },

  // URL keywords
  'account': {
    primary: ['account', 'profile', 'user'],
    synonyms: ['my account', 'profile', 'settings', 'user profile'],
    weight: 85,
    context: ['page', 'url'],
  },
  'settings': {
    primary: ['settings', 'preferences', 'config'],
    synonyms: ['configuration', 'preferences', 'options'],
    weight: 80,
    context: ['page', 'url'],
  },
};

export function getSynonyms(word: string): string[] {
  const normalized = word.toLowerCase();
  const entry = SEMANTIC_DICTIONARY[normalized];
  if (!entry) return [normalized];
  return [...entry.primary, ...entry.synonyms];
}

export function getWeight(word: string): number {
  const normalized = word.toLowerCase();
  return SEMANTIC_DICTIONARY[normalized]?.weight || 50;
}
```

**Acceptance Criteria:**
- ✓ Covers all common test scenarios
- ✓ Easy to extend with new keywords
- ✓ Weights make sense (100 = most important)
- ✓ Synonyms comprehensive

---

### 3. NLP PARSER

Create `/src/services/expectationParser.ts`:

```typescript
import { ParseResult, Expectation, ExpectationType } from '../types';
import { SEMANTIC_DICTIONARY, getSynonyms } from '../data/semanticDictionary';

export class ExpectationParser {
  /**
   * Parse natural language expected result
   * Returns: { type, parsed, confidence }
   */
  parse(userInput: string): ParseResult {
    const normalized = userInput.toLowerCase().trim();

    // Remove common prefixes
    let text = normalized
      .replace(/^(should|must|will|expected?)\s+/, '')
      .replace(/^(to\s+)?/, '')
      .trim();

    // Try each pattern in order
    if (this.isNavigationPattern(text)) {
      return this.parseNavigation(userInput, text);
    }

    if (this.isElementVisibilityPattern(text)) {
      return this.parseElementVisibility(userInput, text);
    }

    if (this.isTextContentPattern(text)) {
      return this.parseTextContent(userInput, text);
    }

    if (this.isURLPattern(text)) {
      return this.parseURL(userInput, text);
    }

    if (this.isElementCountPattern(text)) {
      return this.parseElementCount(userInput, text);
    }

    if (this.isNoErrorPattern(text)) {
      return this.parseNoError(userInput, text);
    }

    if (this.isStatePattern(text)) {
      return this.parseState(userInput, text);
    }

    // Default: treat as text content
    return {
      type: 'text-visible',
      parsed: {
        type: 'text-visible',
        raw: userInput,
        text: userInput,
        exact: false,
      },
      confidence: 0.5,
    };
  }

  // Pattern detection methods
  private isNavigationPattern(text: string): boolean {
    return /(?:navigate|go|redirect|taken?|move)\s+(?:to\s+)?/.test(text) ||
           /(?:to\s+)?(dashboard|home|account|settings|profile|page)/.test(text);
  }

  private isElementVisibilityPattern(text: string): boolean {
    return /(?:should\s+)?(?:see|show|appear|display|visible)/.test(text) ||
           /(?:should\s+)?not\s+(?:see|show|appear)/.test(text);
  }

  private isTextContentPattern(text: string): boolean {
    return /(?:contain|display|show|include)[\s'"]/.test(text) ||
           /['"](.*?)['"]/.test(text);
  }

  private isURLPattern(text: string): boolean {
    return /(?:url|address|page|location)[\s:]/.test(text) ||
           /\/\w+/.test(text);
  }

  private isElementCountPattern(text: string): boolean {
    return /(?:should\s+)?(?:show|have|display)[\s:]?\d+\s+/.test(text) ||
           /(?:items?|rows?|elements?)[\s:]?\d+/.test(text);
  }

  private isNoErrorPattern(text: string): boolean {
    return /(?:should\s+)?not\s+(?:show|have)\s+error/.test(text) ||
           /(?:no|without)\s+error/.test(text);
  }

  private isStatePattern(text: string): boolean {
    return /(?:should\s+)?(?:be\s+)?(?:enabled|disabled|checked|required)/.test(text);
  }

  // Parsing methods
  private parseNavigation(original: string, text: string): ParseResult {
    // Extract destination
    const match = text.match(
      /(?:navigate|go|redirect|taken?)\s+(?:to\s+)?([^\.]+?)(?:\s+page)?(?:\s+[,\.]|$)/i
    );
    const destination = match ? match[1].trim() : text;

    return {
      type: 'navigate',
      parsed: {
        type: 'navigate',
        raw: original,
        destination: destination.toLowerCase(),
      },
      confidence: 0.95,
    };
  }

  private parseElementVisibility(original: string, text: string): ParseResult {
    const isHidden = /(?:should\s+)?not\s+(?:see|show|appear)/.test(text);
    const type = isHidden ? 'element-hidden' : 'element-visible';

    // Extract element description (what to find)
    const match = text.match(
      /(?:see|show|appear|display)[\s:]?(.+?)(?:\s+[,\.]|$)/i
    );
    const target = match ? match[1].trim() : text;

    // Check for text content
    const textMatch = target.match(/['"](.*?)['"]/) ||
                     target.match(/(?:with|containing|saying)\s+['"]?([^'"]+)['"]?/);
    const expectedText = textMatch ? textMatch[1] : undefined;

    return {
      type,
      parsed: {
        type,
        raw: original,
        target: target.replace(/['"](.*?)['"]/, '').trim(),
        text: expectedText,
        partial: !/(exact|exactly)/.test(text),
      },
      confidence: 0.90,
    };
  }

  private parseTextContent(original: string, text: string): ParseResult {
    const isNegative = /(?:should\s+)?not\s+contain/.test(text);
    const type = isNegative ? 'text-not-visible' : 'text-visible';

    // Extract quoted text or text after "contain"
    const match = text.match(/['"](.*?)['"]/) ||
                 text.match(/contain(?:s)?[\s:]?([^,\.]+)/i);
    const content = match ? match[1].trim() : text;

    return {
      type,
      parsed: {
        type,
        raw: original,
        text: content,
        exact: /exact(?:ly)?/.test(text),
        location: this.extractLocation(text),
      },
      confidence: 0.85,
    };
  }

  private parseURL(original: string, text: string): ParseResult {
    const isEquals = /url\s+(?:should\s+)?(?:be|equals?)/.test(text);
    const type = isEquals ? 'url-equals' : 'url-contains';

    // Extract URL pattern
    const match = text.match(/(?:\/[\w\-\/]*|\w+\/[\w\-\/]*)/);
    const pattern = match ? match[0] : text;

    return {
      type,
      parsed: {
        type,
        raw: original,
        pattern: pattern,
        useRegex: /regex|pattern/.test(text),
      },
      confidence: 0.88,
    };
  }

  private parseElementCount(original: string, text: string): ParseResult {
    // Extract count
    const match = text.match(/(?:should\s+)?(?:show|have|display)\s+(\d+)\s+/);
    const count = match ? parseInt(match[1], 10) : undefined;

    // Extract element description
    const elemMatch = text.match(/(\d+)\s+([^,\.]+)/);
    const target = elemMatch ? elemMatch[2].trim() : text;

    return {
      type: 'element-count',
      parsed: {
        type: 'element-count',
        raw: original,
        target,
        count,
      },
      confidence: 0.85,
    };
  }

  private parseNoError(original: string, text: string): ParseResult {
    const method = this.extractErrorCheckMethod(text);

    return {
      type: 'no-error',
      parsed: {
        type: 'no-error',
        raw: original,
        method: method,
      },
      confidence: 0.90,
    };
  }

  private parseState(original: string, text: string): ParseResult {
    // Extract state
    const stateMatch = text.match(/(?:be\s+)?(?:enabled|disabled|checked|required)/i);
    const state = stateMatch ? stateMatch[0].toLowerCase().replace(/^be\s+/, '') : 'enabled';

    // Extract target element
    const targetMatch = text.match(/(\w+)\s+(?:should\s+)?(?:be\s+)?(?:enabled|disabled)/i);
    const target = targetMatch ? targetMatch[1] : text;

    return {
      type: 'element-state',
      parsed: {
        type: 'element-state',
        raw: original,
        target,
        state: state as any,
      },
      confidence: 0.88,
    };
  }

  // Helper methods
  private extractLocation(text: string): string {
    if (/error/.test(text)) return 'error';
    if (/success|message/.test(text)) return 'success';
    if (/notification|alert/.test(text)) return 'notification';
    return 'body';
  }

  private extractErrorCheckMethod(text: string): string {
    if (/console/.test(text)) return 'console';
    if (/network|http/.test(text)) return 'network';
    if (/page|visual/.test(text)) return 'visual';
    return 'all';
  }
}

// Export singleton
export const parser = new ExpectationParser();
```

**Acceptance Criteria:**
- ✓ Parses all 7 expectation types
- ✓ Handles various phrasings
- ✓ Extracts parameters correctly
- ✓ Provides confidence scores
- ✓ Falls back gracefully

---

### 4. CORE ASSERTION ENGINE

Create `/src/services/assertionEngine.ts`:

```typescript
import { ExpectationParser } from './expectationParser';
import { 
  Expectation, 
  VerificationResult, 
  AssertionEngineConfig,
  ParseResult 
} from '../types';

export class AssertionEngine {
  private config: Required<AssertionEngineConfig>;
  private parser: ExpectationParser;
  private logger: Logger;

  constructor(config?: AssertionEngineConfig) {
    this.config = {
      confidenceThreshold: config?.confidenceThreshold ?? 80,
      fallbackThreshold: config?.fallbackThreshold ?? 60,
      timeout: config?.timeout ?? 5000,
      enableLogging: config?.enableLogging ?? false,
      logLevel: config?.logLevel ?? 'info',
      debug: config?.debug ?? false,
    };

    this.parser = new ExpectationParser();
    this.logger = new Logger(this.config);
  }

  /**
   * Main method: Verify expected result
   */
  async verifyExpectedResult(
    expectedResult: string,
    page: Page,
    options?: {
      timeout?: number;
      strict?: boolean;
      debug?: boolean;
    }
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Parse expected result
      const parseResult = this.parseExpectedResult(expectedResult);
      
      if (!parseResult.parsed) {
        return this.createFailureResult(
          expectedResult,
          'Could not parse expected result',
          Date.now() - startTime
        );
      }

      // Step 2: Capture page state before verification
      const beforeState = await this.capturePageState(page);

      // Step 3: Route to appropriate verification method
      const verificationResult = await this.routeVerification(
        parseResult.parsed,
        page,
        options
      );

      // Step 4: Capture page state after verification
      const afterState = await this.capturePageState(page);

      // Step 5: Enhance result with debug info
      if (this.config.debug || options?.debug) {
        verificationResult['debugInfo'] = {
          beforeState,
          afterState,
          parseResult,
        };
      }

      // Step 6: Log result
      this.logger.log(parseResult.type, verificationResult);

      return verificationResult;

    } catch (error) {
      this.logger.error('Verification error', error);
      
      return this.createFailureResult(
        expectedResult,
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Parse expected result string to structured format
   */
  private parseExpectedResult(expectedResult: string): ParseResult {
    return this.parser.parse(expectedResult);
  }

  /**
   * Route to appropriate verification method based on type
   */
  private async routeVerification(
    expectation: Expectation,
    page: Page,
    options?: any
  ): Promise<VerificationResult> {
    // Note: Actual verification methods will be in PROMPT #2
    // For now, return placeholder

    const baseResult: VerificationResult = {
      success: false,
      expectationType: expectation.type as any,
      expectedResult: expectation.raw,
      actualResult: 'Placeholder',
      method: 'placeholder',
      reasoning: ['Verification method not yet implemented'],
      duration: 0,
      timestamp: new Date(),
    };

    switch (expectation.type) {
      case 'navigate':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'element-visible':
      case 'element-hidden':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'text-visible':
      case 'text-not-visible':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'url-contains':
      case 'url-equals':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'element-count':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'no-error':
        // Will be implemented in PROMPT #2
        return baseResult;

      case 'element-state':
        // Will be implemented in PROMPT #2
        return baseResult;

      default:
        return this.createFailureResult(
          expectation.raw,
          `Unsupported expectation type: ${expectation.type}`,
          0
        );
    }
  }

  /**
   * Capture current page state (URL, title, content)
   */
  private async capturePageState(page: Page): Promise<any> {
    return {
      url: page.url(),
      title: await page.title(),
      contentLength: (await page.content()).length,
      timestamp: new Date(),
    };
  }

  /**
   * Create failure result
   */
  private createFailureResult(
    expectedResult: string,
    reason: string,
    duration: number
  ): VerificationResult {
    return {
      success: false,
      expectationType: 'unknown',
      expectedResult,
      actualResult: reason,
      method: 'error',
      reasoning: [reason],
      failure: {
        reason,
        suggestion: 'Check expected result format and try again',
        evidence: [],
      },
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Simple logger
 */
class Logger {
  constructor(private config: Required<AssertionEngineConfig>) {}

  log(type: string, data: any) {
    if (!this.config.enableLogging) return;
    if (this.config.logLevel !== 'debug' && this.config.logLevel !== 'info') return;
    console.log(`[AssertionEngine:${type}]`, data);
  }

  error(msg: string, error: any) {
    if (!this.config.enableLogging) return;
    console.error(`[AssertionEngine:ERROR] ${msg}`, error);
  }
}
```

**Acceptance Criteria:**
- ✓ Class compiles with TypeScript strict
- ✓ Parses expected results
- ✓ Routes to correct verification method
- ✓ Captures page state before/after
- ✓ Returns proper VerificationResult
- ✓ Error handling implemented

---

### 5. COMPREHENSIVE TESTS

Create `/tests/unit/parser.test.ts`:

```typescript
import { ExpectationParser } from '../../src/services/expectationParser';

describe('ExpectationParser', () => {
  let parser: ExpectationParser;

  beforeEach(() => {
    parser = new ExpectationParser();
  });

  describe('Navigation Pattern', () => {
    test('parses "navigate to dashboard"', () => {
      const result = parser.parse('navigate to dashboard');
      expect(result.type).toBe('navigate');
      expect(result.parsed.destination).toBe('dashboard');
      expect(result.confidence).toBeGreaterThan(0.90);
    });

    test('parses "should navigate to user settings"', () => {
      const result = parser.parse('should navigate to user settings');
      expect(result.type).toBe('navigate');
      expect(result.parsed.destination).toContain('settings');
    });

    test('parses "go to /dashboard"', () => {
      const result = parser.parse('go to /dashboard');
      expect(result.type).toBe('navigate');
      expect(result.confidence).toBeGreaterThan(0.80);
    });
  });

  describe('Element Visibility Pattern', () => {
    test('parses "should see welcome message"', () => {
      const result = parser.parse('should see welcome message');
      expect(result.type).toBe('element-visible');
      expect(result.parsed.target).toContain('welcome');
    });

    test('parses "should not see error"', () => {
      const result = parser.parse('should not see error');
      expect(result.type).toBe('element-hidden');
    });

    test('parses "display error alert"', () => {
      const result = parser.parse('display error alert');
      expect(['element-visible', 'text-visible']).toContain(result.type);
    });
  });

  describe('Text Content Pattern', () => {
    test('parses quoted text', () => {
      const result = parser.parse('should contain "Login successful"');
      expect(result.type).toBe('text-visible');
      expect(result.parsed.text).toBe('Login successful');
    });

    test('parses "should not contain error"', () => {
      const result = parser.parse('should not contain "error message"');
      expect(result.type).toBe('text-not-visible');
    });
  });

  describe('URL Pattern', () => {
    test('parses URL contains', () => {
      const result = parser.parse('URL should contain /dashboard');
      expect(result.type).toBe('url-contains');
      expect(result.parsed.pattern).toContain('dashboard');
    });

    test('parses URL equals', () => {
      const result = parser.parse('URL should be /dashboard');
      expect(result.type).toBe('url-equals');
    });
  });

  describe('Element Count Pattern', () => {
    test('parses "should show 5 items"', () => {
      const result = parser.parse('should show 5 items');
      expect(result.type).toBe('element-count');
      expect(result.parsed.count).toBe(5);
      expect(result.parsed.target).toContain('item');
    });

    test('parses "table should have 10 rows"', () => {
      const result = parser.parse('table should have 10 rows');
      expect(result.type).toBe('element-count');
      expect(result.parsed.count).toBe(10);
    });
  });

  describe('No Error Pattern', () => {
    test('parses "should not show error"', () => {
      const result = parser.parse('should not show error');
      expect(result.type).toBe('no-error');
    });

    test('parses "no errors on page"', () => {
      const result = parser.parse('no errors on page');
      expect(result.type).toBe('no-error');
    });
  });

  describe('State Pattern', () => {
    test('parses "button should be enabled"', () => {
      const result = parser.parse('button should be enabled');
      expect(result.type).toBe('element-state');
      expect(result.parsed.state).toBe('enabled');
    });

    test('parses "checkbox should be checked"', () => {
      const result = parser.parse('checkbox should be checked');
      expect(result.type).toBe('element-state');
      expect(result.parsed.state).toBe('checked');
    });
  });

  describe('Confidence Scores', () => {
    test('high confidence for clear patterns', () => {
      const result = parser.parse('navigate to dashboard');
      expect(result.confidence).toBeGreaterThan(0.90);
    });

    test('lower confidence for ambiguous patterns', () => {
      const result = parser.parse('something random');
      expect(result.confidence).toBeLessThan(0.70);
    });
  });

  describe('Edge Cases', () => {
    test('handles extra whitespace', () => {
      const result = parser.parse('  should   navigate   to   dashboard  ');
      expect(result.type).toBe('navigate');
    });

    test('case insensitive', () => {
      const result1 = parser.parse('NAVIGATE TO DASHBOARD');
      const result2 = parser.parse('navigate to dashboard');
      expect(result1.type).toBe(result2.type);
    });

    test('handles punctuation', () => {
      const result = parser.parse('Navigate to dashboard.');
      expect(result.type).toBe('navigate');
    });

    test('handles mixed cases', () => {
      const result = parser.parse('Should Navigate To Dashboard (User Page)');
      expect(result.type).toBe('navigate');
    });
  });
});
```

Create `/tests/unit/assertionEngine.test.ts`:

```typescript
import { AssertionEngine } from '../../src/services/assertionEngine';

describe('AssertionEngine', () => {
  let engine: AssertionEngine;

  beforeEach(() => {
    engine = new AssertionEngine({
      enableLogging: false,
      debug: false,
    });
  });

  describe('Initialization', () => {
    test('creates with default config', () => {
      const e = new AssertionEngine();
      expect(e).toBeDefined();
    });

    test('creates with custom config', () => {
      const e = new AssertionEngine({
        confidenceThreshold: 85,
        timeout: 10000,
      });
      expect(e).toBeDefined();
    });
  });

  describe('Parsing', () => {
    test('parses simple expectation', () => {
      // This tests the internal parse method
      const result = engine['parseExpectedResult']('navigate to dashboard');
      expect(result.type).toBe('navigate');
    });

    test('handles invalid input', () => {
      const result = engine['parseExpectedResult']('');
      expect(result).toBeDefined();
    });
  });

  describe('Verification Result Structure', () => {
    test('returns correct result structure', async () => {
      // Mock page object (actual verification in PROMPT #2)
      const mockPage = {
        url: () => 'https://example.com/dashboard',
        title: () => Promise.resolve('Dashboard'),
        content: () => Promise.resolve('<html></html>'),
      } as any;

      const result = await engine.verifyExpectedResult(
        'navigate to dashboard',
        mockPage
      );

      // Verify structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('expectationType');
      expect(result).toHaveProperty('expectedResult');
      expect(result).toHaveProperty('actualResult');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
```

**Acceptance Criteria:**
- ✓ All tests pass
- ✓ >80% code coverage
- ✓ Edge cases handled
- ✓ Comprehensive test suite

---

## DELIVERABLES FOR PROMPT #1

After completion, you should have:

```
src/
├── types/
│   └── index.ts                    (Types only, no implementation)
├── data/
│   └── semanticDictionary.ts       (Dictionary of keywords)
├── services/
│   ├── expectationParser.ts        (NLP parser implementation)
│   └── assertionEngine.ts          (Core engine class)
└── index.ts                        (Main export)

tests/
├── unit/
│   ├── parser.test.ts              (Parser tests)
│   └── assertionEngine.test.ts     (Engine tests)
└── fixtures/
    └── expectations.json           (Test data)

dist/
├── types/
├── services/
└── index.js                        (Compiled output)

package.json
tsconfig.json
jest.config.js
```

---

## SUCCESS CRITERIA FOR PROMPT #1

✅ **Code Quality**
- TypeScript compiles with strict mode
- No eslint errors
- All unit tests pass
- >80% code coverage

✅ **Functionality**
- Parses all 7 expectation types
- Handles edge cases gracefully
- Returns proper result structure
- Error handling implemented

✅ **Documentation**
- JSDoc on all functions
- Clear type definitions
- Readme with examples
- Troubleshooting guide

✅ **Ready for Next Phase**
- Code is modular and extensible
- Verification methods can be added in PROMPT #2
- Database integration ready
- No breaking changes needed

---

## NEXT: PROMPT #2

After completing PROMPT #1, use **PROMPT #2** which will add:

```
✓ All 7 verification methods (navigate, element, text, URL, etc.)
✓ SmartMatcher integration
✓ Root cause analysis
✓ Integration with Worker
✓ Error handling & recovery
✓ Dashboard integration
✓ Complete E2E testing
✓ Performance optimization
```

---

## INSTRUCTIONS FOR USING THIS PROMPT

1. **Copy** this entire document (or use the file provided)
2. **Paste** into Claude at chat.claude.ai
3. **Add** this request at the end:

```
"Using the requirements above, generate complete TypeScript code for 
AssertionEngine PROMPT #1 (Core Implementation).

Build in this order:
1. src/types/index.ts - All type definitions
2. src/data/semanticDictionary.ts - Keyword database
3. src/services/expectationParser.ts - NLP parser
4. src/services/assertionEngine.ts - Core engine
5. tests/unit/parser.test.ts - Parser tests
6. tests/unit/assertionEngine.test.ts - Engine tests

For each file:
- Include complete, production-ready code
- Add comprehensive JSDoc comments
- Include error handling
- Add logging statements
- Make it TypeScript strict-mode compatible

After code:
- Generate package.json with required dependencies
- Generate tsconfig.json with strict mode
- Generate jest.config.js for testing
- Create README.md with setup and usage guide

Verification:
✓ TypeScript compiles: npm run build (no errors)
✓ Tests pass: npm test (100% passing)
✓ Coverage adequate: npm run coverage (>80%)
✓ No eslint errors: npm run lint
"
```

4. **Claude generates** complete PROMPT #1 code

---

**END OF PROMPT #1**

**Ready to proceed with Prompt #2 after this is complete.**
