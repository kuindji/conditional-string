/**
 * Process a string template with conditional comments.
 *
 * Syntax: `/*if:condition* /.../*endif* /` (without spaces before /)
 *
 * Supports:
 * - Boolean flags: `/*if:includeDeleted* /.../*endif* /`
 * - Negation: `/*if:!includeDeleted* /.../*endif* /`
 * - Dot notation: `/*if:user.isAdmin* /.../*endif* /`
 * - Nested conditions: `/*if:a* / /*if:b* /.../*endif* / /*endif* /`
 *
 * @example
 * ```ts
 * const template = `Hello /*if:showName* /World/*endif* /!`;
 * const result = conditionalString(template, { showName: true });
 * // Returns: "Hello World!"
 * // Type is: "Hello World!"
 * ```
 */

// ============================================================================
// Type-level utilities
// ============================================================================

/**
 * Get a nested value type from an object type using dot notation path.
 * @example GetPath<{ user: { isAdmin: true } }, "user.isAdmin"> // true
 */
type GetPath<T, Path extends string> = Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T ? GetPath<T[Key], Rest>
    : undefined
    : Path extends keyof T ? T[Path]
    : undefined;

/**
 * Check if a type is considered "truthy" at the type level.
 * Returns:
 * - `false` if T is strictly falsy (false, 0, "", null, undefined, never)
 * - `true` if T is strictly truthy (true literal, non-empty string literal, etc.)
 * - `boolean` if T could be either (widened boolean, string, number, etc.)
 */
type IsTruthy<T> =
    // Strictly falsy types
    [ T ] extends [ false | 0 | "" | null | undefined ] ? false
        : [ T ] extends [ never ] ? false
        // Check if T is exactly `boolean` (not `true` or `false` literal)
        : [ T ] extends [ boolean ]
            ? ([ boolean ] extends [ T ] ? boolean : true)
        // Check if T is exactly `string` (not a string literal)
        : [ T ] extends [ string ] ? ([ string ] extends [ T ] ? boolean : true)
        // Check if T is exactly `number` (not a number literal)
        : [ T ] extends [ number ] ? ([ number ] extends [ T ] ? boolean : true)
        // Otherwise truthy (objects, arrays, literal true, specific strings/numbers, etc.)
        : true;

/**
 * Evaluate a condition string against a data type.
 * Supports negation with `!` prefix.
 * Returns true, false, or boolean (indeterminate).
 */
type EvalCondition<Cond extends string, Data> = Cond extends `!${infer Key}`
    ? IsTruthy<GetPath<Data, Key>> extends true ? false
    : IsTruthy<GetPath<Data, Key>> extends false ? true
    : boolean // indeterminate - negate of boolean is still boolean
    : IsTruthy<GetPath<Data, Cond>>;

/**
 * Check if a string contains a specific pattern.
 */
type Contains<S extends string, Pattern extends string> = S extends
    `${string}${Pattern}${string}` ? true : false;

/**
 * Check if any condition in the data object has an indeterminate type (widened boolean/string/number).
 * If so, we can't compute the result at compile time.
 */
type HasIndeterminateCondition<
    Template extends string,
    Data extends Record<string, unknown>,
> = Template extends `${string}/*if:${infer Cond}*/${infer Rest}`
    ? EvalCondition<Cond, Data> extends boolean
        ? boolean extends EvalCondition<Cond, Data> ? true // Indeterminate
        : HasIndeterminateCondition<Rest, Data>
    : HasIndeterminateCondition<Rest, Data>
    : false;

/**
 * Process the innermost conditional block (one without nested /*if: in content).
 * This handles nested conditions by processing from inside out.
 */
type ProcessInnermost<
    Template extends string,
    Data extends Record<string, unknown>,
> = Template extends
    `${infer Before}/*if:${infer Cond}*/${infer Content}/*endif*/${infer After}`
    ? Contains<Content, "/*if:"> extends true
        // Content has nested /*if: - the match captured wrong /*endif*/
        // Re-match with Content+/*endif*/+After to find the true innermost
        ? `${Before}/*if:${Cond}*/${ProcessInnermost<
            `${Content}/*endif*/${After}`,
            Data
        >}`
        // This is truly innermost - evaluate and replace
    : EvalCondition<Cond, Data> extends true ? `${Before}${Content}${After}`
    : EvalCondition<Cond, Data> extends false ? `${Before}${After}`
        // Indeterminate (boolean) - fall back to string
    : string
    : Template;

