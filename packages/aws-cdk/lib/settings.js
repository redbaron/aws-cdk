"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = exports.Context = exports.Configuration = exports.Command = exports.TRANSIENT_CONTEXT_KEY = exports.USER_DEFAULTS = exports.PROJECT_CONTEXT = exports.PROJECT_CONFIG = void 0;
const os = require("os");
const fs_path = require("path");
const fs = require("fs-extra");
const logging_1 = require("./logging");
const util = require("./util");
exports.PROJECT_CONFIG = 'cdk.json';
exports.PROJECT_CONTEXT = 'cdk.context.json';
exports.USER_DEFAULTS = '~/.cdk.json';
/**
 * If a context value is an object with this key set to a truthy value, it won't be saved to cdk.context.json
 */
exports.TRANSIENT_CONTEXT_KEY = '$dontSaveContext';
const CONTEXT_KEY = 'context';
var Command;
(function (Command) {
    Command["LS"] = "ls";
    Command["LIST"] = "list";
    Command["DIFF"] = "diff";
    Command["BOOTSTRAP"] = "bootstrap";
    Command["DEPLOY"] = "deploy";
    Command["DESTROY"] = "destroy";
    Command["SYNTHESIZE"] = "synthesize";
    Command["SYNTH"] = "synth";
    Command["METADATA"] = "metadata";
    Command["INIT"] = "init";
    Command["VERSION"] = "version";
})(Command = exports.Command || (exports.Command = {}));
const BUNDLING_COMMANDS = [
    Command.DEPLOY,
    Command.DIFF,
    Command.SYNTH,
    Command.SYNTHESIZE,
];
/**
 * All sources of settings combined
 */
class Configuration {
    constructor(commandLineArguments) {
        this.settings = new Settings();
        this.context = new Context();
        this.defaultConfig = new Settings({
            versionReporting: true,
            pathMetadata: true,
            output: 'cdk.out',
        });
        this.loaded = false;
        this.commandLineArguments = commandLineArguments
            ? Settings.fromCommandLineArguments(commandLineArguments)
            : new Settings();
        this.commandLineContext = this.commandLineArguments.subSettings([CONTEXT_KEY]).makeReadOnly();
    }
    get projectConfig() {
        if (!this._projectConfig) {
            throw new Error('#load has not been called yet!');
        }
        return this._projectConfig;
    }
    get projectContext() {
        if (!this._projectContext) {
            throw new Error('#load has not been called yet!');
        }
        return this._projectContext;
    }
    /**
     * Load all config
     */
    async load() {
        const userConfig = await loadAndLog(exports.USER_DEFAULTS);
        this._projectConfig = await loadAndLog(exports.PROJECT_CONFIG);
        this._projectContext = await loadAndLog(exports.PROJECT_CONTEXT);
        this.context = new Context(this.commandLineContext, this.projectConfig.subSettings([CONTEXT_KEY]).makeReadOnly(), this.projectContext);
        // Build settings from what's left
        this.settings = this.defaultConfig
            .merge(userConfig)
            .merge(this.projectConfig)
            .merge(this.commandLineArguments)
            .makeReadOnly();
        logging_1.debug('merged settings:', this.settings.all);
        this.loaded = true;
        return this;
    }
    /**
     * Save the project context
     */
    async saveContext() {
        if (!this.loaded) {
            return this;
        } // Avoid overwriting files with nothing
        await this.projectContext.save(exports.PROJECT_CONTEXT);
        return this;
    }
}
exports.Configuration = Configuration;
async function loadAndLog(fileName) {
    const ret = new Settings();
    await ret.load(fileName);
    if (!ret.empty) {
        logging_1.debug(fileName + ':', JSON.stringify(ret.all, undefined, 2));
    }
    return ret;
}
/**
 * Class that supports overlaying property bags
 *
 * Reads come from the first property bag that can has the given key,
 * writes go to the first property bag that is not readonly. A write
 * will remove the value from all property bags after the first
 * writable one.
 */
class Context {
    constructor(...bags) {
        this.bags = bags.length > 0 ? bags : [new Settings()];
    }
    get keys() {
        return Object.keys(this.all);
    }
    has(key) {
        return this.keys.indexOf(key) > -1;
    }
    get all() {
        let ret = new Settings();
        // In reverse order so keys to the left overwrite keys to the right of them
        for (const bag of [...this.bags].reverse()) {
            ret = ret.merge(bag);
        }
        return ret.all;
    }
    get(key) {
        for (const bag of this.bags) {
            const v = bag.get([key]);
            if (v !== undefined) {
                return v;
            }
        }
        return undefined;
    }
    set(key, value) {
        for (const bag of this.bags) {
            if (bag.readOnly) {
                continue;
            }
            // All bags past the first one have the value erased
            bag.set([key], value);
            value = undefined;
        }
    }
    unset(key) {
        this.set(key, undefined);
    }
    clear() {
        for (const key of this.keys) {
            this.unset(key);
        }
    }
}
exports.Context = Context;
/**
 * A single bag of settings
 */
