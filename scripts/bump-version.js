#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');

function readAppJson() {
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  return JSON.parse(raw);
}

function writeAppJson(obj) {
  fs.writeFileSync(appJsonPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function bump() {
  const app = readAppJson();
  app.expo = app.expo || {};

  // Bump overall version patch if present
  const currentVersion = String(app.expo.version || '0.0.0');
  const parts = currentVersion.split('.').map((p) => parseInt(p, 10) || 0);
  parts[2] = (parts[2] || 0) + 1;
  const newVersion = parts.join('.');
  app.expo.version = newVersion;

  // Android versionCode (must be integer)
  app.expo.android = app.expo.android || {};
  const oldCode = parseInt(app.expo.android.versionCode || '0', 10) || 0;
  app.expo.android.versionCode = oldCode + 1;

  // iOS buildNumber (string)
  app.expo.ios = app.expo.ios || {};
  const oldBuild = String(app.expo.ios.buildNumber || '0');
  const newBuild = String((parseInt(oldBuild, 10) || 0) + 1);
  app.expo.ios.buildNumber = newBuild;

  writeAppJson(app);

  console.log('Updated app.json:');
  console.log('  version ->', app.expo.version);
  console.log('  android.versionCode ->', app.expo.android.versionCode);
  console.log('  ios.buildNumber ->', app.expo.ios.buildNumber);
}

bump();
