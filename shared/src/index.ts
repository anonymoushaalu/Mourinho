/**
 * Public surface of the shared contract package.
 *
 * Everything the client is allowed to know about the backend flows through
 * here. Nothing in this package may import from `client/` or depend on any
 * runtime library — it must stay a pure, dependency-free type/constant layer.
 */
export * from './constants.js';
export * from './types/api.js';
export * from './types/domain.js';