class Settings {
    constructor(settings = {}, readOnly = false) {
        this.settings = settings;
        this.readOnly = readOnly;
    }
    /**
     * Parse Settings out of CLI arguments.
     * @param argv the received CLI arguments.
     * @returns a new Settings object.
     */
    static fromCommandLineArguments(argv) {
        var _a;
        const context = this.parseStringContextListToObject(argv);
        const tags = this.parseStringTagsListToObject(expectStringList(argv.tags));
        // Determine bundling stacks
        let bundlingStacks;
        if (BUNDLING_COMMANDS.includes(argv._[0])) {
            // If we deploy, diff or synth a list of stacks exclusively we skip
            // bundling for all other stacks.
            bundlingStacks = argv.exclusively
                ? (_a = argv.STACKS) !== null && _a !== void 0 ? _a : ['*'] : ['*'];
        }
        else { // Skip bundling for all stacks
            bundlingStacks = [];
        }
        return new Settings({
            app: argv.app,
            browser: argv.browser,
            context,
            debug: argv.debug,
            tags,
            language: argv.language,
            pathMetadata: argv.pathMetadata,
            assetMetadata: argv.assetMetadata,
            profile: argv.profile,
            plugin: argv.plugin,
            requireApproval: argv.requireApproval,
            toolkitStackName: argv.toolkitStackName,
            bootstrapQualifier: argv.bootstrapQualifier,
            toolkitBucket: {
                bucketName: argv.bootstrapBucketName,
                kmsKeyId: argv.bootstrapKmsKeyId,
            },
            versionReporting: argv.versionReporting,
            staging: argv.staging,
            output: argv.output,
            progress: argv.progress,
            bundlingStacks,
            lookups: argv.lookups,
        });
    }
    static mergeAll(...settings) {
        let ret = new Settings();
        for (const setting of settings) {
            ret = ret.merge(setting);
        }
        return ret;
    }
    static parseStringContextListToObject(argv) {
        const context = {};
        for (const assignment of (argv.context || [])) {
            const parts = assignment.split(/=(.*)/, 2);
            if (parts.length === 2) {
                logging_1.debug('CLI argument context: %s=%s', parts[0], parts[1]);
                if (parts[0].match(/^aws:.+/)) {
                    throw new Error(`User-provided context cannot use keys prefixed with 'aws:', but ${parts[0]} was provided.`);
                }
                context[parts[0]] = parts[1];
            }
            else {
                logging_1.warning('Context argument is not an assignment (key=value): %s', assignment);
            }
        }
        return context;
    }
    /**
     * Parse tags out of arguments
     *
     * Return undefined if no tags were provided, return an empty array if only empty
     * strings were provided
     */
    static parseStringTagsListToObject(argTags) {
        if (argTags === undefined) {
            return undefined;
        }
        if (argTags.length === 0) {
            return undefined;
        }
        const nonEmptyTags = argTags.filter(t => t !== '');
        if (nonEmptyTags.length === 0) {
            return [];
        }
        const tags = [];
        for (const assignment of nonEmptyTags) {
            const parts = assignment.split('=', 2);
            if (parts.length === 2) {
                logging_1.debug('CLI argument tags: %s=%s', parts[0], parts[1]);
                tags.push({
                    Key: parts[0],
                    Value: parts[1],
                });
            }
            else {
                logging_1.warning('Tags argument is not an assignment (key=value): %s', assignment);
            }
        }
        return tags.length > 0 ? tags : undefined;
    }
    async load(fileName) {
        if (this.readOnly) {
            throw new Error(`Can't load ${fileName}: settings object is readonly`);
        }
        this.settings = {};
        const expanded = expandHomeDir(fileName);
        if (await fs.pathExists(expanded)) {
            this.settings = await fs.readJson(expanded);
        }
        // See https://github.com/aws/aws-cdk/issues/59
        this.prohibitContextKey('default-account', fileName);
        this.prohibitContextKey('default-region', fileName);
        this.warnAboutContextKey('aws:', fileName);
        return this;
    }
    async save(fileName) {
        const expanded = expandHomeDir(fileName);
        await fs.writeJson(expanded, stripTransientValues(this.settings), { spaces: 2 });
        return this;
    }
    get all() {
        return this.get([]);
    }
    merge(other) {
        return new Settings(util.deepMerge(this.settings, other.settings));
    }
    subSettings(keyPrefix) {
        return new Settings(this.get(keyPrefix) || {}, false);
    }
    makeReadOnly() {
        return new Settings(this.settings, true);
    }
    clear() {
        if (this.readOnly) {
            throw new Error('Cannot clear(): settings are readonly');
        }
        this.settings = {};
    }
    get empty() {
        return Object.keys(this.settings).length === 0;
    }
    get(path) {
        return util.deepClone(util.deepGet(this.settings, path));
    }
    set(path, value) {
        if (this.readOnly) {
            throw new Error(`Can't set ${path}: settings object is readonly`);
        }
        if (path.length === 0) {
            // deepSet can't handle this case
            this.settings = value;
        }
        else {
            util.deepSet(this.settings, path, value);
        }
        return this;
    }
    unset(path) {
        this.set(path, undefined);
    }
    prohibitContextKey(key, fileName) {
        if (!this.settings.context) {
            return;
        }
        if (key in this.settings.context) {
            // eslint-disable-next-line max-len
            throw new Error(`The 'context.${key}' key was found in ${fs_path.resolve(fileName)}, but it is no longer supported. Please remove it.`);
        }
    }
    warnAboutContextKey(prefix, fileName) {
        if (!this.settings.context) {
            return;
        }
        for (const contextKey of Object.keys(this.settings.context)) {
            if (contextKey.startsWith(prefix)) {
                // eslint-disable-next-line max-len
                logging_1.warning(`A reserved context key ('context.${prefix}') key was found in ${fs_path.resolve(fileName)}, it might cause surprising behavior and should be removed.`);
            }
        }
    }
}
exports.Settings = Settings;
function expandHomeDir(x) {
    if (x.startsWith('~')) {
        return fs_path.join(os.homedir(), x.substr(1));
    }
    return x;
}
/**
 * Return all context value that are not transient context values
 */
