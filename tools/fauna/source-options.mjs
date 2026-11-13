import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

/** Validate the explicit source before creating an empty output directory. Never overwrite artifacts. */
export function readSourceOptions(description) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      'source-sha256': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(`${description}\nnode SCRIPT --input SOURCE.glb --output NEW_DIRECTORY --source-sha256 EXPECTED_SHA256\nThe output directory must be empty. See tools/fauna/README.md for source hashes and limits.`);
    process.exit(0);
  }
  if (!values.input || !values.output || !values['source-sha256']) {
    throw new Error('Required: --input SOURCE.glb --output NEW_DIRECTORY --source-sha256 EXPECTED_SHA256');
  }
  const expected = values['source-sha256'].toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('--source-sha256 must contain exactly 64 hexadecimal characters');
  const input = path.resolve(values.input), output = path.resolve(values.output);
  if (!fs.statSync(input).isFile()) throw new Error('Source must be a regular GLB file');
  const source = fs.readFileSync(input);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  if (sourceHash !== expected) throw new Error(`Source hash mismatch: expected ${expected}; received ${sourceHash}`);
  if (source.length < 28 || source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2 || source.readUInt32LE(8) !== source.length) {
    throw new Error('Source must be a complete glTF 2.0 binary');
  }
  if (fs.existsSync(output) && (!fs.statSync(output).isDirectory() || fs.readdirSync(output).length !== 0)) {
    throw new Error('Output must be a new or empty directory; existing artifacts will not be overwritten');
  }
  fs.mkdirSync(path.join(output, 'qa'), { recursive: true });
  fs.mkdirSync(path.join(output, 'candidates'), { recursive: true });
  return { input, output, source, sourceHash };
}
