import { Sandbox } from 'e2b';
import { inngest } from '../client';
import { prisma } from '../../../lib/prisma';
import { encrypt } from '../../../lib/encryption';

interface KeystoreEventData {
  projectId: string;
  // keytool -dname fields
  commonName: string;       // CN — e.g. "John Doe"
  orgUnit: string;          // OU — e.g. "Engineering"
  org: string;              // O  — e.g. "Acme Corp"
  city: string;             // L  — e.g. "Beirut"
  state: string;            // S  — e.g. "Mount Lebanon"
  countryCode: string;      // C  — e.g. "LB"
}

// Template alias — keep in sync with build.dev.ts / build.prod.ts
const KEYSTORE_TEMPLATE = 'generate-keystore';

export const generateKeystoreFunction = inngest.createFunction(
  { id: 'generate-keystore', triggers: [{ event: 'keystore/generate' }] },
  async ({ event, step }) => {
    const { projectId, commonName, orgUnit, org, city, state, countryCode } =
      event.data as KeystoreEventData;

    // ── Step 1: Boot the sandbox ──────────────────────────────────────────────
    const sandboxId = await step.run('boot-sandbox', async () => {
      const sandbox = await Sandbox.create(KEYSTORE_TEMPLATE);
      await sandbox.setTimeout(60_000 * 5); // 5 min is plenty
      return sandbox.sandboxId;
    });

    // ── Step 2: Generate password inside sandbox, hash it for storage ─────────
    const { plainPassword, hashedPassword } = await step.run(
      'generate-password',
      async () => {
        const sandbox = await Sandbox.connect(sandboxId);
        const result = await sandbox.commands.run('sh /gen-pass.sh');
        const plain = result.stdout.trim();

        // bcrypt-style hashing is overkill for a machine-generated secret;
        // SHA-256 + a secret-keyed HMAC is fast and sufficient here.
        // The real protection comes from AES-256-GCM encryption at rest.
        const { createHmac } = await import('crypto');
        const hashed = createHmac(
          'sha256',
          process.env.ENCRYPTION_MASTER_KEY ?? '',
        )
          .update(plain)
          .digest('hex');

        return { plainPassword: plain, hashedPassword: hashed };
      },
    );

    // ── Step 3: Generate keystore inside sandbox ───────────────────────────────
    await step.run('generate-keystore', async () => {
      const sandbox = await Sandbox.connect(sandboxId);

      // Both storepass and keypass are the same generated password.
      // Args match generate-keystore.sh: $1=storepass $2=keypass $3=CN …
      const cmd = [
        'sh /generate-keystore.sh',
        `"${plainPassword}"`,
        `"${plainPassword}"`,
        `"${commonName}"`,
        `"${orgUnit}"`,
        `"${org}"`,
        `"${city}"`,
        `"${state}"`,
        `"${countryCode}"`,
      ].join(' ');

      const result = await sandbox.commands.run(cmd);
      if (result.exitCode !== 0) {
        throw new Error(`keytool failed: ${result.stderr}`);
      }
    });

    // ── Step 4: Read keystore bytes from sandbox ───────────────────────────────
    const keystoreBase64 = await step.run('read-keystore', async () => {
      const sandbox = await Sandbox.connect(sandboxId);
      // files.read() returns a string; request raw bytes via encoding option
      const bytes = await sandbox.files.read('/release.keystore', {
        format: 'bytes',
      });
      // Serialise the Uint8Array so Inngest can checkpoint it
      return Buffer.from(bytes).toString('base64');
    });

    // ── Step 5: Encrypt and persist to DB ─────────────────────────────────────
    await step.run('save-to-db', async () => {
      const keystoreBuffer = Buffer.from(keystoreBase64, 'base64');

      // Prisma Bytes requires Uint8Array<ArrayBuffer> (not SharedArrayBuffer).
      // Explicitly allocating a new ArrayBuffer guarantees the concrete type.
      const encryptedFileBuffer = encrypt(keystoreBuffer);
      const ab = new ArrayBuffer(encryptedFileBuffer.byteLength);
      const encryptedFile = new Uint8Array(ab);
      encryptedFile.set(encryptedFileBuffer);
      const encryptedPassword = encrypt(
        Buffer.from(plainPassword, 'utf-8'),
      ).toString('base64');

      await prisma.keyStore.upsert({
        where: { projectId },
        update: {
          password: encryptedPassword,
          data: encryptedFile,
        },
        create: {
          projectId,
          password: encryptedPassword,
          data: encryptedFile,
        },
      });
    });

    return { projectId, hashedPassword };
  },
);
