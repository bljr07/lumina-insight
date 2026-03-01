import fs from 'fs';
const file = 'test/unit/shared/packet.test.js';
let content = fs.readFileSync(file, 'utf8');

// The indentation is exactly 6 spaces in the metrics object
content = content.replace(/tab_switches: (\d+),/g, 'tab_switches: $1,\n      re_read_cycles: 0,');
content = content.replace(/tab_switches: -1,/g, 'tab_switches: -1,\n      re_read_cycles: 0,');
content = content.replace(/tab_switches: 1.5,/g, 'tab_switches: 1.5,\n      re_read_cycles: 0,');
// Additionally, add tests specifically for re_read_cycles
// But for now just fix the schema for existing tests. Wait, there is also the array of fields:
content = content.replace(/toHaveLength\(4\)/g, 'toHaveLength(5)');

// Also replace the exact object in the first test
content = content.replace(/          tab_switches: 0,\n      },\n      inferred_state: LearningState.PENDING_LOCAL_AI,/g, 
  '        tab_switches: 0,\n        re_read_cycles: 0,\n      },\n      inferred_state: LearningState.PENDING_LOCAL_AI,');
  // the indentation of the expected output is 8 spaces
content = content.replace(
  /        mouse_jitter: 0.45,\n        tab_switches: 0,\n      },\n      inferred_state: LearningState\.PENDING_LOCAL_AI,/g,
  '        mouse_jitter: 0.45,\n        tab_switches: 0,\n        re_read_cycles: 0,\n      },\n      inferred_state: LearningState.PENDING_LOCAL_AI,'
);

fs.writeFileSync(file, content);
console.log('Update Complete');
