"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepMerge = exports.deepSet = exports.deepGet = exports.makeObject = exports.mapObject = exports.deepClone = exports.isEmpty = exports.applyDefaults = void 0;
const types_1 = require("./types");
/**
 * Return a new object by adding missing keys into another object
 */
function applyDefaults(hash, defaults) {
    const result = {};
    Object.keys(hash).forEach(k => result[k] = hash[k]);
    Object.keys(defaults)
        .filter(k => !(k in result))
        .forEach(k => result[k] = defaults[k]);
    return result;
}
exports.applyDefaults = applyDefaults;
/**
 * Return whether the given parameter is an empty object or empty list.
 */
function isEmpty(x) {
    if (x == null) {
        return false;
    }
    if (types_1.isArray(x)) {
        return x.length === 0;
    }
    return Object.keys(x).length === 0;
}
exports.isEmpty = isEmpty;
/**
 * Deep clone a tree of objects, lists or scalars
 *
 * Does not support cycles.
 */
function deepClone(x) {
    if (typeof x === 'undefined') {
        return undefined;
    }
    if (x === null) {
        return null;
    }
    if (types_1.isArray(x)) {
        return x.map(deepClone);
    }
    if (types_1.isObject(x)) {
        return makeObject(mapObject(x, (k, v) => [k, deepClone(v)]));
    }
    return x;
}
exports.deepClone = deepClone;
/**
 * Map over an object, treating it as a dictionary
 */
function mapObject(x, fn) {
    const ret = [];
    Object.keys(x).forEach(key => {
        ret.push(fn(key, x[key]));
    });
    return ret;
}
exports.mapObject = mapObject;
/**
 * Construct an object from a list of (k, v) pairs
 */
function makeObject(pairs) {
    const ret = {};
    for (const pair of pairs) {
        ret[pair[0]] = pair[1];
    }
    return ret;
}
exports.makeObject = makeObject;
/**
 * Deep get a value from a tree of nested objects
 *
 * Returns undefined if any part of the path was unset or
 * not an object.
 */
function deepGet(x, path) {
    path = path.slice();
    while (path.length > 0 && types_1.isObject(x)) {
        const key = path.shift();
        x = x[key];
    }
    return path.length === 0 ? x : undefined;
}
exports.deepGet = deepGet;
/**
 * Deep set a value in a tree of nested objects
 *
 * Throws an error if any part of the path is not an object.
 */
function deepSet(x, path, value) {
    path = path.slice();
    if (path.length === 0) {
        throw new Error('Path may not be empty');
    }
    while (path.length > 1 && types_1.isObject(x)) {
        const key = path.shift();
        if (!(key in x)) {
            x[key] = {};
        }
        x = x[key];
    }
    if (!types_1.isObject(x)) {
        throw new Error(`Expected an object, got '${x}'`);
    }
    if (value !== undefined) {
        x[path[0]] = value;
    }
    else {
        delete x[path[0]];
    }
}
exports.deepSet = deepSet;
/**
 * Recursively merge objects together
 *
 * The leftmost object is mutated and returned. Arrays are not merged
 * but overwritten just like scalars.
 *
 * If an object is merged into a non-object, the non-object is lost.
 */
