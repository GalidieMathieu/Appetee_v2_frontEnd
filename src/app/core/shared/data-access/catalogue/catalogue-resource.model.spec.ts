import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { catalogueRecord } from './catalogue-resource.model';
describe('E002 catalogue wire contract', () => {
    function response(etag: string | null, id = 42) { return new HttpResponse({ body: { resource: { id, name: 'Resource' }, resourceVersion: '9007199254740993', createdByUserId: null, updatedByUserId: 1 }, headers: etag ? new HttpHeaders({ ETag: etag }) : new HttpHeaders() }); }
    it('preserves exact quoted ETag and string version without number coercion', () => { const record = catalogueRecord(response('"catalog-recipe-42-v9007199254740993"'), 'recipe', 42); expect(record.etag).toBe('"catalog-recipe-42-v9007199254740993"'); expect(record.resourceVersion).toBe('9007199254740993'); });
    it.each([null, '*', 'W/"catalog-recipe-42-v1"', '"catalog-ingredient-42-v1"', '"catalog-recipe-99-v1"', '"catalog-recipe-42-v1", "catalog-recipe-42-v2"'])('rejects missing, weak, wildcard or foreign-resource ETag %s', etag => { expect(() => catalogueRecord(response(etag), 'recipe', 42)).toThrow(); });
    it('rejects an unexpected resource ID and missing server metadata', () => { expect(() => catalogueRecord(response('"catalog-recipe-42-v1"'), 'recipe', 99)).toThrow(); expect(() => catalogueRecord(new HttpResponse({ body: { resource: { id: 42 } } as any, headers: new HttpHeaders({ ETag: '"catalog-recipe-42-v1"' }) }), 'recipe', 42)).toThrow(); });
});
