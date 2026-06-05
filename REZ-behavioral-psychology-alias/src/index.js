/**
 * DEPRECATED ALIAS - REZ-behavioral-psychology
 *
 * This service has been renamed to rez-behavioral-psychology.
 * Please update your imports to use rez-behavioral-psychology instead.
 *
 * Migration:
 *   FROM: @rez-ecosystem/REZ-behavioral-psychology
 *   TO:   @rez-ecosystem/rez-behavioral-psychology
 */

console.warn(`
╔════════════════════════════════════════════════════════════════╗
║                    DEPRECATION WARNING                        ║
╠════════════════════════════════════════════════════════════════╣
║  REZ-behavioral-psychology is DEPRECATED                      ║
║                                                                ║
║  Please use: rez-behavioral-psychology                         ║
║                                                                ║
║  See: NAMING-STANDARDS.md for migration instructions          ║
╚════════════════════════════════════════════════════════════════╝
`);

// Re-export from the canonical service
const canonical = require('@rez-ecosystem/rez-behavioral-psychology');
module.exports = canonical;
