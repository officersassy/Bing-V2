
import {auth,functions} from './firebase.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const $ = id => document.getElementById(id);
const call = name => httpsCallable(functions, name);
const log = text => {
  $('log').textContent += '\n' + text;
};

const PROTECTED_ADMIN_UID = 'EyBRcUcW2iSeD9QGHIbYtwQsrFx1';

let backupId = null;
let ready = false;
let running = false;
let verifiedAdmin = false;

onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = './index.html';
    return;
  }

  log('Signed-in UID: ' + user.uid);

  verifiedAdmin = user.uid === PROTECTED_ADMIN_UID;

  if (verifiedAdmin) {
    log('ADMIN UID MATCHES - YOUR ACCOUNT IS IDENTIFIED');
    log('Server checks admin permissions on every action.');
  } else {
    log('WARNING: ADMIN UID DOES NOT MATCH!');
    log('Cleanup controls have been disabled.');

    $('preview').disabled = true;
    $('backup').disabled = true;
    $('delete').disabled = true;
  }
});

$('preview').onclick = async () => {
  if (!verifiedAdmin) {
    log('Admin UID verification required.');
    return;
  }

  try {
    const r = (await call('medicCleanupPreview')()).data;

    log(
      `Total: ${r.total}; eligible for deletion: ${r.eligible}; protected admins: ${r.protected}`
    );

    $('backup').disabled = false;
  } catch (e) {
    log('Preview failed: ' + e.message);
  }
};

$('backup').onclick = async () => {
  if (!verifiedAdmin) return;

  if (!confirm('Create a database backup before deleting any accounts?')) {
    return;
  }

  $('backup').disabled = true;

  try {
    log('Creating server-side database backup. This may take a while...');

    const r = (await call('medicCleanupBackup')()).data;

    backupId = r.backupId;
    ready = true;

    $('backupInfo').textContent =
      `Backup ${backupId} saved; ${r.count} accounts eligible. Passwords are NOT backed up.`;

    log('Backup created. Record this backup ID: ' + backupId);

    $('delete').disabled = false;
  } catch (e) {
    log('Backup failed; deletion is blocked: ' + e.message);
    $('backup').disabled = false;
  }
};

$('delete').onclick = async () => {
  if (!verifiedAdmin) {
    log('Admin UID verification required.');
    return;
  }

  if (
    running ||
    !ready ||
    $('confirm').value !== 'DELETE ALL OTHER ACCOUNTS'
  ) {
    log('Exact typed confirmation required.');
    return;
  }

  if (
    !confirm(
      'FINAL WARNING: Permanently delete ALL non-admin accounts? This cannot restore passwords.'
    )
  ) {
    return;
  }

  running = true;
  $('delete').disabled = true;

  try {
    for (let n = 0; n < 3000; n++) {
      const r = (
        await call('medicCleanupDeleteBatch')({
          backupId,
          confirmation: 'DELETE ALL OTHER ACCOUNTS'
        })
      ).data;

      log(
        `Batch ${n + 1}: deleted ${r.deletedThisBatch}; remaining ${r.remaining}`
      );

      if (r.failures?.length) {
        log('Errors on UIDs: ' + r.failures.join(', '));
        break;
      }

      if (r.finished) {
        log('Cleanup complete. Admin accounts retained.');
        break;
      }

      if (!r.deletedThisBatch) {
        log('No progress. Stopped to avoid repeated failures.');
        break;
      }
    }
  } catch (e) {
    log('Cleanup stopped: ' + e.message);
  } finally {
    running = false;
  }
};
