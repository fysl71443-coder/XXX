#!/usr/bin/env node
/**
 * Database Backup Script
 * سكربت النسخ الاحتياطي لقاعدة البيانات
 * 
 * Usage:
 *   node backup-database.js                    # Creates a backup
 *   node backup-database.js --restore <file>  # Restores from a backup
 *   node backup-database.js --list            # Lists available backups
 *   node backup-database.js --cleanup         # Removes old backups
 * 
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   BACKUP_PATH  - Directory to store backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BACKUP_PATH = process.env.BACKUP_PATH || path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_PATH)) {
  fs.mkdirSync(BACKUP_PATH, { recursive: true });
  console.log(`✅ Created backup directory: ${BACKUP_PATH}`);
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function parseConnectionString(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.slice(1).split('?')[0],
      user: parsed.username,
      password: parsed.password
    };
  } catch (e) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }
}

async function createBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = parseConnectionString(dbUrl);
  const timestamp = getTimestamp();
  const filename = `backup_${db.database}_${timestamp}.sql`;
  const filepath = path.join(BACKUP_PATH, filename);

  console.log(`📦 Creating backup: ${filename}`);
  console.log(`   Database: ${db.database}`);
  console.log(`   Host: ${db.host}`);

  try {
    // Set password in environment
    const env = { ...process.env, PGPASSWORD: db.password };
    
    // Run pg_dump
    execSync(
      `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p -f "${filepath}"`,
      { env, stdio: 'inherit' }
    );

    // Compress the backup
    execSync(`gzip "${filepath}"`, { stdio: 'inherit' });
    const compressedPath = `${filepath}.gz`;
    
    const stats = fs.statSync(compressedPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created successfully!`);
    console.log(`   File: ${compressedPath}`);
    console.log(`   Size: ${sizeMB} MB`);
    
    return compressedPath;
  } catch (e) {
    console.error('❌ Backup failed:', e.message);
    process.exit(1);
  }
}

async function restoreBackup(backupFile) {
  if (!backupFile) {
    console.error('❌ Please specify a backup file to restore');
    process.exit(1);
  }

  const filepath = path.isAbsolute(backupFile) ? backupFile : path.join(BACKUP_PATH, backupFile);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Backup file not found: ${filepath}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = parseConnectionString(dbUrl);
  
  console.log(`⚠️  WARNING: This will overwrite the database "${db.database}"`);
  console.log(`   Restoring from: ${filepath}`);
  console.log(`   Press Ctrl+C to cancel...`);
  
  // Wait 5 seconds for user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    const env = { ...process.env, PGPASSWORD: db.password };
    
    // Decompress if needed
    let sqlFile = filepath;
    if (filepath.endsWith('.gz')) {
      console.log('📦 Decompressing backup...');
      execSync(`gunzip -k "${filepath}"`, { stdio: 'inherit' });
      sqlFile = filepath.slice(0, -3);
    }
    
    console.log('🔄 Restoring database...');
    execSync(
      `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f "${sqlFile}"`,
      { env, stdio: 'inherit' }
    );
    
    // Clean up decompressed file
    if (filepath.endsWith('.gz') && fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }
    
    console.log('✅ Database restored successfully!');
  } catch (e) {
    console.error('❌ Restore failed:', e.message);
    process.exit(1);
  }
}

function listBackups() {
  console.log(`📂 Backup directory: ${BACKUP_PATH}\n`);
  
  if (!fs.existsSync(BACKUP_PATH)) {
    console.log('No backups found.');
    return;
  }

  const files = fs.readdirSync(BACKUP_PATH)
    .filter(f => f.startsWith('backup_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_PATH, f));
      return {
        name: f,
        size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
        date: stats.mtime.toISOString().slice(0, 19).replace('T', ' ')
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (files.length === 0) {
    console.log('No backups found.');
    return;
  }

  console.log('Available backups:');
  console.log('─'.repeat(80));
  files.forEach((f, i) => {
    console.log(`${i + 1}. ${f.name}`);
    console.log(`   Size: ${f.size} | Created: ${f.date}`);
  });
  console.log('─'.repeat(80));
  console.log(`Total: ${files.length} backup(s)`);
}

function cleanupOldBackups() {
  console.log(`🧹 Cleaning up backups older than ${RETENTION_DAYS} days...\n`);
  
  if (!fs.existsSync(BACKUP_PATH)) {
    console.log('No backups to clean up.');
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const files = fs.readdirSync(BACKUP_PATH)
    .filter(f => f.startsWith('backup_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')));

  let deleted = 0;
  files.forEach(f => {
    const filepath = path.join(BACKUP_PATH, f);
    const stats = fs.statSync(filepath);
    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filepath);
      console.log(`   Deleted: ${f}`);
      deleted++;
    }
  });

  console.log(`\n✅ Cleanup complete. Deleted ${deleted} old backup(s).`);
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (command === '--restore') {
  restoreBackup(args[1]);
} else if (command === '--list') {
  listBackups();
} else if (command === '--cleanup') {
  cleanupOldBackups();
} else {
  createBackup();
}
