/**
 * DEPRECATED ALIAS - REZ-event-bus
 *
 * This service has been renamed to REZ-event-bus.
 * Please update your imports to use REZ-event-bus instead.
 *
 * Migration:
 *   FROM: @rez-ecosystem/REZ-event-bus
 *   TO:   @rez-ecosystem/REZ-event-bus
 */

console.warn(`
╔════════════════════════════════════════════════════════════════╗
║                    DEPRECATION WARNING                        ║
╠════════════════════════════════════════════════════════════════╣
║  REZ-event-bus is DEPRECATED                                ║
║                                                                ║
║  Please use: REZ-event-bus                                   ║
║                                                                ║
║  See: NAMING-STANDARDS.md for migration instructions          ║
╚════════════════════════════════════════════════════════════════╝
`);

// Re-export from the canonical service
const canonical = require('@rez-ecosystem/REZ-event-bus');
module.exports = canonical;
