# Trade Validation Pipeline

This document outlines the validation rules used in the trade machine, their order of execution, and interdependencies between rules.

## Modular Architecture

The trade validator has been refactored into a modular system where each validation rule is implemented in its own file. This makes the code more maintainable and allows for easier testing.

### Core Files

- **tradeValidator.js**: Main entry point that coordinates the validation pipeline
- **validators/**: Directory containing individual validation rule implementations
- **rules/**: Directory containing enforcement functions for specific CBA rules
- **config/validationFlags.js**: Central configuration for rule enforcement levels

### Validator Modules

Each validator module follows a consistent pattern:

- Takes a team context object and optional trade context
- Returns `{ passed, violations[], message, details, warningsOnly }`
- Respects validation flags for configurable enforcement

## Validation Order

The trade validator follows this specific sequence to ensure rules are validated in the correct order:

1. **Pre-processing**

   - Apply BYC (Base Year Compensation) conversions
   - Apply poison pill and trade kicker adjustments
   - Normalize cap settings and team salary data

2. **Team-level Validation Pipeline**

   1. **Sign-and-Trade Rules** (`validateSignAndTrade.js`)

      - Must be executed in offseason
      - Must be executed by player's original team (with Bird rights)
      - Player must be traded alone (no aggregation with other players/picks)
      - Contract must be 3-4 years with first year guaranteed
      - Team receiving S&T player will be hard-capped at first apron
      - Teams using taxpayer MLE cannot receive S&T players

   2. **Hard Cap Rules** (`validateHardCap.js`)

      - Teams cannot exceed the first apron if they are hard-capped
      - Hard caps come from sign-and-trades, using the non-taxpayer MLE, BAE, or certain other exceptions
      - Post-trade salaries must stay below the first apron threshold

   3. **Second Apron Restrictions** (`validateSecondApronRules.js`) (if no hard cap violation)

      - Teams above second apron can only take back equal or less salary
      - Second apron teams cannot aggregate multiple player salaries
      - Second apron teams cannot use prior-year TPEs
      - Second apron teams cannot send or receive cash

   4. **Player Consent & Eligibility** (`enforceConsent.js`, `enforceEligibility.js`)

      - Players with no-trade clauses must consent
      - Limited no-trade clauses must allow the destination
      - Bird rights veto applies for certain one-year contracts
      - Re-acquisition rules (1-year rule, waiver rules)

   5. **Salary Matching** (`validateSalaryMatching.js`) (skipped for second apron violations)

      - Over-cap teams must match within allowed bands
      - Under-cap teams can absorb salary up to the cap
      - First apron teams limited to 100% matching

   6. **Cash Considerations** (`validateCash.js`)

      - Second apron teams cannot send/receive cash
      - Cash must be within seasonal limits
      - Cash considerations don't affect salary matching

   7. **Draft Pick Rules** (`validateStepien.js`)

      - Stepien Rule: No consecutive future first-round picks
      - Protected picks can bypass Stepien rule
      - Cannot trade picks more than 7 years out

   8. **Roster Requirements** (`validateRoster.js`)

      - Post-trade roster size must be within limits (usually 14-15 during season)
      - Two-way contract limits
      - Minimum roster requirements

   9. **Trade & FA Exceptions** (`validateTradeExceptions.js`, `validateFaExceptionUsage.js`)
      - TPEs cannot be aggregated with outgoing salary
      - Second apron teams cannot use prior-year TPEs
      - FA exceptions create hard caps at first apron

## Rule Dependencies and Priority

This section outlines which rules depend on others and their priority order:

1. **Hard Cap Priority**

   - If a team has Sign-and-Trade hard cap violations, Second Apron validation is skipped
   - Second Apron violations take priority over standard salary matching

2. **Salary Conversions**

   - BYC and poison pill adjustments must happen before any salary matching
   - These modified values are used for all subsequent validations

3. **TPE and FA Exception Dependencies**

   - Second Apron status determines TPE eligibility
   - FA Exception usage impacts hard cap status

4. **Violation Prioritization**
   - Second Apron violations are displayed first
   - Other violations are shown in the order of the validation pipeline

## CBA Thresholds and Limits

Key thresholds used in the validation rules (for 2024-25 season):

- **Salary Cap**: $140,588,000
- **Luxury Tax Line**: $170,818,000
- **First Apron**: $178,132,000
- **Second Apron**: $188,938,000
- **Salary Matching Bands**:
  - 125% + $100,000 for salaries up to $7.1M
  - 177.8% for salaries $7.1M to $13.8M
  - 125% + $5M for salaries above $13.8M

## Error Handling Strategy

- Most rules return a consistent structure: `{ passed, violations, message, details, warningsOnly }`
- Rules can be toggled between 'error', 'warn', and 'off' modes via validation flags
- Financial violations include specific salary amounts for clarity
- Rules are applied to each team separately, then aggregated for the overall trade

## Configurable Validation System

The validation system supports flexible rule enforcement via the central `validationFlags.js` configuration file. This allows administrators to control how strictly each rule is enforced without modifying the core validation logic.

### Enforcement Levels

Each validation rule can be set to one of three enforcement levels:

- **'error'**: Rule violation blocks the trade (default)
- **'warn'**: Rule violation shows a warning but allows the trade to proceed
- **'off'**: Rule validation is disabled entirely

### Configuration Example

```javascript
// src/config/validationFlags.js
export const validationFlags = {
  // Core rule enforcement
  rosterEnforcement: 'warn', // Show warnings but allow trades with roster issues
  hardCap: 'error', // Strictly enforce hard cap violations
  stepienRule: 'off', // Disable Stepien rule validation

  // Financial restrictions
  salaryMatching: 'error', // Strictly enforce salary matching
  secondApron: 'error', // Strictly enforce second apron restrictions

  // Player-centric rules
  consent: 'warn', // Show warnings for no-trade clause issues
  eligibility: 'error', // Strictly enforce player eligibility

  // Other configurable rules
  timingEnforcement: 'warn', // Trade timing windows
  reAcquisition: 'error', // Player re-acquisition rules
  seasonalCash: 'warn', // Seasonal cash limits
  frozenPicks: 'error', // Picks already committed in prior trades
};
```

### Helper Functions

The validation system provides three helper functions to access and interpret validation flags:

```javascript
// Get the raw flag value with optional default
const value = getValidationFlag('ruleName', 'defaultValue');

// Check if a rule should block a trade (true if 'error')
const shouldBlock = shouldBlockTrade('ruleName');

// Check if a rule should only warn (true if 'warn')
const isWarningOnly = shouldWarnOnly('ruleName');
```

### Implementation in Validators

Each validator respects these flags and handles enforcement accordingly:

```javascript
// Example implementation in a validator
export function validateSomeRule(team) {
  // Get the enforcement level
  const enforcementLevel = getValidationFlag('someRule', 'error');

  // Skip validation if turned off
  if (enforcementLevel === 'off') {
    return { passed: true, violations: [], message: 'Validation skipped' };
  }

  // Perform validation and collect violations
  const violations = [];
  // ...validation logic...

  // Handle warnings vs. errors based on configuration
  const passed = violations.length === 0 || shouldWarnOnly('someRule');
  const warningsOnly = shouldWarnOnly('someRule') && violations.length > 0;

  return {
    passed,
    violations,
    message: passed ? 'Validation passed' : 'Rule violated',
    warningsOnly,
  };
}
```

### User Experience

When a rule is set to 'warn' mode, the system will:

1. Allow the trade to proceed despite violations
2. Display warnings to inform the user of potential issues
3. Maintain a record of warnings separate from blocking errors

This flexibility enables different operational modes for various use cases while maintaining the integrity of the validation system.
