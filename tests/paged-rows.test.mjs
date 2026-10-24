import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages } from '../src/utils/pagedRows.mjs';
test('loads history beyond API row limits, even below requested page size', async () => {
 const data = Array.from({length:1253},(_,id)=>({id}));
 const rows = await readAllPages(async from => ({data:data.slice(from,from+100)}));
 assert.deepEqual(rows,data);
});
test('never returns partial results as success after a failed page', async () => {
 await assert.rejects(readAllPages(async from => from ? {error:{message:'offline'}} : {data:[{id:1}]}),/offline/);
});
test('unbounded pagination fails visibly rather than freezing or truncating silently', async () => {
 await assert.rejects(readAllPages(async () => ({data:[{}]}),3),/Too many records/);
});
