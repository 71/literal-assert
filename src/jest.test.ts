/* eslint-disable max-len */
import { assert } from "./jest";

test("basic", () => {
  // Expressions can be mixed in with JavaScript:
  assert`${2 + 2} is 4`;
  assert`${21 * 2} is ${84} / 2`;
  assert`" is ".slice(1, 3) is ${"is"}`;

  // Arbitrary RegExps can be used:
  assert`${"foo"} isn't "bar"`;
  assert`false is not true`;

  expect(() => assert`${1} === ${2}`).toThrowErrorMatchingInlineSnapshot(`
    "expect(received).toStrictEqual(expected) // deep equality

    Expected: 2
    Received: 1"
  `);

  expect(() => assert`{} is null`).toThrowErrorMatchingInlineSnapshot(`
    "expect(received).toBeNull()

    Received: {}"
  `);

  expect(() => assert`{} is null`).toThrowErrorMatchingInlineSnapshot(`
    "expect(received).toBeNull()

    Received: {}"
  `);

  expect(() => assert`[10] is empty`).toThrowErrorMatchingInlineSnapshot(`
    "expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1"
  `);

  expect(() => assert`${[10]}.length is 0`).toThrowErrorMatchingInlineSnapshot(`
    "expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1"
  `);
});
