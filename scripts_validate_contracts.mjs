import fs from 'fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv2020({allErrors: true, strict: false});
addFormats(ajv);

const checks = [
  ['packages/contracts/schemas/task.v1.json','packages/contracts/examples/task.valid.json',true],
  ['packages/contracts/schemas/task.v1.json','packages/contracts/examples/task.invalid.json',false],
  ['packages/contracts/schemas/run.v1.json','packages/contracts/examples/run.valid.json',true],
  ['packages/contracts/schemas/run.v1.json','packages/contracts/examples/run.invalid.json',false],
  ['packages/contracts/schemas/preflight.v1.json','packages/contracts/examples/preflight.valid.json',true],
  ['packages/contracts/schemas/preflight.v1.json','packages/contracts/examples/preflight.invalid.json',false],
  ['packages/contracts/schemas/approval.v1.json','packages/contracts/examples/approval.valid.json',true],
  ['packages/contracts/schemas/approval.v1.json','packages/contracts/examples/approval.invalid.json',false],
];

let failed = false;
for (const [schemaPath,dataPath,expected] of checks) {
  const schema = JSON.parse(fs.readFileSync(schemaPath,'utf8'));
  const data = JSON.parse(fs.readFileSync(dataPath,'utf8'));
  const validate = ajv.compile(schema);
  const result = validate(data);
  if (result !== expected) {
    failed = true;
    console.error(`FAIL ${dataPath} against ${schemaPath}: expected ${expected}, got ${result}`);
    if (validate.errors) console.error(validate.errors);
  } else {
    console.log(`PASS ${dataPath} expected=${expected}`);
  }
}
if (failed) process.exit(1);
