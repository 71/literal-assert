/* eslint-disable max-len,comma-dangle */
import { assert } from "./chai";

test("basic", () => {
  expect(() => assert`${1} === ${2}`).toThrowErrorMatchingInlineSnapshot(
    `"in expression \\"(value #0) === (value #1)\\": expected 1 to equal 2"`
  );

  expect(
    () => assert`${[1, 2, 3]} has 2 items`
  ).toThrowErrorMatchingInlineSnapshot(
    `"in expression \\"(value #0) has 2 items\\": expected [ 1, 2, 3 ] to have a length of 2 but got 3"`
  );

  assert`${"foo"} matches /^\w+$/`;
  expect(
    () => assert`${"not foo"} matches /^\w+$/`
  ).toThrowErrorMatchingInlineSnapshot(
    `"in expression \\"(value #0) matches /^\\\\w+$/\\": expected 'not foo' to match /^\\\\w+$/"`
  );

  assert`${"not foo"} doesn't match /^\w+$/`;
  assert`${"not foo"} does not match /^\w+$/`;
});
