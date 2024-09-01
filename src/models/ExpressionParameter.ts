export type CommonParameterProps = {
  name: string,
  label: string,
  description: string,
  hidden?: boolean,
}

export type FloatParameter = CommonParameterProps & {
  type: "float",
  subtype?: "angle",
  value: number,
  defaultValue: number,
  minimum?: number,
  maximum?: number,
  softMinimum?: number,
  softMaximum?: number,
}

export type IntegerParameter = CommonParameterProps & {
  type: "integer",
  value: number,
  defaultValue: number,
  minimum?: number,
  maximum?: number,
  softMinimum?: number,
  softMaximum?: number,
}

export type StringParameter = CommonParameterProps & {
  type: "string",
  value: string,
  defaultValue: string,
}

export type EnumParameter = CommonParameterProps & {
  type: "enum",
  value: number,
  defaultValue: number,
  options: { label: string, value: number }[],
}

/**
 * Users may declare public parameters that are exposed in the Growth Model
 * Editor and whose value can be retrieved in expressions.
 */
export type Parameter =
  | FloatParameter
  | IntegerParameter
  | StringParameter
  | EnumParameter
