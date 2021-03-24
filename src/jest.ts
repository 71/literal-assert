import { assert as emptyAssert } from "./lib";

/**
 * Performs the given assertion, delegating assertions to [`jest`](
 * https://jestjs.io).
 */
export const assert = emptyAssert
  .withPattern("_ is _", ([a, b]) => expect(a).toBe(b))
  .withPattern("_ are _", ([a, b]) => expect(a).toBe(b))
  .withPattern("_ is null", ([a]) => expect(a).toBeNull())
  .withPattern("_ is undefined", ([a]) => expect(a).toBeUndefined())
  .withPattern("_ is empty", ([a]) => expect(a.length).toBe(0))

  .withInfixOperator(/(is|are)(n't| not)/, ([a, b]) => expect(a).not.toBe(b))

  .withPattern("_ === ...", ([a, ...bs]) => {
    bs.forEach((b) => expect(a).toStrictEqual(b));
  })
  .withPattern("_ !== ...", (values) => {
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        expect(values[i]).not.toStrictEqual(values[j]);
      }
    }
  })
  .withPattern("_ == _", ([a, b]) => expect(a).toEqual(b))
  .withPattern("_ != _", ([a, b]) => expect(a).not.toEqual(b))
;
