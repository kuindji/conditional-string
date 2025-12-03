import { describe, expect, test } from "bun:test";
import {
    conditionalString,
    type ConditionalStringResult,
} from "../src/conditionalString";

// ============================================================================
// Type-level tests (compile-time verification)
// ============================================================================

// Helper type to assert two types are exactly equal
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends
    <T>() => T extends Y ? 1
        : 2 ? true
    : false;

// Test: basic truthy condition includes content
type Test1 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:flag*/WHERE a=1/*endif*/",
            { flag: true; }
        >,
        "SELECT * WHERE a=1"
    >
>;

// Test: basic falsy condition removes content
type Test2 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:flag*/WHERE a=1/*endif*/",
            { flag: false; }
        >,
        "SELECT * "
    >
>;

// Test: missing key is falsy
type Test3 = Expect<
    Equal<
        ConditionalStringResult<"SELECT * /*if:flag*/WHERE a=1/*endif*/", {}>,
        "SELECT * "
    >
>;

// Test: negation - falsy value includes content
type Test4 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:!flag*/WHERE a=1/*endif*/",
            { flag: false; }
        >,
        "SELECT * WHERE a=1"
    >
>;

// Test: negation - truthy value removes content
type Test5 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:!flag*/WHERE a=1/*endif*/",
            { flag: true; }
        >,
        "SELECT * "
    >
>;

// Test: dot notation for nested property
type Test6 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:user.isAdmin*/WHERE admin=1/*endif*/",
            { user: { isAdmin: true; }; }
        >,
        "SELECT * WHERE admin=1"
    >
>;

// Test: nested conditions - both truthy
type Test7 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: true; b: true; }
        >,
        "SELECT A B"
    >
>;

// Test: nested conditions - outer truthy, inner falsy
type Test8 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: true; b: false; }
        >,
        "SELECT A "
    >
>;

// Test: nested conditions - outer falsy removes all
type Test9 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: false; b: true; }
        >,
        "SELECT "
    >
>;

// Test: multiple independent conditions
type Test10 = Expect<
    Equal<
        ConditionalStringResult<
            "SELECT * /*if:a*/A/*endif*/ /*if:b*/B/*endif*/",
            { a: true; b: false; }
        >,
        "SELECT * A "
    >
>;

// Type tests are verified at compile time - if any fail, TypeScript will error.
// The array assignment ensures the types are evaluated.
export const typeTests: [
    Test1,
    Test2,
    Test3,
    Test4,
    Test5,
    Test6,
    Test7,
    Test8,
    Test9,
    Test10,
] = [ true, true, true, true, true, true, true, true, true, true ];

// ============================================================================
// Runtime tests
// Note: We cast to string in expects to avoid type-level validation conflicts
// since runtime tests use non-literal strings that widen to `string`
// ============================================================================

