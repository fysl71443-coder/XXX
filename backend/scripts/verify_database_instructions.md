# Database Verification Script Instructions

## Usage

### Option 1: Using Environment Variable (Recommended for Render)
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
node backend/scripts/verify_database.js
```

### Option 2: Pass as Argument
```bash
node backend/scripts/verify_database.js "postgresql://user:password@host:port/database"
```

### Option 3: For Render Deployment
The script will automatically use `DATABASE_URL` from Render's environment variables.

## What the Script Checks

1. **Admin User Verification**
   - Checks if admin user exists
   - Verifies role is exactly 'admin' (lowercase)
   - Shows admin user details

2. **Users Table Structure**
   - Verifies all required columns exist
   - Checks for missing columns

3. **Required Tables**
   - Checks existence of all required tables:
     - users
     - user_permissions
     - settings
     - partners
     - employees
     - expenses
     - supplier_invoices
     - invoices
     - orders
     - payments
     - Account
     - JournalEntry
     - JournalPosting

4. **Permissions Check**
   - Counts total permissions
   - Checks admin permissions (should be 0 for admin bypass)

5. **Settings Check**
   - Verifies settings table exists and is accessible

6. **Database Connection**
   - Tests database connectivity
   - Shows database version

## Output

The script generates:
- Console output with detailed verification results
- `database_verification_report.json` file with full report

## Common Issues and Fixes

### Issue: No admin user found
**Fix:** Run `node backend/createAdmin.js` to create admin user

### Issue: Missing tables
**Fix:** Run `ensureSchema()` function in server.js or run migrations

### Issue: Admin role is not 'admin' (lowercase)
**Fix:** Run SQL: `UPDATE users SET role = 'admin' WHERE role = 'Admin' OR role = 'ADMIN'`

### Issue: Connection refused
**Fix:** 
- Check DATABASE_URL is correct
- Verify database is accessible
- Check firewall/network settings
- For Render: Ensure DATABASE_URL is set in environment variables

## For Render Deployment

1. Go to Render Dashboard → Your Service → Environment
2. Add/Verify `DATABASE_URL` environment variable
3. The script will automatically use it when run on Render

## Manual SQL Queries

If you need to check manually:

```sql
-- Check admin user
SELECT id, email, role, default_branch, created_at, is_active 
FROM users 
WHERE role = 'admin';

-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check user_permissions
SELECT COUNT(*) FROM user_permissions;

-- Check admin permissions
SELECT COUNT(*) FROM user_permissions WHERE user_id = 1;
```
