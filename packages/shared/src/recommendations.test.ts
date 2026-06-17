import assert from 'node:assert/strict';
import { recommendAgentResourceIds } from './recommendations';

const resources = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'skill',
    name: '文件解析',
    config: { key: 'file-parse', description: '解析用户上传的文本类文件内容' },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    type: 'skill',
    name: '总结',
    config: { key: 'summarize', description: '对长文本进行结构化总结' },
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    type: 'skill',
    name: '网络检索',
    config: { key: 'web-search', description: '检索网络信息（占位，MVP 暂不执行真实检索）' },
  },
] as const;

const recommended = recommendAgentResourceIds('分析用户上传的竞品脚本，并总结爆款规律', resources);

assert.deepEqual(recommended.skillIds, [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
]);