describe("conditionalString", () => {
    describe("basic conditional", () => {
        test("should include content when condition is truthy", () => {
            const template =
                "SELECT * FROM users WHERE 1=1 /*if:includeDeleted*/AND deleted = false/*endif*/";
            const result = conditionalString(
                template,
                {
                    includeDeleted: true,
                } as const,
            );
            expect(result).toBe(
                "SELECT * FROM users WHERE 1=1 AND deleted = false",
            );
        });

        test("should exclude content when condition is falsy", () => {
            const template =
                "SELECT * FROM users WHERE 1=1 /*if:includeDeleted*/AND deleted = false/*endif*/";
            const result = conditionalString(
                template,
                {
                    includeDeleted: false,
                } as const,
            );
            expect(result).toBe("SELECT * FROM users WHERE 1=1 ");
        });

        test("should exclude content when condition key is missing", () => {
            const template =
                "SELECT * FROM users WHERE 1=1 /*if:includeDeleted*/AND deleted = false/*endif*/";
            const result = conditionalString(template, {});
            expect(result).toBe("SELECT * FROM users WHERE 1=1 ");
        });

        test("should handle empty data object", () => {
            const template =
                "SELECT * FROM users /*if:flag*/WHERE active = true/*endif*/";
            const result = conditionalString(template, {});
            expect(result).toBe("SELECT * FROM users ");
        });
    });

    describe("negation", () => {
        test("should include content when negated condition is falsy", () => {
            const template =
                "SELECT * FROM users /*if:!skipDeleted*/WHERE deleted = false/*endif*/";
            const result = conditionalString(template, { skipDeleted: false } as const);
            expect(result).toBe("SELECT * FROM users WHERE deleted = false");
        });

        test("should exclude content when negated condition is truthy", () => {
            const template =
                "SELECT * FROM users /*if:!skipDeleted*/WHERE deleted = false/*endif*/";
            const result = conditionalString(template, { skipDeleted: true } as const);
            expect(result).toBe("SELECT * FROM users ");
        });

        test("should include content when negated condition key is missing", () => {
            const template =
                "SELECT * FROM users /*if:!skipDeleted*/WHERE deleted = false/*endif*/";
            const result = conditionalString(template, {});
            expect(result).toBe("SELECT * FROM users WHERE deleted = false");
        });
    });

    describe("dot notation (nested properties)", () => {
        test("should resolve nested property", () => {
            const template =
                "SELECT * FROM orders /*if:user.isAdmin*/WHERE status = 'all'/*endif*/";
            const result = conditionalString(
                template,
                {
                    user: { isAdmin: true },
                } as const,
            );
            expect(result).toBe("SELECT * FROM orders WHERE status = 'all'");
        });

        test("should handle missing nested property", () => {
            const template =
                "SELECT * FROM orders /*if:user.isAdmin*/WHERE status = 'all'/*endif*/";
            const result = conditionalString(template, { user: {} });
            expect(result).toBe("SELECT * FROM orders ");
        });

        test("should handle missing parent object", () => {
            const template =
                "SELECT * FROM orders /*if:user.isAdmin*/WHERE status = 'all'/*endif*/";
            const result = conditionalString(template, {});
            expect(result).toBe("SELECT * FROM orders ");
        });

        test("should handle deeply nested property", () => {
            const template =
                "SELECT * FROM data /*if:config.features.beta.enabled*/WHERE beta = true/*endif*/";
            const result = conditionalString(
                template,
                {
                    config: { features: { beta: { enabled: true } } },
                } as const,
            );
            expect(result).toBe("SELECT * FROM data WHERE beta = true");
        });

        test("should handle negated nested property", () => {
            const template =
                "SELECT * FROM orders /*if:!user.isGuest*/WHERE user_id IS NOT NULL/*endif*/";
            const result = conditionalString(
                template,
                {
                    user: { isGuest: false },
                } as const,
            );
            expect(result).toBe(
                "SELECT * FROM orders WHERE user_id IS NOT NULL",
            );
        });
    });

    describe("nested conditions", () => {
        test("should handle nested conditions (both truthy)", () => {
            const template =
                "SELECT * /*if:a*/FROM users /*if:b*/WHERE active = true/*endif*//*endif*/";
            const result = conditionalString(template, { a: true, b: true } as const);
            expect(result).toBe("SELECT * FROM users WHERE active = true");
        });

        test("should handle nested conditions (outer truthy, inner falsy)", () => {
            const template =
                "SELECT * /*if:a*/FROM users /*if:b*/WHERE active = true/*endif*//*endif*/";
            const result = conditionalString(template, { a: true, b: false } as const);
            expect(result).toBe("SELECT * FROM users ");
        });

        test("should handle nested conditions (outer falsy)", () => {
            const template =
                "SELECT * /*if:a*/FROM users /*if:b*/WHERE active = true/*endif*//*endif*/";
            const result = conditionalString(template, { a: false, b: true } as const);
            expect(result).toBe("SELECT * ");
        });
    });

    describe("multiple conditions in same template", () => {
        test("should process multiple independent conditions", () => {
            const template = `
                SELECT *
                FROM users
                WHERE 1=1
                /*if:filterActive*/AND active = true/*endif*/
                /*if:filterVerified*/AND verified = true/*endif*/
                /*if:filterAdmin*/AND role = 'admin'/*endif*/
            `;
            const result = conditionalString(
                template,
                {
                    filterActive: true,
                    filterVerified: false,
                    filterAdmin: true,
                } as const,
            );
            expect(result).toContain("AND active = true");
            expect(result).not.toContain("AND verified = true");
            expect(result).toContain("AND role = 'admin'");
        });

        test("should handle adjacent conditions", () => {
            const template =
                "SELECT a/*if:b*/, b/*endif*//*if:c*/, c/*endif*/ FROM t";
            const result = conditionalString(template, { b: true, c: false } as const);
            expect(result).toBe("SELECT a, b FROM t");
        });
    });

    describe("truthy/falsy values", () => {
        test("should treat non-empty string as truthy", () => {
            const template = "SELECT * /*if:name*/WHERE name = $1/*endif*/";
            const result = conditionalString(template, { name: "John" } as const);
            expect(result).toBe("SELECT * WHERE name = $1");
        });

        test("should treat empty string as falsy", () => {
            const template = "SELECT * /*if:name*/WHERE name = $1/*endif*/";
            const result = conditionalString(template, { name: "" } as const);
            expect(result).toBe("SELECT * ");
        });

        test("should treat number 0 as falsy", () => {
            const template = "SELECT * /*if:count*/WHERE count > 0/*endif*/";
            const result = conditionalString(template, { count: 0 } as const);
            expect(result).toBe("SELECT * ");
        });

        test("should treat positive number as truthy", () => {
            const template = "SELECT * /*if:count*/WHERE count > 0/*endif*/";
            const result = conditionalString(template, { count: 5 } as const);
            expect(result).toBe("SELECT * WHERE count > 0");
        });

        test("should treat null as falsy", () => {
            const template = "SELECT * /*if:value*/WHERE value = $1/*endif*/";
            const result = conditionalString(template, { value: null } as const);
            expect(result).toBe("SELECT * ");
        });

        test("should treat undefined as falsy", () => {
            const template = "SELECT * /*if:value*/WHERE value = $1/*endif*/";
            const result = conditionalString(template, { value: undefined } as const);
            expect(result).toBe("SELECT * ");
        });

        test("should treat empty array as truthy (standard JS behavior)", () => {
            const template = "SELECT * /*if:items*/WHERE items IS NOT NULL/*endif*/";
            const result = conditionalString(template, { items: [] } as const);
            expect(result).toBe("SELECT * WHERE items IS NOT NULL");
        });

        test("should treat empty object as truthy (standard JS behavior)", () => {
            const template =
                "SELECT * /*if:config*/WHERE config IS NOT NULL/*endif*/";
            const result = conditionalString(
                template,
                { config: {} } as const,
            );
            expect(result).toBe("SELECT * WHERE config IS NOT NULL");
        });
    });

    describe("edge cases", () => {
        test("should handle template without any conditions", () => {
            const template = "SELECT * FROM users WHERE id = $1";
            const result = conditionalString(template, { flag: true } as const);
            expect(result).toBe("SELECT * FROM users WHERE id = $1");
        });

        test("should handle empty template", () => {
            const result = conditionalString("", { flag: true } as const);
            expect(result).toBe("");
        });

        test("should preserve multiline content", () => {
            const template = `SELECT *
FROM users
/*if:includeOrders*/
LEFT JOIN orders ON orders.user_id = users.id
/*endif*/
WHERE 1=1`;
            const result = conditionalString(
                template,
                { includeOrders: true } as const,
            );
            expect(result).toContain(
                "LEFT JOIN orders ON orders.user_id = users.id",
            );
        });

        test("should handle condition at start of template", () => {
            const template =
                "/*if:withCTE*/WITH cte AS (SELECT 1) /*endif*/SELECT * FROM users";
            const result = conditionalString(template, { withCTE: true } as const);
            expect(result).toBe("WITH cte AS (SELECT 1) SELECT * FROM users");
        });

        test("should handle condition at end of template", () => {
            const template = "SELECT * FROM users/*if:limit*/ LIMIT 10/*endif*/";
            const result = conditionalString(template, { limit: true } as const);
            expect(result).toBe("SELECT * FROM users LIMIT 10");
        });

        test("should handle special characters in content", () => {
            const template =
                "SELECT * FROM users /*if:filter*/WHERE name LIKE '%test%'/*endif*/";
            const result = conditionalString(template, { filter: true } as const);
            expect(result).toBe("SELECT * FROM users WHERE name LIKE '%test%'");
        });

        test("should handle underscores in condition names", () => {
            const template =
                `SELECT * /*if:include_deleted*/WHERE deleted = false/*endif*/`;
            const result = conditionalString(
                template,
                {
                    include_deleted: true,
                } as const,
            );
            expect(result).toBe("SELECT * WHERE deleted = false");
        });
    });

    describe("real-world examples", () => {
        test("dynamic WHERE clause", () => {
            const template = `
                SELECT u.id, u.name, u.email
                FROM users u
                WHERE 1=1
                /*if:searchTerm*/AND (u.name ILIKE $1 OR u.email ILIKE $1)/*endif*/
                /*if:roleFilter*/AND u.role = $2/*endif*/
                /*if:activeOnly*/AND u.active = true/*endif*/
                ORDER BY u.created_at DESC
            `;
            const result = conditionalString(
                template,
                {
                    searchTerm: "john",
                    roleFilter: null,
                    activeOnly: true,
                } as const,
            );
            expect(result).toContain(
                "AND (u.name ILIKE $1 OR u.email ILIKE $1)",
            );
            expect(result).not.toContain("AND u.role = $2");
            expect(result).toContain("AND u.active = true");
        });

        test("dynamic JOIN", () => {
            const template = `
                SELECT o.id, o.total
                FROM orders o
                /*if:includeUser*/LEFT JOIN users u ON u.id = o.user_id/*endif*/
                /*if:includeItems*/LEFT JOIN order_items oi ON oi.order_id = o.id/*endif*/
                WHERE o.status = 'completed'
            `;
            const result = conditionalString(
                template,
                {
                    includeUser: true,
                    includeItems: false,
                } as const,
            );
            expect(result).toContain("LEFT JOIN users u ON u.id = o.user_id");
            expect(result).not.toContain("LEFT JOIN order_items");
        });

        test("conditional GROUP BY and HAVING", () => {
            const template = `
                SELECT user_id, COUNT(*) as order_count
                FROM orders
                WHERE status = 'completed'
                GROUP BY user_id
                /*if:minOrders*/HAVING COUNT(*) >= $1/*endif*/
                ORDER BY order_count DESC
            `;
            const result = conditionalString(template, { minOrders: 5 } as const);
            expect(result).toContain("HAVING COUNT(*) >= $1");
        });
    });
});

