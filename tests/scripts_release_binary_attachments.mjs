import {
  DEFAULT_RELEASE_BINARY_ATTACHMENT_PLAN_OUTPUT,
  writeReleaseBinaryAttachmentPlan
} from '../packages/release-artifacts/src/index.mjs';

function parseArgs(values) {
  const options = {
    output: DEFAULT_RELEASE_BINARY_ATTACHMENT_PLAN_OUTPUT
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--') {
      continue;
    } else if (value === '--output') {
      options.output = next;
      index += 1;
    } else if (value.startsWith('--output=')) {
      options.output = value.slice('--output='.length);
    } else {
      throw new Error(`unknown release binary attachment option: ${value}`);
    }
  }

  return options;
}

const result = writeReleaseBinaryAttachmentPlan(parseArgs(process.argv.slice(2)));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
