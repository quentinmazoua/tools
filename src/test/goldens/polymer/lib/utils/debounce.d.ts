/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   lib/utils/debounce.html
 */

/// <reference path="boot.d.ts" />
/// <reference path="mixin.d.ts" />
/// <reference path="async.d.ts" />

declare namespace Polymer {

  class Debouncer {

    /**
     * Creates a debouncer if no debouncer is passed as a parameter
     * or it cancels an active debouncer otherwise. The following
     * example shows how a debouncer can be called multiple times within a
     * microtask and "debounced" such that the provided callback function is
     * called once. Add this method to a custom element:
     *
     * _debounceWork() {
     *   this._debounceJob = Polymer.Debouncer.debounce(this._debounceJob,
     *       Polymer.Async.microTask, () => {
     *     this._doWork();
     *   });
     * }
     *
     * If the `_debounceWork` method is called multiple times within the same
     * microtask, the `_doWork` function will be called only once at the next
     * microtask checkpoint.
     *
     * Note: In testing it is often convenient to avoid asynchrony. To accomplish
     * this with a debouncer, you can use `Polymer.enqueueDebouncer` and
     * `Polymer.flush`. For example, extend the above example by adding
     * `Polymer.enqueueDebouncer(this._debounceJob)` at the end of the
     * `_debounceWork` method. Then in a test, call `Polymer.flush` to ensure
     * the debouncer has completed.
     *
     * @param debouncer Debouncer object.
     * @param asyncModule Object with Async interface
     * @param callback Callback to run.
     * @returns Returns a debouncer object.
     */
    static debounce(debouncer: Debouncer|null, asyncModule: AsyncModule, callback: () => any): Debouncer;

    /**
     * Sets the scheduler; that is, a module with the Async interface,
     * a callback and optional arguments to be passed to the run function
     * from the async module.
     *
     * @param asyncModule Object with Async interface.
     * @param callback Callback to run.
     */
    setConfig(asyncModule: AsyncModule, callback: () => any): void;

    /**
     * Cancels an active debouncer and returns a reference to itself.
     */
    cancel(): void;

    /**
     * Flushes an active debouncer and returns a reference to itself.
     */
    flush(): void;

    /**
     * Returns true if the debouncer is active.
     *
     * @returns True if active.
     */
    isActive(): boolean;
  }
}
