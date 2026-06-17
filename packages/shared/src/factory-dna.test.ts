import assert from 'node:assert/strict';
import { FACTORY_DNA } from './factory-dna';

assert.equal(FACTORY_DNA.identity, 'Agent Factory');
assert.ok(FACTORY_DNA.rules.some((rule) => rule.includes('不生成空占位配置')));
assert.ok(FACTORY_DNA.skills.includes('需求澄清'));
assert.ok(FACTORY_DNA.permissions.some((permission) => permission.includes('用户确认')));
