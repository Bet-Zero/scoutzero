/**
 * Engine barrel file
 * Exports orchestration, performance monitoring, and debug functionality
 * This is the only module that should import cache
 */

// Main trade validation orchestrator
export * from './tradeValidator.js';

// Performance monitoring
export * from './performanceMonitor.js';
export * from './validationPerformanceMonitor.js';

// Validation decorators and factories
export * from './validationUtils.js';  // includes validationDecorator.js, validatorDebug.js, templateValidator.js

// Debug utilities
export * from './engineUtils.js';
export * from './tradeDebug.js';
export * from './validationDebugMonitor.js';
export * from './validationUtils.js';  // includes validatorDebug.js

// Trade-specific engine components (trade kicker now in engineUtils.js)

// Template and debugging (templateValidator.js now in validationUtils.js)
export * from './tradeValidator.debug.js';