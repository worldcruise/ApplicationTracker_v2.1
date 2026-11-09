import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile('Baseline/SpeedyApply/chunks/globals-BIOuRv6A.js', 'utf8');
const values = {};
for (const [key, name] of [['degrees', 'mx'], ['countries', 'Sx'], ['genders', 'bx'], ['ethnicities', 'xx'], ['proficiencies', 'gx']]) {
  const match = source.match(new RegExp(`\\b${name}=(\\[[^\\]]*\\])`));
  if (!match) throw new Error(`SpeedyApply ${key} were not found.`);
  values[key] = vm.runInNewContext(match[1], {}, { timeout: 1000 });
}
const languages = source.match(/\bhx=`([^`]*)`/);
if (!languages) throw new Error('SpeedyApply languages were not found.');
values.languages = languages[1].split('.');
await writeFile('extension/studio/profile-values.js', `// Values from the supplied SpeedyApply 2.28.2 profile schema.\nexport const profileValues = ${JSON.stringify(values, null, 2)};\n`);
