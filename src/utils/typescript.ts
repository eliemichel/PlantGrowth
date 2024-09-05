export type StandardEnum<T> = {
    [name: string]: T | string;
    [value: number]: string;
}

// Inspired from https://github.com/microsoft/TypeScript/issues/30611#issuecomment-570773496
export function getEnumKeys<
    T extends string,
    TEnumValue extends string | number,
>(enumVariable: { [key in T]: TEnumValue }) {
    return Object.keys(enumVariable).filter(v => isNaN(Number(v))) as Array<T>;
}

export function isKeyOfObject<T extends object>(
  key: string | number | symbol,
  obj: T,
): key is keyof T {
    return key in obj;
}

// Similar to 'keyof T' except that 'KeysOfType<T,Foo>' only returns keys that have type Foo
export type KeysOfType<T extends object, KeyType> = {
    [K in keyof T]: T[K] extends KeyType ? K : never
}[keyof T];

export function validateEnumValue<
    Enum,
    EnumVariable extends StandardEnum<Enum>,
>(name: string, enumVariable: EnumVariable, fallback: number = 0): number {
    const value = enumVariable[name];
    return typeof value === 'number' ? value : fallback;
}

