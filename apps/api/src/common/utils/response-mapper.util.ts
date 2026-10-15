export class ResponseMapper {
  static mapArray<T, R>(entities: T[], mapperFn: (entity: T) => R): R[] {
    return entities.map(mapperFn);
  }
  static mapSingle<T, R>(entity: T | null | undefined, mapperFn: (entity: T) => R): R | null {
    return entity ? mapperFn(entity) : null;
  }
  static mapPaginated<T, R>(
    data: { data: T[]; total: number; page: number; limit: number },
    mapperFn: (entity: T) => R,
  ): {
    data: R[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    return {
      data: ResponseMapper.mapArray(data.data, mapperFn),
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: Math.ceil(data.total / data.limit),
    };
  }
  static excludeSensitiveFields<T extends Record<string, unknown>>(
    obj: T,
    fieldsToExclude: (keyof T)[],
  ): Omit<T, keyof T> {
    const result = { ...obj };
    fieldsToExclude.forEach((field) => {
      delete result[field];
    });
    return result;
  }
  static pickFields<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    fieldsToPick: K[],
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    fieldsToPick.forEach((field) => {
      if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    });
    return result;
  }
  static transformRelation<T, R>(
    relation: T | null | undefined,
    transformer: (rel: T) => R,
    condition = true,
  ): R | undefined {
    if (!condition || !relation) {
      return undefined;
    }
    return transformer(relation);
  }
  static createSummary<T extends { id: string; createdAt: Date }>(
    entity: T,
    additionalFields: Partial<T> = {},
  ): { id: string; createdAt: Date } & Partial<T> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      ...additionalFields,
    };
  }
}
export function ResponseTransform<T, R>(transformer: (data: T) => R) {
  return (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const result = await method.apply(this, args);
      return transformer(result);
    };
  };
}
export const ResponsePatterns = {
  success: <T>(data: T, message?: string) => ({
    success: true,
    data,
    message,
  }),
  error: (message: string, code?: string) => ({
    success: false,
    message,
    code,
  }),
  paginated: <T>(data: T[], total: number, page: number, limit: number) => ({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }),
  list: <T>(data: T[], count?: number) => ({
    data,
    count: count ?? data.length,
  }),
};
