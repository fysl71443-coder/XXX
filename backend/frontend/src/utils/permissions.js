/**
 * Permission utility functions
 * Standardized permission parsing and mapping
 */

/**
 * Permission format documentation:
 * 
 * Legacy formats (supported by can()):
 * - "screen:action" (e.g., "journal:post", "clients:write")
 * - "screen.action" (e.g., "journal.post", "clients.write")
 * - "screen" (defaults to "view" action)
 * 
 * Standard format (used by canScreen()):
 * - screenCode: string (e.g., "journal", "clients")
 * - actionCode: string (e.g., "view", "create", "edit", "delete")
 * - branch: string | null (null for global, branch code for branch-specific)
 */

/**
 * Map legacy action names to standard action codes
 * @param {string} action - Legacy action name
 * @returns {string} - Standard action code
 */
export function mapActionToStandard(action) {
  const x = String(action || '').toLowerCase();
  
  // Standard actions
  if (x === 'view') return 'view';
  if (x === 'create') return 'create';
  if (x === 'edit') return 'edit';
  if (x === 'delete') return 'delete';
  
  // Legacy mappings
  if (x === 'write') return 'edit';
  if (x === 'post' || x === 'reverse' || x === 'credit_note' || x === 'return') return 'edit';
  if (x === 'print' || x === 'export') return 'view';
  if (x === 'settings' || x === 'manage') return 'settings';
  
  // Default
  return 'view';
}

/**
 * Parse legacy permission format to screen/action
 * @param {string} permission - Permission string (legacy format)
 * @returns {object} - { screen: string, action: string }
 */
export function parsePermission(permission) {
  const raw = String(permission || '').toLowerCase();
  
  if (raw.includes(':')) {
    const [screen, action] = raw.split(':');
    return { screen: screen || '', action: mapActionToStandard(action || '') };
  }
  
  if (raw.includes('.')) {
    const [screen, action] = raw.split('.');
    return { screen: screen || '', action: mapActionToStandard(action || '') };
  }
  
  // Default to view action
  return { screen: raw, action: 'view' };
}
