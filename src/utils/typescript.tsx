
// Inspired from https://github.com/microsoft/TypeScript/issues/30611#issuecomment-570773496
export function getEnumKeys<
    T extends string,
    TEnumValue extends string | number,
>(enumVariable: { [key in T]: TEnumValue }) {
    return Object.keys(enumVariable).filter(v => isNaN(Number(v))) as Array<T>;
}
