/**
 * Generic entity-cache tests protect per-ID state, invalidation tokens, and identity resets.
 * Domain caches inherit these concurrency guarantees without duplicating their implementation.
 */
import { EntityCacheStore } from './entity-cache-store';

interface TestEntity {
  id: number;
  name: string;
}

class TestEntityCacheStore extends EntityCacheStore<TestEntity> {}

describe('EntityCacheStore', () => {
  it('tracks complete entities and request state independently by id', () => {
    const store = new TestEntityCacheStore();

    store.setLoading(1);
    store.setError(2, 'not found');
    store.upsert({ id: 1, name: 'one' });

    expect(store.get(1)).toEqual({ id: 1, name: 'one' });
    expect(store.requestState(1)).toEqual({ status: 'success', error: null });
    expect(store.requestState(2)).toEqual({ status: 'error', error: 'not found' });
  });

  it('invalidates one entity without clearing unrelated entities', () => {
    const store = new TestEntityCacheStore();
    store.upsert({ id: 1, name: 'one' });
    store.upsert({ id: 2, name: 'two' });

    store.invalidate(1);

    expect(store.get(1)).toBeNull();
    expect(store.requestState(1).status).toBe('idle');
    expect(store.get(2)).toEqual({ id: 2, name: 'two' });
    expect(store.invalidationVersion(1)).toBe(1);
    expect(store.invalidationVersion(2)).toBe(0);
  });

  it('recognizes only requests from the current identity and per-ID version', () => {
    const store = new TestEntityCacheStore();
    const generation = store.generation();
    const invalidationVersion = store.invalidationVersion(1);

    expect(store.isRequestCurrent(1, generation, invalidationVersion)).toBe(true);
    store.invalidate(1);
    expect(store.isRequestCurrent(1, generation, invalidationVersion)).toBe(false);
  });

  it('clears every entity and request state on reset', () => {
    const store = new TestEntityCacheStore();
    store.upsert({ id: 1, name: 'one' });
    store.setLoading(2);

    store.reset();

    expect(store.entitiesById()).toEqual({});
    expect(store.requestById()).toEqual({});
    expect(store.invalidationVersion(1)).toBe(0);
  });
});
