const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.join(__dirname, '../app');
const apiDir = path.join(appDir, 'api');
const rootDir = path.join(__dirname, '../');
const apiBackupDir = path.join(rootDir, 'api_backup'); // Move OUT of app dir

// Clean artifacts
try {
    execSync('rm -rf .next out', { stdio: 'inherit' });
} catch (e) { }

const sitemapFile = path.join(appDir, 'sitemap.ts');
const sitemapBackupFile = path.join(rootDir, 'sitemap_backup.ts');

// 1. Move app/api to api_backup
if (fs.existsSync(apiDir)) {
    console.log('Moving API routes to backup location...');
    fs.renameSync(apiDir, apiBackupDir);
} else if (fs.existsSync(path.join(appDir, '_api_backup'))) {
    // Handle case where previous run failed and left it renamed
    console.log('Found _api_backup, moving to api_backup...');
    fs.renameSync(path.join(appDir, '_api_backup'), apiBackupDir);
}

// 2. Move sitemap.ts to backup
if (fs.existsSync(sitemapFile)) {
    console.log('Moving sitemap.ts to backup location...');
    fs.renameSync(sitemapFile, sitemapBackupFile);
}

// Debug: List app dir
console.log('App dir contents before build:');
try {
    console.log(fs.readdirSync(appDir));
} catch (e) { }

try {
    // 3. Run Next.js build with IS_MOBILE_BUILD env var
    console.log('Running Next.js build for mobile...');
    execSync('IS_MOBILE_BUILD=true npm run build', { stdio: 'inherit', env: { ...process.env, IS_MOBILE_BUILD: 'true' } });
    console.log('Build successful!');
} catch (error) {
    console.error('Build failed!');
    // Do not exit here, let finally block run
    process.exitCode = 1;
} finally {
    // 4. Restore files
    if (fs.existsSync(apiBackupDir)) {
        console.log('Restoring API routes...');
        fs.renameSync(apiBackupDir, apiDir);
    }
    if (fs.existsSync(sitemapBackupFile)) {
        console.log('Restoring sitemap.ts...');
        fs.renameSync(sitemapBackupFile, sitemapFile);
    }
}
