export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

export type StringKeys<T> = Extract<keyof T, string>
