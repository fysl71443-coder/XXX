// This file shows the API endpoints needed for the new permission system
// Add these to server.js

export const permissionsAPI = {
  // Get all roles
  'GET /api/roles': async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
    res.json({ items: rows });
  },

  // Get all screens
  'GET /api/screens': async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, code, description FROM screens ORDER BY name');
    res.json({ items: rows });
  },

  // Get all actions
  'GET /api/actions': async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, code, description FROM actions ORDER BY name');
    res.json({ items: rows });
  },

  // Get permissions for a role
  'GET /api/roles/:roleId/permissions': async (req, res) => {
    const roleId = parseInt(req.params.roleId);
    const { rows } = await pool.query(`
      SELECT rp.screen_id, rp.action_id, s.code as screen_code, a.code as action_code
      FROM role_permissions rp
      INNER JOIN screens s ON rp.screen_id = s.id
      INNER JOIN actions a ON rp.action_id = a.id
      WHERE rp.role_id = $1
    `, [roleId]);
    res.json({ items: rows });
  },

  // Update role permissions
  'PUT /api/roles/:roleId/permissions': async (req, res) => {
    const roleId = parseInt(req.params.roleId);
    const { permissions } = req.body; // Array of {screen_id, action_id}
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      
      for (const perm of permissions) {
        await client.query(
          'INSERT INTO role_permissions (role_id, screen_id, action_id) VALUES ($1, $2, $3)',
          [roleId, perm.screen_id, perm.action_id]
        );
      }
      
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'server_error', details: e.message });
    } finally {
      client.release();
    }
  },

  // Get user permissions (role + user-specific)
  'GET /api/users/:userId/permissions': async (req, res) => {
    const userId = parseInt(req.params.userId);
    
    // Get role permissions
    const { rows: rolePerms } = await pool.query(`
      SELECT rp.screen_id, rp.action_id, s.code as screen_code, a.code as action_code, 'role' as source
      FROM role_permissions rp
      INNER JOIN screens s ON rp.screen_id = s.id
      INNER JOIN actions a ON rp.action_id = a.id
      INNER JOIN users u ON rp.role_id = u.role_id
      WHERE u.id = $1
    `, [userId]);
    
    // Get user-specific permissions
    const { rows: userPerms } = await pool.query(`
      SELECT up.screen_id, up.action_id, s.code as screen_code, a.code as action_code, 'user' as source
      FROM user_permissions_new up
      INNER JOIN screens s ON up.screen_id = s.id
      INNER JOIN actions a ON up.action_id = a.id
      WHERE up.user_id = $1 AND up.allowed = true
    `, [userId]);
    
    res.json({ 
      rolePermissions: rolePerms,
      userPermissions: userPerms,
      all: [...rolePerms, ...userPerms]
    });
  },

  // Update user-specific permissions
  'PUT /api/users/:userId/permissions': async (req, res) => {
    const userId = parseInt(req.params.userId);
    const { permissions } = req.body; // Array of {screen_id, action_id, allowed}
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_permissions_new WHERE user_id = $1', [userId]);
      
      for (const perm of permissions) {
        if (perm.allowed) {
          await client.query(
            'INSERT INTO user_permissions_new (user_id, screen_id, action_id, allowed) VALUES ($1, $2, $3, $4)',
            [userId, perm.screen_id, perm.action_id, true]
          );
        }
      }
      
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'server_error', details: e.message });
    } finally {
      client.release();
    }
  }
};
