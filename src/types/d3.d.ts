/* Types for the d3 members this rebuild actually imports.
 *
 * d3 is a declared dependency (package.json, 7.9.0) and ships no types of its own; the types
 * live in `@types/d3`, which is NOT installed, and a new dependency is out of scope for Task 4.
 * Declaring the handful of members we call is the narrow alternative - and narrow on purpose:
 * an untyped `declare module 'd3'` would make every d3 call `any`, which is how a typo in a
 * selector or an accessor reaches the browser instead of the compiler.
 *
 * WHY d3 AT ALL, rather than Intl.NumberFormat or toFixed. `fmt` must produce byte-identical
 * strings to the original's `d3.format(',.' + d + 'f')`, and d3-format 3.x renders a negative
 * number with U+2212 MINUS SIGN, not the ASCII hyphen that toFixed and Intl both emit. The
 * typology tile's mean SUHI can go negative when the year slider back-casts, so that one
 * character is a visible fidelity difference. Reimplementing the formatter to match would be
 * strictly more code and strictly more risk than calling the library the original called.
 *
 * ADDITIVE FILE. Later tasks need geoBounds, geoGraticule, scaleLinear, json and the rest;
 * extend this file as they go rather than widening any of these signatures.
 */

declare module 'd3' {
  /** d3-array. Returns 0 for an empty or all-undefined input, which is load-bearing: the KPI
   * totals read 0 under an empty filter rather than NaN. */
  export function sum<T>(iterable: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | null | undefined): number;

  /** d3-array. Returns UNDEFINED for an empty input - the `—` in the typology tile. */
  export function mean<T>(iterable: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | null | undefined): number | undefined;

  /** d3-array. UNDEFINED for an empty input, which is why `popScale` falls back to `|| 1`:
   * a `[0, undefined]` domain makes every radius NaN. */
  export function max<T>(iterable: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | null | undefined): number | undefined;

  /** d3-format. `format(',.2f')(x)` groups thousands with ',' and fixes 2 decimals. */
  export function format(specifier: string): (n: number) => string;

  /** d3-scale, the chainable subset `popScale` uses. Declared as its own interface rather than
   * inlined because the setters return the scale, so the type has to be self-referential.
   * SQRT, not linear: the circles encode value as AREA, so the radius is the square root. */
  export interface PowerScale {
    (value: number): number;
    domain(domain: readonly number[]): PowerScale;
    range(range: readonly number[]): PowerScale;
  }
  export function scaleSqrt(): PowerScale;
}