function deepMerge(...objects) {
    function mergeOne(target, source) {
        for (const key of Object.keys(source)) {
            const value = source[key];
            if (types_1.isObject(value)) {
                if (!types_1.isObject(target[key])) {
                    target[key] = {};
                } // Overwrite on purpose
                mergeOne(target[key], value);
            }
            else if (typeof value !== 'undefined') {
                target[key] = value;
            }
        }
    }
    const others = objects.filter(x => x != null);
    if (others.length === 0) {
        return {};
    }
    const into = others.splice(0, 1)[0];
    others.forEach(other => mergeOne(into, other));
    return into;
}
exports.deepMerge = deepMerge;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9iamVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQWlEO0FBRWpEOztHQUVHO0FBQ0gsU0FBZ0IsYUFBYSxDQUFDLElBQVMsRUFBRSxRQUFhO0lBQ3BELE1BQU0sTUFBTSxHQUFRLEVBQUcsQ0FBQztJQUV4QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVwRCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUNsQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDO1NBQzNCLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6QyxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBVkQsc0NBVUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FBQyxDQUFNO0lBQzVCLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRTtRQUFFLE9BQU8sS0FBSyxDQUFDO0tBQUU7SUFDaEMsSUFBSSxlQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO0tBQUU7SUFDMUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUpELDBCQUlDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLFNBQVMsQ0FBQyxDQUFNO0lBQzlCLElBQUksT0FBTyxDQUFDLEtBQUssV0FBVyxFQUFFO1FBQUUs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cEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMvQyxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFyQkQsOEJBcUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNBcnJheSwgaXNPYmplY3QsIE9iaiB9IGZyb20gJy4vdHlwZXMnO1xuXG4vKipcbiAqIFJldHVybiBhIG5ldyBvYmplY3QgYnkgYWRkaW5nIG1pc3Npbmcga2V5cyBpbnRvIGFub3RoZXIgb2JqZWN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRzKGhhc2g6IGFueSwgZGVmYXVsdHM6IGFueSkge1xuICBjb25zdCByZXN1bHQ6IGFueSA9IHsgfTtcblxuICBPYmplY3Qua2V5cyhoYXNoKS5mb3JFYWNoKGsgPT4gcmVzdWx0W2tdID0gaGFzaFtrXSk7XG5cbiAgT2JqZWN0LmtleXMoZGVmYXVsdHMpXG4gICAgLmZpbHRlcihrID0+ICEoayBpbiByZXN1bHQpKVxuICAgIC5mb3JFYWNoKGsgPT4gcmVzdWx0W2tdID0gZGVmYXVsdHNba10pO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogUmV0dXJuIHdoZXRoZXIgdGhlIGdpdmVuIHBhcmFtZXRlciBpcyBhbiBlbXB0eSBvYmplY3Qgb3IgZW1wdHkgbGlzdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHkoeDogYW55KSB7XG4gIGlmICh4ID09IG51bGwpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGlmIChpc0FycmF5KHgpKSB7IHJldHVybiB4Lmxlbmd0aCA9PT0gMDsgfVxuICByZXR1cm4gT2JqZWN0LmtleXMoeCkubGVuZ3RoID09PSAwO1xufVxuXG4vKipcbiAqIERlZXAgY2xvbmUgYSB0cmVlIG9mIG9iamVjdHMsIGxpc3RzIG9yIHNjYWxhcnNcbiAqXG4gKiBEb2VzIG5vdCBzdXBwb3J0IGN5Y2xlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZXBDbG9uZSh4OiBhbnkpOiBhbnkge1xuICBpZiAodHlwZW9mIHggPT09ICd1bmRlZmluZWQnKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgaWYgKHggPT09IG51bGwpIHsgcmV0dXJuIG51bGw7IH1cbiAgaWYgKGlzQXJyYXkoeCkpIHsgcmV0dXJuIHgubWFwKGRlZXBDbG9uZSk7IH1cbiAgaWYgKGlzT2JqZWN0KHgpKSB7IHJldHVybiBtYWtlT2JqZWN0KG1hcE9iamVjdCh4LCAoaywgdikgPT4gW2ssIGRlZXBDbG9uZSh2KV0gYXMgW3N0cmluZywgYW55XSkpOyB9XG4gIHJldHVybiB4O1xufVxuXG4vKipcbiAqIE1hcCBvdmVyIGFuIG9iamVjdCwgdHJlYXRpbmcgaXQgYXMgYSBkaWN0aW9uYXJ5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXBPYmplY3Q8VCwgVT4oeDogT2JqPFQ+LCBmbjogKGtleTogc3RyaW5nLCB2YWx1ZTogVCkgPT4gVSk6IFVbXSB7XG4gIGNvbnN0IHJldDogVVtdID0gW107XG4gIE9iamVjdC5rZXlzKHgpLmZvckVhY2goa2V5ID0+IHtcbiAgICByZXQucHVzaChmbihrZXksIHhba2V5XSkpO1xuICB9KTtcbiAgcmV0dXJuIHJldDtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3QgYW4gb2JqZWN0IGZyb20gYSBsaXN0IG9mIChrLCB2KSBwYWlyc1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZU9iamVjdDxUPihwYWlyczogQXJyYXk8W3N0cmluZywgVF0+KTogT2JqPFQ+IHtcbiAgY29uc3QgcmV0OiBPYmo8VD4gPSB7fTtcbiAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzKSB7XG4gICAgcmV0W3BhaXJbMF1dID0gcGFpclsxXTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIERlZXAgZ2V0IGEgdmFsdWUgZnJvbSBhIHRyZWUgb2YgbmVzdGVkIG9iamVjdHNcbiAqXG4gKiBSZXR1cm5zIHVuZGVmaW5lZCBpZiBhbnkgcGFydCBvZiB0aGUgcGF0aCB3YXMgdW5zZXQgb3JcbiAqIG5vdCBhbiBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWVwR2V0KHg6IGFueSwgcGF0aDogc3RyaW5nW10pOiBhbnkge1xuICBwYXRoID0gcGF0aC5zbGljZSgpO1xuXG4gIHdoaWxlIChwYXRoLmxlbmd0aCA+IDAgJiYgaXNPYmplY3QoeCkpIHtcbiAgICBjb25zdCBrZXkgPSBwYXRoLnNoaWZ0KCkhO1xuICAgIHggPSB4W2tleV07XG4gIH1cbiAgcmV0dXJuIHBhdGgubGVuZ3RoID09PSAwID8geCA6IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBEZWVwIHNldCBhIHZhbHVlIGluIGEgdHJlZSBvZiBuZXN0ZWQgb2JqZWN0c1xuICpcbiAqIFRocm93cyBhbiBlcnJvciBpZiBhbnkgcGFydCBvZiB0aGUgcGF0aCBpcyBub3QgYW4gb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVlcFNldCh4OiBhbnksIHBhdGg6IHN0cmluZ1tdLCB2YWx1ZTogYW55KSB7XG4gIHBhdGggPSBwYXRoLnNsaWNlKCk7XG5cbiAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQYXRoIG1heSBub3QgYmUgZW1wdHknKTtcbiAgfVxuXG4gIHdoaWxlIChwYXRoLmxlbmd0aCA+IDEgJiYgaXNPYmplY3QoeCkpIHtcbiAgICBjb25zdCBrZXkgPSBwYXRoLnNoaWZ0KCkhO1xuICAgIGlmICghKGtleSBpbiB4KSkgeyB4W2tleV0gPSB7fTsgfVxuICAgIHggPSB4W2tleV07XG4gIH1cblxuICBpZiAoIWlzT2JqZWN0KHgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhbiBvYmplY3QsIGdvdCAnJHt4fSdgKTtcbiAgfVxuXG4gIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgeFtwYXRoWzBdXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIGRlbGV0ZSB4W3BhdGhbMF1dO1xuICB9XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgbWVyZ2Ugb2JqZWN0cyB0b2dldGhlclxuICpcbiAqIFRoZSBsZWZ0bW9zdCBvYmplY3QgaXMgbXV0YXRlZCBhbmQgcmV0dXJuZWQuIEFycmF5cyBhcmUgbm90IG1lcmdlZFxuICogYnV0IG92ZXJ3cml0dGVuIGp1c3QgbGlrZSBzY2FsYXJzLlxuICpcbiAqIElmIGFuIG9iamVjdCBpcyBtZXJnZWQgaW50byBhIG5vbi1vYmplY3QsIHRoZSBub24tb2JqZWN0IGlzIGxvc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWVwTWVyZ2UoLi4ub2JqZWN0czogQXJyYXk8T2JqPGFueT4gfCB1bmRlZmluZWQ+KSB7XG4gIGZ1bmN0aW9uIG1lcmdlT25lKHRhcmdldDogT2JqPGFueT4sIHNvdXJjZTogT2JqPGFueT4pIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzb3VyY2UpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHNvdXJjZVtrZXldO1xuXG4gICAgICBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgICAgIGlmICghaXNPYmplY3QodGFyZ2V0W2tleV0pKSB7IHRhcmdldFtrZXldID0ge307IH0gLy8gT3ZlcndyaXRlIG9uIHB1cnBvc2VcbiAgICAgICAgbWVyZ2VPbmUodGFyZ2V0W2tleV0sIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0YXJnZXRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG90aGVycyA9IG9iamVjdHMuZmlsdGVyKHggPT4geCAhPSBudWxsKSBhcyBBcnJheTxPYmo8YW55Pj47XG5cbiAgaWYgKG90aGVycy5sZW5ndGggPT09IDApIHsgcmV0dXJuIHt9OyB9XG4gIGNvbnN0IGludG8gPSBvdGhlcnMuc3BsaWNlKDAsIDEpWzBdO1xuXG4gIG90aGVycy5mb3JFYWNoKG90aGVyID0+IG1lcmdlT25lKGludG8sIG90aGVyKSk7XG4gIHJldHVybiBpbnRvO1xufVxuIl19