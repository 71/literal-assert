/* eslint-disable max-len,comma-dangle */
import { assert } from "./assert";

test("basic", () => {
  expect(() => assert`${1} === ${2}`).toThrowErrorMatchingInlineSnapshot(`
    "Expected values to be strictly equal:

    1 !== 2
    "
  `);

  assert`${"foo"} matches /^\w+$/`;
  expect(() => assert`${"not foo"} matches /^\w+$/`)
    .toThrowErrorMatchingInlineSnapshot(`
    "The input did not match the regular expression /^\\\\w+$/. Input:

    'not foo'
    "
  `);

  assert`${"not foo"} doesn't match /^\w+$/`;
  assert`${"not foo"} does not match /^\w+$/`;

  assert`${() => assert`1 === 2`} throws`;
  assert`${() => new Function("#")} throws ${SyntaxError}`;
});
