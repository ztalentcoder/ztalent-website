import '../src/config/environment.js';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  InitialAdminProvisioningError,
  provisionInitialAdmin,
} from '../src/services/initial-admin-provisioning.js';

function ask(prompt) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return readline.question(prompt).finally(() => readline.close());
}

function askForPassword(prompt) {
  const input = process.stdin;
  const output = process.stderr;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new InitialAdminProvisioningError(
      'INTERACTIVE_TERMINAL_REQUIRED',
      'Run provisioning from an interactive terminal so the password can be entered without echo.',
    );
  }

  return new Promise((resolve, reject) => {
    let password = '';
    const wasRaw = input.isRaw;
    const finish = (error) => {
      input.off('keypress', onKeypress);
      input.setRawMode(wasRaw);
      output.write('\n');
      if (error) reject(error);
      else resolve(password);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new InitialAdminProvisioningError('CANCELLED', 'Provisioning cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
      } else if (key.name === 'backspace') {
        password = Array.from(password).slice(0, -1).join('');
      } else if (key.ctrl && key.name === 'u') {
        password = '';
      } else if (character && !key.ctrl && !key.meta) {
        password += character;
      }
    };

    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    output.write(prompt);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new InitialAdminProvisioningError(
      'INTERACTIVE_TERMINAL_REQUIRED',
      'Run provisioning from an interactive terminal so the password can be entered without echo.',
    );
  }

  const name = await ask('Initial SUPER_ADMIN name: ');
  const email = await ask('Initial SUPER_ADMIN email: ');
  const password = await askForPassword('Password (input hidden): ');
  const confirmation = await askForPassword('Confirm password (input hidden): ');
  if (password !== confirmation) {
    throw new InitialAdminProvisioningError('PASSWORD_MISMATCH', 'The passwords did not match.');
  }

  const prisma = new PrismaClient();
  try {
    const admin = await provisionInitialAdmin(prisma, { name, email, password });
    console.info(`Created the initial SUPER_ADMIN account (id: ${admin.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof InitialAdminProvisioningError) {
      console.error(error.message);
    } else {
      console.error('Initial admin provisioning failed. Check database connectivity and try again.');
    }
    process.exitCode = 1;
  });
}