/**
 * Recursively process all conditional blocks until none remain.
 * Processes innermost conditions first, then works outward.
 * Falls back to `string` if any condition is indeterminate.
 */
type ProcessConditionalString<
    Template extends string,
    Data extends Record<string, unknown>,
    Depth extends number[] = [],
> =
    // If any condition is indeterminate, fall back to string immediately
    HasIndeterminateCondition<Template, Data> extends true ? string
        // Recursion depth limit (prevent infinite loops)
        : Depth["length"] extends 20 ? Template
        // Check if there are any conditions left to process
        : Contains<Template, "/*if:"> extends true ? ProcessConditionalString<
                ProcessInnermost<Template, Data>,
                Data,
                [ ...Depth, 0 ]
            >
        : Template;

/**
 * The result type of conditionalString - the processed string literal.
 */
export type ConditionalStringResult<
    Template extends string,
    Data extends Record<string, unknown>,
> = ProcessConditionalString<Template, Data>;

// ============================================================================
// Runtime implementation
// ============================================================================

/**
 * A typed version of conditionalString where the Data type is pre-specified
 * for return type computation, but runtime data values are not constrained.
 *
 * This allows specifying a "static" type like `{ flag: true }` for the return type,
 * while accepting runtime data like `{ flag: boolean }`.
 */
type TypedConditionalString<StaticData extends Record<string, unknown>> = <
    Template extends string,
>(
    template: Template,
    data: { [K in keyof StaticData]: unknown; },
) => ConditionalStringResult<Template, StaticData>;

/**
 * Interface for the conditionalString function with the .typed() method.
 */
interface ConditionalStringFn {
    /**
     * Process a template with inferred types for both Template and Data.
     */
    <Template extends string, Data extends Record<string, unknown>>(
        template: Template,
        data: Data,
    ): ConditionalStringResult<Template, Data>;

    /**
     * Create a typed version of conditionalString with a pre-specified Data type.
     * Use this when you want to explicitly type the data parameter while still
     * inferring the Template type from the template string.
     *
     * @example
     * ```ts
     * type MyData = { showName: boolean; count: number };
     * const result = conditionalString.with<MyData>()(template, data);
     * // Data is typed as MyData, Template is inferred
     * ```
     */
    with<Data extends Record<string, unknown>>(): TypedConditionalString<Data>;
}

/**
 * Core implementation of the conditional string processing.
 */
function processConditionalString<
    Template extends string,
    Data extends Record<string, unknown>,
>(template: Template, data: Data): ConditionalStringResult<Template, Data> {
    // Pattern matches /*if:condition*/ ... /*endif*/
    // Uses negative lookahead to match innermost conditions first (no nested /*if: inside)
    // The condition can include ! for negation and dots for nested properties
    const pattern =
        /\/\*if:(!?[\w.]+)\*\/((?:(?!\/\*if:)[\s\S])*?)\/\*endif\*\//g;

    let result: string = template;
    let hasMatches = true;

    // Process iteratively to handle nested conditions (inner first)
    while (hasMatches) {
        hasMatches = false;

        result = result.replace(
            pattern,
            (_, condition: string, content: string) => {
                hasMatches = true;

                const isNegated = condition.startsWith("!");
                const key = isNegated ? condition.slice(1) : condition;
                const value = getNestedValue(data, key);
                const isTruthy = Boolean(value);

                // Return content if condition is met, empty string otherwise
                return (isNegated ? !isTruthy : isTruthy) ? content : "";
            },
        );
    }

    return result as unknown as ConditionalStringResult<Template, Data>;
}

/**
 * Creates a typed version of conditionalString with a pre-specified Data type.
 */
function createTypedConditionalString<
    StaticData extends Record<string, unknown>,
>(): TypedConditionalString<StaticData> {
    return <Template extends string>(
        template: Template,
        data: { [K in keyof StaticData]: unknown; },
    ): ConditionalStringResult<Template, StaticData> => {
        return processConditionalString(template, data as StaticData);
    };
}

export const conditionalString: ConditionalStringFn = Object.assign(
    processConditionalString,
    { with: createTypedConditionalString },
);

/**
 * Get a nested value from an object using dot notation.
 * @example getNestedValue({ user: { isAdmin: true } }, "user.isAdmin") // true
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return current;
}

export default conditionalString;
