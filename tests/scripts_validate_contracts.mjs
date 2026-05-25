import fs from 'fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv2020({allErrors: true, strict: false});
addFormats(ajv);

const checks = [
  ['packages/contracts/schemas/agent-activity.v1.json','packages/contracts/examples/agent-activity.valid.json',true],
  ['packages/contracts/schemas/agent-activity.v1.json','packages/contracts/examples/agent-activity.invalid.json',false],
  ['packages/contracts/schemas/task.v1.json','packages/contracts/examples/task.valid.json',true],
  ['packages/contracts/schemas/task.v1.json','packages/contracts/examples/task.invalid.json',false],
  ['packages/contracts/schemas/run.v1.json','packages/contracts/examples/run.valid.json',true],
  ['packages/contracts/schemas/run.v1.json','packages/contracts/examples/run.invalid.json',false],
  ['packages/contracts/schemas/step.v1.json','packages/contracts/examples/step.valid.json',true],
  ['packages/contracts/schemas/step.v1.json','packages/contracts/examples/step.invalid.json',false],
  ['packages/contracts/schemas/artifact.v1.json','packages/contracts/examples/artifact.valid.json',true],
  ['packages/contracts/schemas/artifact.v1.json','packages/contracts/examples/artifact.invalid.json',false],
  ['packages/contracts/schemas/bug-report.v1.json','packages/contracts/examples/bug-report.valid.json',true],
  ['packages/contracts/schemas/bug-report.v1.json','packages/contracts/examples/bug-report.invalid.json',false],
  ['packages/contracts/schemas/budget-incident.v1.json','packages/contracts/examples/budget-incident.valid.json',true],
  ['packages/contracts/schemas/budget-incident.v1.json','packages/contracts/examples/budget-incident.invalid.json',false],
  ['packages/contracts/schemas/goal.v1.json','packages/contracts/examples/goal.valid.json',true],
  ['packages/contracts/schemas/goal.v1.json','packages/contracts/examples/goal.invalid.json',false],
  ['packages/contracts/schemas/execution.v1.json','packages/contracts/examples/execution.valid.json',true],
  ['packages/contracts/schemas/execution.v1.json','packages/contracts/examples/execution.invalid.json',false],
  ['packages/contracts/schemas/execution-lock.v1.json','packages/contracts/examples/execution-lock.valid.json',true],
  ['packages/contracts/schemas/execution-lock.v1.json','packages/contracts/examples/execution-lock.invalid.json',false],
  ['packages/contracts/schemas/preflight.v1.json','packages/contracts/examples/preflight.valid.json',true],
  ['packages/contracts/schemas/preflight.v1.json','packages/contracts/examples/preflight.invalid.json',false],
  ['packages/contracts/schemas/approval.v1.json','packages/contracts/examples/approval.valid.json',true],
  ['packages/contracts/schemas/approval.v1.json','packages/contracts/examples/approval.invalid.json',false],
  ['packages/contracts/schemas/event.v1.json','packages/contracts/examples/event.valid.json',true],
  ['packages/contracts/schemas/event.v1.json','packages/contracts/examples/event.invalid.json',false],
  ['packages/contracts/schemas/heartbeat.v1.json','packages/contracts/examples/heartbeat.valid.json',true],
  ['packages/contracts/schemas/heartbeat.v1.json','packages/contracts/examples/heartbeat.invalid.json',false],
  ['packages/contracts/schemas/connector-reference.v1.json','packages/contracts/examples/connector-reference.valid.json',true],
  ['packages/contracts/schemas/connector-reference.v1.json','packages/contracts/examples/connector-reference.invalid.json',false],
  ['packages/contracts/schemas/audit.v1.json','packages/contracts/examples/audit.valid.json',true],
  ['packages/contracts/schemas/audit.v1.json','packages/contracts/examples/audit.invalid.json',false],
  ['packages/contracts/schemas/observability.v1.json','packages/contracts/examples/observability.valid.json',true],
  ['packages/contracts/schemas/observability.v1.json','packages/contracts/examples/observability.invalid.json',false],
  ['packages/contracts/schemas/capabilities.v1.json','packages/contracts/examples/capabilities.valid.json',true],
  ['packages/contracts/schemas/capabilities.v1.json','packages/contracts/examples/capabilities.invalid.json',false],
  ['packages/contracts/schemas/verification.v1.json','packages/contracts/examples/verification.valid.json',true],
  ['packages/contracts/schemas/verification.v1.json','packages/contracts/examples/verification.invalid.json',false],
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
