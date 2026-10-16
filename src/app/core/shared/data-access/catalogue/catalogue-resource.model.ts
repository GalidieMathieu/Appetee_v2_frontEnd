import { HttpResponse } from '@angular/common/http';
export interface CatalogueResource<T> {
    readonly resource: T;
    readonly resourceVersion: string;
    readonly createdByUserId: number | null;
    readonly updatedByUserId: number | null;
}
export interface CatalogueRecord<T> extends CatalogueResource<T> {
    readonly etag: string;
}
export function catalogueRecord<T extends {
    id: number;
}>(response: HttpResponse<CatalogueResource<T>>, kind: 'recipe' | 'ingredient', expectedId?: number): CatalogueRecord<T> {
    const body = response.body;
    const etag = response.headers.get('ETag');
    if (!body || !body.resource || !Number.isInteger(body.resource.id) || body.resource.id < 1 || expectedId !== undefined && body.resource.id !== expectedId
        || typeof body.resourceVersion !== 'string' || !/^[1-9]\d*$/.test(body.resourceVersion)
        || ![body.createdByUserId, body.updatedByUserId].every(id => id === null || typeof id === 'number' && Number.isInteger(id) && id > 0)
        || !etag || !new RegExp('^"catalog-' + kind + '-' + body.resource.id + '-v[1-9][0-9]*"$').test(etag)) {
        throw new Error('The administrative API returned an invalid resource or missing ETag. Reload before continuing.');
    }
    // Retain the exact response header. Never synthesize a token from the version.
    return { ...body, etag };
}