function stripTransientValues(obj) {
    const ret = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!isTransientValue(value)) {
            ret[key] = value;
        }
    }
    return ret;
}
/**
 * Return whether the given value is a transient context value
 *
 * Values that are objects with a magic key set to a truthy value are considered transient.
 */
function isTransientValue(value) {
    return typeof value === 'object' && value !== null && value[exports.TRANSIENT_CONTEXT_KEY];
}
function expectStringList(x) {
    if (x === undefined) {
        return undefined;
    }
    if (!Array.isArray(x)) {
        throw new Error(`Expected array, got '${x}'`);
    }
    const nonStrings = x.filter(e => typeof e !== 'string');
    if (nonStrings.length > 0) {
        throw new Error(`Expected list of strings, found ${nonStrings}`);
    }
    return x;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5QkFBeUI7QUFDekIsZ0NBQWdDO0FBQ2hDLCtCQUErQjtBQUUvQix1Q0FBMkM7QUFDM0MsK0JBQStCO0FBSWxCLFFBQUEsY0FBYyxHQUFHLFVBQVUsQ0FBQztBQUM1QixRQUFBLGVBQWUsR0FBRyxrQkFBa0IsQ0FBQztBQUNyQyxRQUFBLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFFM0M7O0dBRUc7QUFDVSxRQUFBLHFCQUFxQixHQUFHLGtCQUFrQixDQUFDO0FBRXhELE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQztBQUU5QixJQUFZLE9BWVg7QUFaRCxXQUFZLE9BQU87SUFDakIsb0JBQVMsQ0FBQTtJQUNULHdCQUFhLENBQUE7SUFDYix3QkFBYSxDQUFBO0lBQ2Isa0NBQXVCLENBQUE7SUFDdkIsNEJBQWlCLENBQUE7SUFDakIsOEJBQW1CLENBQUE7SUFDbkIsb0NBQXlCLENBQUE7SUFDekIsMEJBQWUsQ0FBQTtJQUNmLGdDQUFxQixDQUFBO0lBQ3JCLHdCQUFhLENBQUE7SUFDYiw4QkFBbUIsQ0FBQTtBQUNyQixDQUFDLEVBWlcsT0FBTyxHQUFQLGVBQU8sS0FBUCxlQUFPLFFBWWxCO0FBRUQsTUFBTSxpQkFBaUIsR0FBRztJQUN4QixPQUFPLENBQUMsTUFBTTtJQUNkLE9BQU8sQ0FBQyxJQUFJO0lBQ1osT0FBTyxDQUFDLEtBQUs7SUFDYixPQUFPLENBQUMsVUFBVTtDQUNuQixDQUFDO0FBVUY7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFnQnhCLFlBQVksb0JBQWdDO1FBZnJDLGFBQVEsR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQzFCLFlBQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBRWYsa0JBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQztZQUMzQyxnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLFlBQVks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Q2xCO0tBQ0Y7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFVO0lBQ2xDLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUssS0FBYSxDQUFDLDZCQUFxQixDQUFDLENBQUM7QUFDOUYsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsQ0FBVTtJQUNsQyxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7UUFBRSxPQUFPLFNBQVMsQ0FBQztLQUFFO0lBQzFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDL0M7SUFDRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUM7SUFDeEQsSUFBSSxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0tBQ2xFO0lBQ0QsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgZnNfcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCB7IFRhZyB9IGZyb20gJy4vY2RrLXRvb2xraXQnO1xuaW1wb3J0IHsgZGVidWcsIHdhcm5pbmcgfSBmcm9tICcuL2xvZ2dpbmcnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgdHlwZSBTZXR0aW5nc01hcCA9IHtba2V5OiBzdHJpbmddOiBhbnl9O1xuXG5leHBvcnQgY29uc3QgUFJPSkVDVF9DT05GSUcgPSAnY2RrLmpzb24nO1xuZXhwb3J0IGNvbnN0IFBST0pFQ1RfQ09OVEVYVCA9ICdjZGsuY29udGV4dC5qc29uJztcbmV4cG9ydCBjb25zdCBVU0VSX0RFRkFVTFRTID0gJ34vLmNkay5qc29uJztcblxuLyoqXG4gKiBJZiBhIGNvbnRleHQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggdGhpcyBrZXkgc2V0IHRvIGEgdHJ1dGh5IHZhbHVlLCBpdCB3b24ndCBiZSBzYXZlZCB0byBjZGsuY29udGV4dC5qc29uXG4gKi9cbmV4cG9ydCBjb25zdCBUUkFOU0lFTlRfQ09OVEVYVF9LRVkgPSAnJGRvbnRTYXZlQ29udGV4dCc7XG5cbmNvbnN0IENPTlRFWFRfS0VZID0gJ2NvbnRleHQnO1xuXG5leHBvcnQgZW51bSBDb21tYW5kIHtcbiAgTFMgPSAnbHMnLFxuICBMSVNUID0gJ2xpc3QnLFxuICBESUZGID0gJ2RpZmYnLFxuICBCT09UU1RSQVAgPSAnYm9vdHN0cmFwJyxcbiAgREVQTE9ZID0gJ2RlcGxveScsXG4gIERFU1RST1kgPSAnZGVzdHJveScsXG4gIFNZTlRIRVNJWkUgPSAnc3ludGhlc2l6ZScsXG4gIFNZTlRIID0gJ3N5bnRoJyxcbiAgTUVUQURBVEEgPSAnbWV0YWRhdGEnLFxuICBJTklUID0gJ2luaXQnLFxuICBWRVJTSU9OID0gJ3ZlcnNpb24nLFxufVxuXG5jb25zdCBCVU5ETElOR19DT01NQU5EUyA9IFtcbiAgQ29tbWFuZC5ERVBMT1ksXG4gIENvbW1hbmQuRElGRixcbiAgQ29tbWFuZC5TWU5USCxcbiAgQ29tbWFuZC5TWU5USEVTSVpFLFxuXTtcblxuZXhwb3J0IHR5cGUgQXJndW1lbnRzID0ge1xuICByZWFkb25seSBfOiBbQ29tbWFuZCwgLi4uc3RyaW5nW11dO1xuICByZWFkb25seSBleGNsdXNpdmVseT86IGJvb2xlYW47XG4gIHJlYWRvbmx5IFNUQUNLUz86IHN0cmluZ1tdO1xuICByZWFkb25seSBsb29rdXBzPzogYm9vbGVhbjtcbiAgcmVhZG9ubHkgW25hbWU6IHN0cmluZ106IHVua25vd247XG59O1xuXG4vKipcbiAqIEFsbCBzb3VyY2VzIG9mIHNldHRpbmdzIGNvbWJpbmVkXG4gKi9cbmV4cG9ydCBjbGFzcyBDb25maWd1cmF0aW9uIHtcbiAgcHVibGljIHNldHRpbmdzID0gbmV3IFNldHRpbmdzKCk7XG4gIHB1YmxpYyBjb250ZXh0ID0gbmV3IENvbnRleHQoKTtcblxuICBwdWJsaWMgcmVhZG9ubHkgZGVmYXVsdENvbmZpZyA9IG5ldyBTZXR0aW5ncyh7XG4gICAgdmVyc2lvblJlcG9ydGluZzogdHJ1ZSxcbiAgICBwYXRoTWV0YWRhdGE6IHRydWUsXG4gICAgb3V0cHV0OiAnY2RrLm91dCcsXG4gIH0pO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZExpbmVBcmd1bWVudHM6IFNldHRpbmdzO1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRMaW5lQ29udGV4dDogU2V0dGluZ3M7XG4gIHByaXZhdGUgX3Byb2plY3RDb25maWc/OiBTZXR0aW5ncztcbiAgcHJpdmF0ZSBfcHJvamVjdENvbnRleHQ/OiBTZXR0aW5ncztcbiAgcHJpdmF0ZSBsb2FkZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihjb21tYW5kTGluZUFyZ3VtZW50cz86IEFyZ3VtZW50cykge1xuICAgIHRoaXMuY29tbWFuZExpbmVBcmd1bWVudHMgPSBjb21tYW5kTGluZUFyZ3VtZW50c1xuICAgICAgPyBTZXR0aW5ncy5mcm9tQ29tbWFuZExpbmVBcmd1bWVudHMoY29tbWFuZExpbmVBcmd1bWVudHMpXG4gICAgICA6IG5ldyBTZXR0aW5ncygpO1xuICAgIHRoaXMuY29tbWFuZExpbmVDb250ZXh0ID0gdGhpcy5jb21tYW5kTGluZUFyZ3VtZW50cy5zdWJTZXR0aW5ncyhbQ09OVEVYVF9LRVldKS5tYWtlUmVhZE9ubHkoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IHByb2plY3RDb25maWcoKSB7XG4gICAgaWYgKCF0aGlzLl9wcm9qZWN0Q29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJyNsb2FkIGhhcyBub3QgYmVlbiBjYWxsZWQgeWV0IScpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcHJvamVjdENvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgZ2V0IHByb2plY3RDb250ZXh0KCkge1xuICAgIGlmICghdGhpcy5fcHJvamVjdENvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignI2xvYWQgaGFzIG5vdCBiZWVuIGNhbGxlZCB5ZXQhJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wcm9qZWN0Q29udGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBjb25maWdcbiAgICovXG4gIHB1YmxpYyBhc3luYyBsb2FkKCk6IFByb21pc2U8dGhpcz4ge1xuICAgIGNvbnN0IHVzZXJDb25maWcgPSBhd2FpdCBsb2FkQW5kTG9nKFVTRVJfREVGQVVMVFMpO1xuICAgIHRoaXMuX3Byb2plY3RDb25maWcgPSBhd2FpdCBsb2FkQW5kTG9nKFBST0pFQ1RfQ09ORklHKTtcbiAgICB0aGlzLl9wcm9qZWN0Q29udGV4dCA9IGF3YWl0IGxvYWRBbmRMb2coUFJPSkVDVF9DT05URVhUKTtcblxuICAgIHRoaXMuY29udGV4dCA9IG5ldyBDb250ZXh0KFxuICAgICAgdGhpcy5jb21tYW5kTGluZUNvbnRleHQsXG4gICAgICB0aGlzLnByb2plY3RDb25maWcuc3ViU2V0dGluZ3MoW0NPTlRFWFRfS0VZXSkubWFrZVJlYWRPbmx5KCksXG4gICAgICB0aGlzLnByb2plY3RDb250ZXh0KTtcblxuICAgIC8vIEJ1aWxkIHNldHRpbmdzIGZyb20gd2hhdCdzIGxlZnRcbiAgICB0aGlzLnNldHRpbmdzID0gdGhpcy5kZWZhdWx0Q29uZmlnXG4gICAgICAubWVyZ2UodXNlckNvbmZpZylcbiAgICAgIC5tZXJnZSh0aGlzLnByb2plY3RDb25maWcpXG4gICAgICAubWVyZ2UodGhpcy5jb21tYW5kTGluZUFyZ3VtZW50cylcbiAgICAgIC5tYWtlUmVhZE9ubHkoKTtcblxuICAgIGRlYnVnKCdtZXJnZWQgc2V0dGluZ3M6JywgdGhpcy5zZXR0aW5ncy5hbGwpO1xuXG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2F2ZSB0aGUgcHJvamVjdCBjb250ZXh0XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc2F2ZUNvbnRleHQoKTogUHJvbWlzZTx0aGlzPiB7XG4gICAgaWYgKCF0aGlzLmxvYWRlZCkgeyByZXR1cm4gdGhpczsgfSAvLyBBdm9pZCBvdmVyd3JpdGluZyBmaWxlcyB3aXRoIG5vdGhpbmdcblxuICAgIGF3YWl0IHRoaXMucHJvamVjdENvbnRleHQuc2F2ZShQUk9KRUNUX0NPTlRFWFQpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZEFuZExvZyhmaWxlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxTZXR0aW5ncz4ge1xuICBjb25zdCByZXQgPSBuZXcgU2V0dGluZ3MoKTtcbiAgYXdhaXQgcmV0LmxvYWQoZmlsZU5hbWUpO1xuICBpZiAoIXJldC5lbXB0eSkge1xuICAgIGRlYnVnKGZpbGVOYW1lICsgJzonLCBKU09OLnN0cmluZ2lmeShyZXQuYWxsLCB1bmRlZmluZWQsIDIpKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIENsYXNzIHRoYXQgc3VwcG9ydHMgb3ZlcmxheWluZyBwcm9wZXJ0eSBiYWdzXG4gKlxuICogUmVhZHMgY29tZSBmcm9tIHRoZSBmaXJzdCBwcm9wZXJ0eSBiYWcgdGhhdCBjYW4gaGFzIHRoZSBnaXZlbiBrZXksXG4gKiB3cml0ZXMgZ28gdG8gdGhlIGZpcnN0IHByb3BlcnR5IGJhZyB0aGF0IGlzIG5vdCByZWFkb25seS4gQSB3cml0ZVxuICogd2lsbCByZW1vdmUgdGhlIHZhbHVlIGZyb20gYWxsIHByb3BlcnR5IGJhZ3MgYWZ0ZXIgdGhlIGZpcnN0XG4gKiB3cml0YWJsZSBvbmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZXh0IHtcbiAgcHJpdmF0ZSByZWFkb25seSBiYWdzOiBTZXR0aW5nc1tdO1xuXG4gIGNvbnN0cnVjdG9yKC4uLmJhZ3M6IFNldHRpbmdzW10pIHtcbiAgICB0aGlzLmJhZ3MgPSBiYWdzLmxlbmd0aCA+IDAgPyBiYWdzIDogW25ldyBTZXR0aW5ncygpXTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQga2V5cygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuYWxsKTtcbiAgfVxuXG4gIHB1YmxpYyBoYXMoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5rZXlzLmluZGV4T2Yoa2V5KSA+IC0xO1xuICB9XG5cbiAgcHVibGljIGdldCBhbGwoKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGxldCByZXQgPSBuZXcgU2V0dGluZ3MoKTtcblxuICAgIC8vIEluIHJldmVyc2Ugb3JkZXIgc28ga2V5cyB0byB0aGUgbGVmdCBvdmVyd3JpdGUga2V5cyB0byB0aGUgcmlnaHQgb2YgdGhlbVxuICAgIGZvciAoY29uc3QgYmFnIG9mIFsuLi50aGlzLmJhZ3NdLnJldmVyc2UoKSkge1xuICAgICAgcmV0ID0gcmV0Lm1lcmdlKGJhZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldC5hbGw7XG4gIH1cblxuICBwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGJhZyBvZiB0aGlzLmJhZ3MpIHtcbiAgICAgIGNvbnN0IHYgPSBiYWcuZ2V0KFtrZXldKTtcbiAgICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHsgcmV0dXJuIHY7IH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHB1YmxpYyBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICBmb3IgKGNvbnN0IGJhZyBvZiB0aGlzLmJhZ3MpIHtcbiAgICAgIGlmIChiYWcucmVhZE9ubHkpIHsgY29udGludWU7IH1cblxuICAgICAgLy8gQWxsIGJhZ3MgcGFzdCB0aGUgZmlyc3Qgb25lIGhhdmUgdGhlIHZhbHVlIGVyYXNlZFxuICAgICAgYmFnLnNldChba2V5XSwgdmFsdWUpO1xuICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVuc2V0KGtleTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXQoa2V5LCB1bmRlZmluZWQpO1xuICB9XG5cbiAgcHVibGljIGNsZWFyKCkge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIHRoaXMua2V5cykge1xuICAgICAgdGhpcy51bnNldChrZXkpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEEgc2luZ2xlIGJhZyBvZiBzZXR0aW5nc1xuICovXG5leHBvcnQgY2xhc3MgU2V0dGluZ3Mge1xuXG4gIC8qKlxuICAgKiBQYXJzZSBTZXR0aW5ncyBvdXQgb2YgQ0xJIGFyZ3VtZW50cy5cbiAgICogQHBhcmFtIGFyZ3YgdGhlIHJlY2VpdmVkIENMSSBhcmd1bWVudHMuXG4gICAqIEByZXR1cm5zIGEgbmV3IFNldHRpbmdzIG9iamVjdC5cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZnJvbUNvbW1hbmRMaW5lQXJndW1lbnRzKGFyZ3Y6IEFyZ3VtZW50cyk6IFNldHRpbmdzIHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5wYXJzZVN0cmluZ0NvbnRleHRMaXN0VG9PYmplY3QoYXJndik7XG4gICAgY29uc3QgdGFncyA9IHRoaXMucGFyc2VTdHJpbmdUYWdzTGlzdFRvT2JqZWN0KGV4cGVjdFN0cmluZ0xpc3QoYXJndi50YWdzKSk7XG5cbiAgICAvLyBEZXRlcm1pbmUgYnVuZGxpbmcgc3RhY2tzXG4gICAgbGV0IGJ1bmRsaW5nU3RhY2tzOiBzdHJpbmdbXTtcbiAgICBpZiAoQlVORExJTkdfQ09NTUFORFMuaW5jbHVkZXMoYXJndi5fWzBdKSkge1xuICAgIC8vIElmIHdlIGRlcGxveSwgZGlmZiBvciBzeW50aCBhIGxpc3Qgb2Ygc3RhY2tzIGV4Y2x1c2l2ZWx5IHdlIHNraXBcbiAgICAvLyBidW5kbGluZyBmb3IgYWxsIG90aGVyIHN0YWNrcy5cbiAgICAgIGJ1bmRsaW5nU3RhY2tzID0gYXJndi5leGNsdXNpdmVseVxuICAgICAgICA/IGFyZ3YuU1RBQ0tTID8/IFsnKiddXG4gICAgICAgIDogWycqJ107XG4gICAgfSBlbHNlIHsgLy8gU2tpcCBidW5kbGluZyBmb3IgYWxsIHN0YWNrc1xuICAgICAgYnVuZGxpbmdTdGFja3MgPSBbXTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFNldHRpbmdzKHtcbiAgICAgIGFwcDogYXJndi5hcHAsXG4gICAgICBicm93c2VyOiBhcmd2LmJyb3dzZXIsXG4gICAgICBjb250ZXh0LFxuICAgICAgZGVidWc6IGFyZ3YuZGVidWcsXG4gICAgICB0YWdzLFxuICAgICAgbGFuZ3VhZ2U6IGFyZ3YubGFuZ3VhZ2UsXG4gICAgICBwYXRoTWV0YWRhdGE6IGFyZ3YucGF0aE1ldGFkYXRhLFxuICAgICAgYXNzZXRNZXRhZGF0YTogYXJndi5hc3NldE1ldGFkYXRhLFxuICAgICAgcHJvZmlsZTogYXJndi5wcm9maWxlLFxuICAgICAgcGx1Z2luOiBhcmd2LnBsdWdpbixcbiAgICAgIHJlcXVpcmVBcHByb3ZhbDogYXJndi5yZXF1aXJlQXBwcm92YWwsXG4gICAgICB0b29sa2l0U3RhY2tOYW1lOiBhcmd2LnRvb2xraXRTdGFja05hbWUsXG4gICAgICBib290c3RyYXBRdWFsaWZpZXI6IGFyZ3YuYm9vdHN0cmFwUXVhbGlmaWVyLFxuICAgICAgdG9vbGtpdEJ1Y2tldDoge1xuICAgICAgICBidWNrZXROYW1lOiBhcmd2LmJvb3RzdHJhcEJ1Y2tldE5hbWUsXG4gICAgICAgIGttc0tleUlkOiBhcmd2LmJvb3RzdHJhcEttc0tleUlkLFxuICAgICAgfSxcbiAgICAgIHZlcnNpb25SZXBvcnRpbmc6IGFyZ3YudmVyc2lvblJlcG9ydGluZyxcbiAgICAgIHN0YWdpbmc6IGFyZ3Yuc3RhZ2luZyxcbiAgICAgIG91dHB1dDogYXJndi5vdXRwdXQsXG4gICAgICBwcm9ncmVzczogYXJndi5wcm9ncmVzcyxcbiAgICAgIGJ1bmRsaW5nU3RhY2tzLFxuICAgICAgbG9va3VwczogYXJndi5sb29rdXBzLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBtZXJnZUFsbCguLi5zZXR0aW5nczogU2V0dGluZ3NbXSk6IFNldHRpbmdzIHtcbiAgICBsZXQgcmV0ID0gbmV3IFNldHRpbmdzKCk7XG4gICAgZm9yIChjb25zdCBzZXR0aW5nIG9mIHNldHRpbmdzKSB7XG4gICAgICByZXQgPSByZXQubWVyZ2Uoc2V0dGluZyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBwYXJzZVN0cmluZ0NvbnRleHRMaXN0VG9PYmplY3QoYXJndjogQXJndW1lbnRzKTogYW55IHtcbiAgICBjb25zdCBjb250ZXh0OiBhbnkgPSB7fTtcblxuICAgIGZvciAoY29uc3QgYXNzaWdubWVudCBvZiAoKGFyZ3YgYXMgYW55KS5jb250ZXh0IHx8IFtdKSkge1xuICAgICAgY29uc3QgcGFydHMgPSBhc3NpZ25tZW50LnNwbGl0KC89KC4qKS8sIDIpO1xuICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICBkZWJ1ZygnQ0xJIGFyZ3VtZW50IGNvbnRleHQ6ICVzPSVzJywgcGFydHNbMF0sIHBhcnRzWzFdKTtcbiAgICAgICAgaWYgKHBhcnRzWzBdLm1hdGNoKC9eYXdzOi4rLykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVzZXItcHJvdmlkZWQgY29udGV4dCBjYW5ub3QgdXNlIGtleXMgcHJlZml4ZWQgd2l0aCAnYXdzOicsIGJ1dCAke3BhcnRzWzBdfSB3YXMgcHJvdmlkZWQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dFtwYXJ0c1swXV0gPSBwYXJ0c1sxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdhcm5pbmcoJ0NvbnRleHQgYXJndW1lbnQgaXMgbm90IGFuIGFzc2lnbm1lbnQgKGtleT12YWx1ZSk6ICVzJywgYXNzaWdubWVudCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRhZ3Mgb3V0IG9mIGFyZ3VtZW50c1xuICAgKlxuICAgKiBSZXR1cm4gdW5kZWZpbmVkIGlmIG5vIHRhZ3Mgd2VyZSBwcm92aWRlZCwgcmV0dXJuIGFuIGVtcHR5IGFycmF5IGlmIG9ubHkgZW1wdHlcbiAgICogc3RyaW5ncyB3ZXJlIHByb3ZpZGVkXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyBwYXJzZVN0cmluZ1RhZ3NMaXN0VG9PYmplY3QoYXJnVGFnczogc3RyaW5nW10gfCB1bmRlZmluZWQpOiBUYWdbXSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGFyZ1RhZ3MgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gICAgaWYgKGFyZ1RhZ3MubGVuZ3RoID09PSAwKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgICBjb25zdCBub25FbXB0eVRhZ3MgPSBhcmdUYWdzLmZpbHRlcih0ID0+IHQgIT09ICcnKTtcbiAgICBpZiAobm9uRW1wdHlUYWdzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gW107IH1cblxuICAgIGNvbnN0IHRhZ3M6IFRhZ1tdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGFzc2lnbm1lbnQgb2Ygbm9uRW1wdHlUYWdzKSB7XG4gICAgICBjb25zdCBwYXJ0cyA9IGFzc2lnbm1lbnQuc3BsaXQoJz0nLCAyKTtcbiAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgZGVidWcoJ0NMSSBhcmd1bWVudCB0YWdzOiAlcz0lcycsIHBhcnRzWzBdLCBwYXJ0c1sxXSk7XG4gICAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgICAgS2V5OiBwYXJ0c1swXSxcbiAgICAgICAgICBWYWx1ZTogcGFydHNbMV0sXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2FybmluZygnVGFncyBhcmd1bWVudCBpcyBub3QgYW4gYXNzaWdubWVudCAoa2V5PXZhbHVlKTogJXMnLCBhc3NpZ25tZW50KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRhZ3MubGVuZ3RoID4gMCA/IHRhZ3MgOiB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc01hcCA9IHt9LCBwdWJsaWMgcmVhZG9ubHkgcmVhZE9ubHkgPSBmYWxzZSkge31cblxuICBwdWJsaWMgYXN5bmMgbG9hZChmaWxlTmFtZTogc3RyaW5nKTogUHJvbWlzZTx0aGlzPiB7XG4gICAgaWYgKHRoaXMucmVhZE9ubHkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgbG9hZCAke2ZpbGVOYW1lfTogc2V0dGluZ3Mgb2JqZWN0IGlzIHJlYWRvbmx5YCk7XG4gICAgfVxuICAgIHRoaXMuc2V0dGluZ3MgPSB7fTtcblxuICAgIGNvbnN0IGV4cGFuZGVkID0gZXhwYW5kSG9tZURpcihmaWxlTmFtZSk7XG4gICAgaWYgKGF3YWl0IGZzLnBhdGhFeGlzdHMoZXhwYW5kZWQpKSB7XG4gICAgICB0aGlzLnNldHRpbmdzID0gYXdhaXQgZnMucmVhZEpzb24oZXhwYW5kZWQpO1xuICAgIH1cblxuICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1jZGsvaXNzdWVzLzU5XG4gICAgdGhpcy5wcm9oaWJpdENvbnRleHRLZXkoJ2RlZmF1bHQtYWNjb3VudCcsIGZpbGVOYW1lKTtcbiAgICB0aGlzLnByb2hpYml0Q29udGV4dEtleSgnZGVmYXVsdC1yZWdpb24nLCBmaWxlTmFtZSk7XG4gICAgdGhpcy53YXJuQWJvdXRDb250ZXh0S2V5KCdhd3M6JywgZmlsZU5hbWUpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc2F2ZShmaWxlTmFtZTogc3RyaW5nKTogUHJvbWlzZTx0aGlzPiB7XG4gICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRIb21lRGlyKGZpbGVOYW1lKTtcbiAgICBhd2FpdCBmcy53cml0ZUpzb24oZXhwYW5kZWQsIHN0cmlwVHJhbnNpZW50VmFsdWVzKHRoaXMuc2V0dGluZ3MpLCB7IHNwYWNlczogMiB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYWxsKCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KFtdKTtcbiAgfVxuXG4gIHB1YmxpYyBtZXJnZShvdGhlcjogU2V0dGluZ3MpOiBTZXR0aW5ncyB7XG4gICAgcmV0dXJuIG5ldyBTZXR0aW5ncyh1dGlsLmRlZXBNZXJnZSh0aGlzLnNldHRpbmdzLCBvdGhlci5zZXR0aW5ncykpO1xuICB9XG5cbiAgcHVibGljIHN1YlNldHRpbmdzKGtleVByZWZpeDogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gbmV3IFNldHRpbmdzKHRoaXMuZ2V0KGtleVByZWZpeCkgfHwge30sIGZhbHNlKTtcbiAgfVxuXG4gIHB1YmxpYyBtYWtlUmVhZE9ubHkoKTogU2V0dGluZ3Mge1xuICAgIHJldHVybiBuZXcgU2V0dGluZ3ModGhpcy5zZXR0aW5ncywgdHJ1ZSk7XG4gIH1cblxuICBwdWJsaWMgY2xlYXIoKSB7XG4gICAgaWYgKHRoaXMucmVhZE9ubHkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNsZWFyKCk6IHNldHRpbmdzIGFyZSByZWFkb25seScpO1xuICAgIH1cbiAgICB0aGlzLnNldHRpbmdzID0ge307XG4gIH1cblxuICBwdWJsaWMgZ2V0IGVtcHR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnNldHRpbmdzKS5sZW5ndGggPT09IDA7XG4gIH1cblxuICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZ1tdKTogYW55IHtcbiAgICByZXR1cm4gdXRpbC5kZWVwQ2xvbmUodXRpbC5kZWVwR2V0KHRoaXMuc2V0dGluZ3MsIHBhdGgpKTtcbiAgfVxuXG4gIHB1YmxpYyBzZXQocGF0aDogc3RyaW5nW10sIHZhbHVlOiBhbnkpOiBTZXR0aW5ncyB7XG4gICAgaWYgKHRoaXMucmVhZE9ubHkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc2V0ICR7cGF0aH06IHNldHRpbmdzIG9iamVjdCBpcyByZWFkb25seWApO1xuICAgIH1cbiAgICBpZiAocGF0aC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIGRlZXBTZXQgY2FuJ3QgaGFuZGxlIHRoaXMgY2FzZVxuICAgICAgdGhpcy5zZXR0aW5ncyA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB1dGlsLmRlZXBTZXQodGhpcy5zZXR0aW5ncywgcGF0aCwgdmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyB1bnNldChwYXRoOiBzdHJpbmdbXSkge1xuICAgIHRoaXMuc2V0KHBhdGgsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBwcml2YXRlIHByb2hpYml0Q29udGV4dEtleShrZXk6IHN0cmluZywgZmlsZU5hbWU6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5jb250ZXh0KSB7IHJldHVybjsgfVxuICAgIGlmIChrZXkgaW4gdGhpcy5zZXR0aW5ncy5jb250ZXh0KSB7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ2NvbnRleHQuJHtrZXl9JyBrZXkgd2FzIGZvdW5kIGluICR7ZnNfcGF0aC5yZXNvbHZlKGZpbGVOYW1lKX0sIGJ1dCBpdCBpcyBubyBsb25nZXIgc3VwcG9ydGVkLiBQbGVhc2UgcmVtb3ZlIGl0LmApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgd2FybkFib3V0Q29udGV4dEtleShwcmVmaXg6IHN0cmluZywgZmlsZU5hbWU6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5jb250ZXh0KSB7IHJldHVybjsgfVxuICAgIGZvciAoY29uc3QgY29udGV4dEtleSBvZiBPYmplY3Qua2V5cyh0aGlzLnNldHRpbmdzLmNvbnRleHQpKSB7XG4gICAgICBpZiAoY29udGV4dEtleS5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICAgICAgd2FybmluZyhgQSByZXNlcnZlZCBjb250ZXh0IGtleSAoJ2NvbnRleHQuJHtwcmVmaXh9Jykga2V5IHdhcyBmb3VuZCBpbiAke2ZzX3BhdGgucmVzb2x2ZShmaWxlTmFtZSl9LCBpdCBtaWdodCBjYXVzZSBzdXJwcmlzaW5nIGJlaGF2aW9yIGFuZCBzaG91bGQgYmUgcmVtb3ZlZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZXhwYW5kSG9tZURpcih4OiBzdHJpbmcpIHtcbiAgaWYgKHguc3RhcnRzV2l0aCgnficpKSB7XG4gICAgcmV0dXJuIGZzX3BhdGguam9pbihvcy5ob21lZGlyKCksIHguc3Vic3RyKDEpKTtcbiAgfVxuICByZXR1cm4geDtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYWxsIGNvbnRleHQgdmFsdWUgdGhhdCBhcmUgbm90IHRyYW5zaWVudCBjb250ZXh0IHZhbHVlc1xuICovXG5mdW5jdGlvbiBzdHJpcFRyYW5zaWVudFZhbHVlcyhvYmo6IHtba2V5OiBzdHJpbmddOiBhbnl9KSB7XG4gIGNvbnN0IHJldDogYW55ID0ge307XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG9iaikpIHtcbiAgICBpZiAoIWlzVHJhbnNpZW50VmFsdWUodmFsdWUpKSB7XG4gICAgICByZXRba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIFJldHVybiB3aGV0aGVyIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIHRyYW5zaWVudCBjb250ZXh0IHZhbHVlXG4gKlxuICogVmFsdWVzIHRoYXQgYXJlIG9iamVjdHMgd2l0aCBhIG1hZ2ljIGtleSBzZXQgdG8gYSB0cnV0aHkgdmFsdWUgYXJlIGNvbnNpZGVyZWQgdHJhbnNpZW50LlxuICovXG5mdW5jdGlvbiBpc1RyYW5zaWVudFZhbHVlKHZhbHVlOiBhbnkpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwgJiYgKHZhbHVlIGFzIGFueSlbVFJBTlNJRU5UX0NPTlRFWFRfS0VZXTtcbn1cblxuZnVuY3Rpb24gZXhwZWN0U3RyaW5nTGlzdCh4OiB1bmtub3duKTogc3RyaW5nW10gfCB1bmRlZmluZWQge1xuICBpZiAoeCA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgaWYgKCFBcnJheS5pc0FycmF5KHgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcnJheSwgZ290ICcke3h9J2ApO1xuICB9XG4gIGNvbnN0IG5vblN0cmluZ3MgPSB4LmZpbHRlcihlID0+IHR5cGVvZiBlICE9PSAnc3RyaW5nJyk7XG4gIGlmIChub25TdHJpbmdzLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGxpc3Qgb2Ygc3RyaW5ncywgZm91bmQgJHtub25TdHJpbmdzfWApO1xuICB9XG4gIHJldHVybiB4O1xufVxuIl19