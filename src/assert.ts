import * as Assert from "assert";
import { assert as emptyAssert } from "./lib";

/**
 * Performs the given assertion, delegating assertions to the Node.js
 * [`assert`](https://nodejs.org/api/assert.html) module.
 */
export const assert = emptyAssert
  .withPattern("_ === ...", ([a, ...bs]) => bs.forEach((b) => Assert.strictEqual(a, b)))
  .withPattern("_ !== ...", (values) => {
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        Assert.notStrictEqual(values[i], values[j]);
      }
    }
  })

  .withPattern("_ ==== ...", ([a, ...bs]) => bs.forEach((b) => Assert.deepStrictEqual(a, b)))
  .withPattern("_ !=== ...", (values) => {
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        Assert.notDeepStrictEqual(values[i], values[j]);
      }
    }
  })

  .withPattern("_ matches _", ([a, b]) => Assert.match(a, b))
  .withInfixOperator(/does(?:n't| not) match/, ([a, b]) => Assert.doesNotMatch(a, b))

  .withPattern("_ throws", ([f]) => Assert.throws(f))
  .withPattern("_ throws _", ([f, err]) => Assert.throws(f, err))
;
