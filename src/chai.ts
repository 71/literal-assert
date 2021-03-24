import { assert as Assert } from "chai";
import { message } from "./internal/print";
import { assert as emptyAssert } from "./lib";

function expr(string: string) {
  return message`in expression "${string}"`;
}

/**
 * Performs the given assertion, delegating assertions to [`chai`](
 * https://www.chaijs.com).
 */
export const assert = emptyAssert
  .withPattern("_ === ...", ([a, ...bs], [_, ax, ...bxs]) =>
    bs.forEach((b, i) => Assert.strictEqual(a, b, expr(`${ax} === ${bxs[i]}`))))
  .withPattern("_ !== ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i < vs.length; i++) {
      for (let j = i + 1; j < vs.length; j++) {
        Assert.notStrictEqual(vs[i], vs[j], expr(`${vxs[i]} !== ${vxs[j]}`));
      }
    }
  })

  .withPattern("_ == ...", ([a, ...bs], [_, ax, ...bxs]) =>
    bs.forEach((b, i) => Assert.equal(a, b, expr(`${ax} == ${bxs[i]}`))))
  .withPattern("_ != ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i < vs.length; i++) {
      for (let j = i + 1; j < vs.length; j++) {
        Assert.notEqual(vs[i], vs[j], expr(`${vxs[i]} != ${vxs[j]}`));
      }
    }
  })

  .withPattern("_ < ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i + 1 < vs.length; i++) {
      Assert.isBelow(vs[i], vs[i + 1], expr(`${vxs[i]} < ${vxs[i + 1]}`));
    }
  })
  .withPattern("_ <= ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i + 1 < vs.length; i++) {
      Assert.isAtMost(vs[i], vs[i + 1], expr(`${vxs[i]} <= ${vxs[i + 1]}`));
    }
  })
  .withPattern("_ > ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i + 1 < vs.length; i++) {
      Assert.isAbove(vs[i], vs[i + 1], expr(`${vxs[i]} > ${vxs[i + 1]}`));
    }
  })
  .withPattern("_ >= ...", (vs, [_, ...vxs]) => {
    for (let i = 0; i + 1 < vs.length; i++) {
      Assert.isAtLeast(vs[i], vs[i + 1], expr(`${vxs[i]} >= ${vxs[i + 1]}`));
    }
  })

  .withPattern("_ matches _", ([s, re], [_, sx]) =>
    Assert.match(s, re, expr(`${sx} matches ${re}`)))
  .withInfixOperator(/does(?:n't| not) match/, ([s, re], [_, sx]) =>
    Assert.notMatch(s, re, expr(`${sx} does not match ${re}`)))

  .withPattern(/(.+?) has (.+?) (items?)/, ([_, arr, len, end], embed) =>
    `${embed(Assert)}.lengthOf(${arr}, ${len}, ${
      JSON.stringify(expr(`${arr} has ${len} ${end}`))})`)
;
