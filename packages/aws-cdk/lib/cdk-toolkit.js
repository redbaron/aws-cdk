"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkToolkit = void 0;
const path = require("path");
const util_1 = require("util");
const colors = require("colors/safe");
const fs = require("fs-extra");
const promptly = require("promptly");
const environments_1 = require("../lib/api/cxapp/environments");
const cloud_assembly_1 = require("./api/cxapp/cloud-assembly");
const diff_1 = require("./diff");
const logging_1 = require("./logging");
const serialize_1 = require("./serialize");
const util_2 = require("./util");
/**
 * Toolkit logic
 *
 * The toolkit runs the `cloudExecutable` to obtain a cloud assembly and
 * deploys applies them to `cloudFormation`.
 */
class CdkToolkit {
    constructor(props) {
        this.props = props;
    }
    async metadata(stackName) {
        var _a;
        const stacks = await this.selectSingleStackByName(stackName);
        return (_a = stacks.firstStack.manifest.metadata) !== null && _a !== void 0 ? _a : {};
    }
    async diff(options) {
        const stacks = await this.selectStacksForDiff(options.stackNames, options.exclusively);
        const strict = !!options.strict;
        const contextLines = options.contextLines || 3;
        const stream = options.stream || process.stderr;
        let diffs = 0;
        if (options.templatePath !== undefined) {
            // Compare single stack against fixed template
            if (stacks.stackCount !== 1) {
                throw new Error('Can only select one stack when comparing to fixed template. Use --exclusively to avoid selecting multiple stacks.');
            }
            if (!await fs.pathExists(options.templatePath)) {
                throw new Error(`There is no file at ${options.templatePath}`);
            }
            const template = serialize_1.deserializeStructure(await fs.readFile(options.templatePath, { encoding: 'UTF-8' }));
            diffs = diff_1.printStackDiff(template, stacks.firstStack, strict, contextLines, stream);
        }
        else {
            // Compare N stacks against deployed templates
            for (const stack of stacks.stackArtifacts) {
                stream.write(util_1.format('Stack %s\n', colors.bold(stack.displayName)));
                const currentTemplate = await this.props.cloudFormation.readCurrentTemplate(stack);
                diffs += diff_1.printStackDiff(currentTemplate, stack, strict, contextLines, stream);
            }
        }
        return diffs && options.fail ? 1 : 0;
    }
    async deploy(options) {
        const stacks = await this.selectStacksForDeploy(options.stackNames, options.exclusively);
        const requireApproval = options.requireApproval !== undefined ? options.requireApproval : diff_1.RequireApproval.Broadening;
        const parameterMap = { '*': {} };
        for (const key in options.parameters) {
            if (options.parameters.hasOwnProperty(key)) {
                const [stack, parameter] = key.split(':', 2);
                if (!parameter) {
                    parameterMap['*'][stack] = options.parameters[key];
                }
                else {
                    if (!parameterMap[stack]) {
                        parameterMap[stack] = {};
                    }
                    parameterMap[stack][parameter] = options.parameters[key];
                }
            }
        }
        const stackOutputs = {};
        const outputsFile = options.outputsFile;
        for (const stack of stacks.stackArtifacts) {
            if (stacks.stackCount !== 1) {
                logging_1.highlight(stack.displayName);
            }
            if (!stack.environment) {
                // eslint-disable-next-line max-len
                throw new Error(`Stack ${stack.displayName} does not define an environment, and AWS credentials could not be obtained from standard locations or no region was configured.`);
            }
            if (Object.keys(stack.template.Resources || {}).length === 0) { // The generated stack has no resources
                if (!await this.props.cloudFormation.stackExists({ stack })) {
                    logging_1.warning('%s: stack has no resources, skipping deployment.', colors.bold(stack.displayName));
                }
                else {
                    logging_1.warning('%s: stack has no resources, deleting existing stack.', colors.bold(stack.displayName));
                    await this.destroy({
                        stackNames: [stack.stackName],
                        exclusively: true,
                        force: true,
                        roleArn: options.roleArn,
                        fromDeploy: true,
                    });
                }
                continue;
            }
            if (requireApproval !== diff_1.RequireApproval.Never) {
                const currentTemplate = await this.props.cloudFormation.readCurrentTemplate(stack);
                if (diff_1.printSecurityDiff(currentTemplate, stack, requireApproval)) {
                    // only talk to user if STDIN is a terminal (otherwise, fail)
                    if (!process.stdin.isTTY) {
                        throw new Error('"--require-approval" is enabled and stack includes security-sensitive updates, ' +
                            'but terminal (TTY) is not attached so we are unable to get a confirmation from the user');
                    }
                    const confirmed = await promptly.confirm('Do you wish to deploy these changes (y/n)?');
                    if (!confirmed) {
                        throw new Error('Aborted by user');
                    }
                }
            }
            logging_1.print('%s: deploying...', colors.bold(stack.displayName));
            let tags = options.tags;
            if (!tags || tags.length === 0) {
                tags = tagsForStack(stack);
            }
            try {
                const result = await this.props.cloudFormation.deployStack({
                    stack,
                    deployName: stack.stackName,
                    roleArn: options.roleArn,
                    bootstrapQualifier: options.bootstrapQualifier,
                    reuseAssets: options.reuseAssets,
                    notificationArns: options.notificationArns,
                    tags,
                    execute: options.execute,
                    force: options.force,
                    parameters: Object.assign({}, parameterMap['*'], parameterMap[stack.stackName]),
                    usePreviousParameters: options.usePreviousParameters,
                    progress: options.progress,
                    ci: options.ci,
                });
                const message = result.noOp
                    ? ' ✅  %s (no changes)'
                    : ' ✅  %s';
                logging_1.success('\n' + message, stack.displayName);
                if (Object.keys(result.outputs).length > 0) {
                    logging_1.print('\nOutputs:');
                    stackOutputs[stack.stackName] = result.outputs;
                }
                for (const name of Object.keys(result.outputs).sort()) {
                    const value = result.outputs[name];
                    logging_1.print('%s.%s = %s', colors.cyan(stack.id), colors.cyan(name), colors.underline(colors.cyan(value)));
                }
                logging_1.print('\nStack ARN:');
                logging_1.data(result.stackArn);
            }
            catch (e) {
                logging_1.error('\n ❌  %s failed: %s', colors.bold(stack.displayName), e);
                throw e;
            }
            finally {
                // If an outputs file has been specified, create the file path and write stack outputs to it once.
                // Outputs are written after all stacks have been deployed. If a stack deployment fails,
                // all of the outputs from successfully deployed stacks before the failure will still be written.
                if (outputsFile) {
                    fs.ensureFileSync(outputsFile);
                    await fs.writeJson(outputsFile, stackOutputs, {
                        spaces: 2,
                        encoding: 'utf8',
                    });
                }
            }
        }
    }
    async destroy(options) {
        let stacks = await this.selectStacksForDestroy(options.stackNames, options.exclusively);
        // The stacks will have been ordered for deployment, so reverse them for deletion.
        stacks = stacks.reversed();
        if (!options.force) {
            // eslint-disable-next-line max-len
            const confirmed = await promptly.confirm(`Are you sure you want to delete: ${colors.blue(stacks.stackArtifacts.map(s => s.id).join(', '))} (y/n)?`);
            if (!confirmed) {
                return;
            }
        }
        const action = options.fromDeploy ? 'deploy' : 'destroy';
        for (const stack of stacks.stackArtifacts) {
            logging_1.success('%s: destroying...', colors.blue(stack.displayName));
            try {
                await this.props.cloudFormation.destroyStack({
                    stack,
                    deployName: stack.stackName,
                    roleArn: options.roleArn,
                });
                logging_1.success(`\n ✅  %s: ${action}ed`, colors.blue(stack.displayName));
            }
            catch (e) {
                logging_1.error(`\n ❌  %s: ${action} failed`, colors.blue(stack.displayName), e);
                throw e;
            }
        }
    }
    async list(selectors, options = {}) {
        const stacks = await this.selectStacksForList(selectors);
        // if we are in "long" mode, emit the array as-is (JSON/YAML)
        if (options.long) {
            const long = [];
            for (const stack of stacks.stackArtifacts) {
                long.push({
                    id: stack.id,
                    name: stack.stackName,
                    environment: stack.environment,
                });
            }
            return long; // will be YAML formatted output
        }
        // just print stack IDs
        for (const stack of stacks.stackArtifacts) {
            logging_1.data(stack.id);
        }
        return 0; // exit-code
    }
    /**
     * Synthesize the given set of stacks (called when the user runs 'cdk synth')
     *
     * INPUT: Stack names can be supplied using a glob filter. If no stacks are
     * given, all stacks from the application are implictly selected.
     *
     * OUTPUT: If more than one stack ends up being selected, an output directory
     * should be supplied, where the templates will be written.
     */
    async synth(stackNames, exclusively) {
        const stacks = await this.selectStacksForDiff(stackNames, exclusively);
        // if we have a single stack, print it to STDOUT
        if (stacks.stackCount === 1) {
            return stacks.firstStack.template;
        }
        // This is a slight hack; in integ mode we allow multiple stacks to be synthesized to stdout sequentially.
        // This is to make it so that we can support multi-stack integ test expectations, without so drastically
        // having to change the synthesis format that we have to rerun all integ tests.
        //
        // Because this feature is not useful to consumers (the output is missing
        // the stack names), it's not exposed as a CLI flag. Instead, it's hidden
        // behind an environment variable.
        const isIntegMode = process.env.CDK_INTEG_MODE === '1';
        if (isIntegMode) {
            return stacks.stackArtifacts.map(s => s.template);
        }
        // not outputting template to stdout, let's explain things to the user a little bit...
        logging_1.success(`Successfully synthesized to ${colors.blue(path.resolve(stacks.assembly.directory))}`);
        logging_1.print(`Supply a stack id (${stacks.stackArtifacts.map(s => colors.green(s.id)).join(', ')}) to display its template.`);
        return undefined;
    }
    /**
     * Bootstrap the CDK Toolkit stack in the accounts used by the specified stack(s).
     *
     * @param environmentSpecs environment names that need to have toolkit support
     *             provisioned, as a glob filter. If none is provided,
     *             all stacks are implicitly selected.
     * @param toolkitStackName the name to be used for the CDK Toolkit stack.
     */
    async bootstrap(environmentSpecs, bootstrapper, options) {
        // If there is an '--app' argument and an environment looks like a glob, we
        // select the environments from the app. Otherwise use what the user said.
        // By default glob for everything
        environmentSpecs = environmentSpecs.length > 0 ? environmentSpecs : ['**'];
        // Partition into globs and non-globs (this will mutate environmentSpecs).
        const globSpecs = util_2.partition(environmentSpecs, environments_1.looksLikeGlob);
        if (globSpecs.length > 0 && !this.props.cloudExecutable.hasApp) {
            throw new Error(`'${globSpecs}' is not an environment name. Run in app directory to glob or specify an environment name like \'aws://123456789012/us-east-1\'.`);
        }
        const environments = [
            ...environments_1.environmentsFromDescriptors(environmentSpecs),
        ];
        // If there is an '--app' argument, select the environments from the app.
        if (this.props.cloudExecutable.hasApp) {
            environments.push(...await environments_1.globEnvironmentsFromStacks(await this.selectStacksForList([]), globSpecs, this.props.sdkProvider));
        }
        await Promise.all(environments.map(async (environment) => {
            logging_1.success(' ⏳  Bootstrapping environment %s...', colors.blue(environment.name));
            try {
                const result = await bootstrapper.bootstrapEnvironment(environment, this.props.sdkProvider, options);
                const message = result.noOp
                    ? ' ✅  Environment %s bootstrapped (no changes).'
                    : ' ✅  Environment %s bootstrapped.';
                logging_1.success(message, colors.blue(environment.name));
            }
            catch (e) {
                logging_1.error(' ❌  Environment %s failed bootstrapping: %s', colors.blue(environment.name), e);
                throw e;
            }
        }));
    }
    async selectStacksForList(selectors) {
        const assembly = await this.assembly();
        const stacks = await assembly.selectStacks(selectors, { defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks });
        // No validation
        return stacks;
    }
    async selectStacksForDeploy(stackNames, exclusively) {
        const assembly = await this.assembly();
        const stacks = await assembly.selectStacks(stackNames, {
            extend: exclusively ? cloud_assembly_1.ExtendedStackSelection.None : cloud_assembly_1.ExtendedStackSelection.Upstream,
            defaultBehavior: cloud_assembly_1.DefaultSelection.OnlySingle,
        });
        await this.validateStacks(stacks);
        return stacks;
    }
    async selectStacksForDiff(stackNames, exclusively) {
        const assembly = await this.assembly();
        const stacks = await assembly.selectStacks(stackNames, {
            extend: exclusively ? cloud_assembly_1.ExtendedStackSelection.None : cloud_assembly_1.ExtendedStackSelection.Upstream,
            defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks,
        });
        await this.validateStacks(stacks);
        return stacks;
    }
    async selectStacksForDestroy(stackNames, exclusively) {
        const assembly = await this.assembly();
        const stacks = await assembly.selectStacks(stackNames, {
            extend: exclusively ? cloud_assembly_1.ExtendedStackSelection.None : cloud_assembly_1.ExtendedStackSelection.Downstream,
            defaultBehavior: cloud_assembly_1.DefaultSelection.OnlySingle,
        });
        // No validation
        return stacks;
    }
    /**
     * Validate the stacks for errors and warnings according to the CLI's current settings
     */
    async validateStacks(stacks) {
        stacks.processMetadataMessages({
            ignoreErrors: this.props.ignoreErrors,
            strict: this.props.strict,
            verbose: this.props.verbose,
        });
    }
    /**
     * Select a single stack by its name
     */
    async selectSingleStackByName(stackName) {
        const assembly = await this.assembly();
        const stacks = await assembly.selectStacks([stackName], {
            extend: cloud_assembly_1.ExtendedStackSelection.None,
            defaultBehavior: cloud_assembly_1.DefaultSelection.None,
        });
        // Could have been a glob so check that we evaluated to exactly one
        if (stacks.stackCount > 1) {
            throw new Error(`This command requires exactly one stack and we matched more than one: ${stacks.stackIds}`);
        }
        return assembly.stackById(stacks.firstStack.id);
    }
    assembly() {
        return this.props.cloudExecutable.synthesize();
    }
}
exports.CdkToolkit = CdkToolkit;
/**
 * @returns an array with the tags available in the stack metadata.
 */
function tagsForStack(stack) {
    return Object.entries(stack.tags).map(([Key, Value]) => ({ Key, Value }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXRvb2xraXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjZGstdG9vbGtpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBNkI7QUFDN0IsK0JBQThCO0FBRTlCLHNDQUFzQztBQUN0QywrQkFBK0I7QUFDL0IscUNBQXFDO0FBQ3JDLGdFQUF1SDtBQUl2SCwrREFBc0g7QUFHdEgsaUNBQTRFO0FBQzVFLHVDQUE0RTtBQUM1RSwyQ0FBbUQ7QUFFbkQsaUNBQW1DO0FBOENuQzs7Ozs7R0FLRztBQUNILE1BQWEsVUFBVTtJQUNyQixZQUE2QixLQUFzQjtRQUF0QixVQUFLLEdBQUwsS0FBSyxDQUFpQjtJQUNuRCxDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFpQjs7UUFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDN0QsYUFBTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLG1DQUFJLEVBQUUsQ0FBQztJQUNuRCxDQUFDO0lBRU0sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFvQjtRQUNwQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV2RixNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUNoQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQztRQUMvQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFFaEQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ2QsSUFBSSxPQUFPLENBQUMsWUFBWSxLQUFLLFNBQVMsRUFBRTtZQUN0Qyw4Q0FBOEM7WUFDOUMsSUFBSSxNQUFNLENBQUMsVUFB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RyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcnMvc2FmZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgKiBhcyBwcm9tcHRseSBmcm9tICdwcm9tcHRseSc7XG5pbXBvcnQgeyBlbnZpcm9ubWVudHNGcm9tRGVzY3JpcHRvcnMsIGdsb2JFbnZpcm9ubWVudHNGcm9tU3RhY2tzLCBsb29rc0xpa2VHbG9iIH0gZnJvbSAnLi4vbGliL2FwaS9jeGFwcC9lbnZpcm9ubWVudHMnO1xuaW1wb3J0IHsgU2RrUHJvdmlkZXIgfSBmcm9tICcuL2FwaS9hd3MtYXV0aCc7XG5pbXBvcnQgeyBCb290c3RyYXBwZXIsIEJvb3RzdHJhcEVudmlyb25tZW50T3B0aW9ucyB9IGZyb20gJy4vYXBpL2Jvb3RzdHJhcCc7XG5pbXBvcnQgeyBDbG91ZEZvcm1hdGlvbkRlcGxveW1lbnRzIH0gZnJvbSAnLi9hcGkvY2xvdWRmb3JtYXRpb24tZGVwbG95bWVudHMnO1xuaW1wb3J0IHsgQ2xvdWRBc3NlbWJseSwgRGVmYXVsdFNlbGVjdGlvbiwgRXh0ZW5kZWRTdGFja1NlbGVjdGlvbiwgU3RhY2tDb2xsZWN0aW9uIH0gZnJvbSAnLi9hcGkvY3hhcHAvY2xvdWQtYXNzZW1ibHknO1xuaW1wb3J0IHsgQ2xvdWRFeGVjdXRhYmxlIH0gZnJvbSAnLi9hcGkvY3hhcHAvY2xvdWQtZXhlY3V0YWJsZSc7XG5pbXBvcnQgeyBTdGFja0FjdGl2aXR5UHJvZ3Jlc3MgfSBmcm9tICcuL2FwaS91dGlsL2Nsb3VkZm9ybWF0aW9uL3N0YWNrLWFjdGl2aXR5LW1vbml0b3InO1xuaW1wb3J0IHsgcHJpbnRTZWN1cml0eURpZmYsIHByaW50U3RhY2tEaWZmLCBSZXF1aXJlQXBwcm92YWwgfSBmcm9tICcuL2RpZmYnO1xuaW1wb3J0IHsgZGF0YSwgZXJyb3IsIGhpZ2hsaWdodCwgcHJpbnQsIHN1Y2Nlc3MsIHdhcm5pbmcgfSBmcm9tICcuL2xvZ2dpbmcnO1xuaW1wb3J0IHsgZGVzZXJpYWxpemVTdHJ1Y3R1cmUgfSBmcm9tICcuL3NlcmlhbGl6ZSc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBwYXJ0aXRpb24gfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENka1Rvb2xraXRQcm9wcyB7XG5cbiAgLyoqXG4gICAqIFRoZSBDbG91ZCBFeGVjdXRhYmxlXG4gICAqL1xuICBjbG91ZEV4ZWN1dGFibGU6IENsb3VkRXhlY3V0YWJsZTtcblxuICAvKipcbiAgICogVGhlIHByb3Zpc2lvbmluZyBlbmdpbmUgdXNlZCB0byBhcHBseSBjaGFuZ2VzIHRvIHRoZSBjbG91ZFxuICAgKi9cbiAgY2xvdWRGb3JtYXRpb246IENsb3VkRm9ybWF0aW9uRGVwbG95bWVudHM7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gYmUgdmVyYm9zZVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgdmVyYm9zZT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIERvbid0IHN0b3Agb24gZXJyb3IgbWV0YWRhdGFcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGlnbm9yZUVycm9ycz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRyZWF0IHdhcm5pbmdzIGluIG1ldGFkYXRhIGFzIGVycm9yc1xuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgc3RyaWN0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQXBwbGljYXRpb24gY29uZmlndXJhdGlvbiAoc2V0dGluZ3MgYW5kIGNvbnRleHQpXG4gICAqL1xuICBjb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uO1xuXG4gIC8qKlxuICAgKiBBV1Mgb2JqZWN0ICh1c2VkIGJ5IHN5bnRoZXNpemVyIGFuZCBjb250ZXh0cHJvdmlkZXIpXG4gICAqL1xuICBzZGtQcm92aWRlcjogU2RrUHJvdmlkZXI7XG59XG5cbi8qKlxuICogVG9vbGtpdCBsb2dpY1xuICpcbiAqIFRoZSB0b29sa2l0IHJ1bnMgdGhlIGBjbG91ZEV4ZWN1dGFibGVgIHRvIG9idGFpbiBhIGNsb3VkIGFzc2VtYmx5IGFuZFxuICogZGVwbG95cyBhcHBsaWVzIHRoZW0gdG8gYGNsb3VkRm9ybWF0aW9uYC5cbiAqL1xuZXhwb3J0IGNsYXNzIENka1Rvb2xraXQge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByb3BzOiBDZGtUb29sa2l0UHJvcHMpIHtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBtZXRhZGF0YShzdGFja05hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IHRoaXMuc2VsZWN0U2luZ2xlU3RhY2tCeU5hbWUoc3RhY2tOYW1lKTtcbiAgICByZXR1cm4gc3RhY2tzLmZpcnN0U3RhY2subWFuaWZlc3QubWV0YWRhdGEgPz8ge307XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGlmZihvcHRpb25zOiBEaWZmT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3Qgc3RhY2tzID0gYXdhaXQgdGhpcy5zZWxlY3RTdGFja3NGb3JEaWZmKG9wdGlvbnMuc3RhY2tOYW1lcywgb3B0aW9ucy5leGNsdXNpdmVseSk7XG5cbiAgICBjb25zdCBzdHJpY3QgPSAhIW9wdGlvbnMuc3RyaWN0O1xuICAgIGNvbnN0IGNvbnRleHRMaW5lcyA9IG9wdGlvbnMuY29udGV4dExpbmVzIHx8IDM7XG4gICAgY29uc3Qgc3RyZWFtID0gb3B0aW9ucy5zdHJlYW0gfHwgcHJvY2Vzcy5zdGRlcnI7XG5cbiAgICBsZXQgZGlmZnMgPSAwO1xuICAgIGlmIChvcHRpb25zLnRlbXBsYXRlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBDb21wYXJlIHNpbmdsZSBzdGFjayBhZ2FpbnN0IGZpeGVkIHRlbXBsYXRlXG4gICAgICBpZiAoc3RhY2tzLnN0YWNrQ291bnQgIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBzZWxlY3Qgb25lIHN0YWNrIHdoZW4gY29tcGFyaW5nIHRvIGZpeGVkIHRlbXBsYXRlLiBVc2UgLS1leGNsdXNpdmVseSB0byBhdm9pZCBzZWxlY3RpbmcgbXVsdGlwbGUgc3RhY2tzLicpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWF3YWl0IGZzLnBhdGhFeGlzdHMob3B0aW9ucy50ZW1wbGF0ZVBhdGgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlcmUgaXMgbm8gZmlsZSBhdCAke29wdGlvbnMudGVtcGxhdGVQYXRofWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcGxhdGUgPSBkZXNlcmlhbGl6ZVN0cnVjdHVyZShhd2FpdCBmcy5yZWFkRmlsZShvcHRpb25zLnRlbXBsYXRlUGF0aCwgeyBlbmNvZGluZzogJ1VURi04JyB9KSk7XG4gICAgICBkaWZmcyA9IHByaW50U3RhY2tEaWZmKHRlbXBsYXRlLCBzdGFja3MuZmlyc3RTdGFjaywgc3RyaWN0LCBjb250ZXh0TGluZXMsIHN0cmVhbSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENvbXBhcmUgTiBzdGFja3MgYWdhaW5zdCBkZXBsb3llZCB0ZW1wbGF0ZXNcbiAgICAgIGZvciAoY29uc3Qgc3RhY2sgb2Ygc3RhY2tzLnN0YWNrQXJ0aWZhY3RzKSB7XG4gICAgICAgIHN0cmVhbS53cml0ZShmb3JtYXQoJ1N0YWNrICVzXFxuJywgY29sb3JzLmJvbGQoc3RhY2suZGlzcGxheU5hbWUpKSk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRUZW1wbGF0ZSA9IGF3YWl0IHRoaXMucHJvcHMuY2xvdWRGb3JtYXRpb24ucmVhZEN1cnJlbnRUZW1wbGF0ZShzdGFjayk7XG4gICAgICAgIGRpZmZzICs9IHByaW50U3RhY2tEaWZmKGN1cnJlbnRUZW1wbGF0ZSwgc3RhY2ssIHN0cmljdCwgY29udGV4dExpbmVzLCBzdHJlYW0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkaWZmcyAmJiBvcHRpb25zLmZhaWwgPyAxIDogMDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXBsb3kob3B0aW9uczogRGVwbG95T3B0aW9ucykge1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IHRoaXMuc2VsZWN0U3RhY2tzRm9yRGVwbG95KG9wdGlvbnMuc3RhY2tOYW1lcywgb3B0aW9ucy5leGNsdXNpdmVseSk7XG5cbiAgICBjb25zdCByZXF1aXJlQXBwcm92YWwgPSBvcHRpb25zLnJlcXVpcmVBcHByb3ZhbCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5yZXF1aXJlQXBwcm92YWwgOiBSZXF1aXJlQXBwcm92YWwuQnJvYWRlbmluZztcblxuICAgIGNvbnN0IHBhcmFtZXRlck1hcDogeyBbbmFtZTogc3RyaW5nXTogeyBbbmFtZTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkIH0gfSA9IHsgJyonOiB7fSB9O1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9wdGlvbnMucGFyYW1ldGVycykge1xuICAgICAgaWYgKG9wdGlvbnMucGFyYW1ldGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIGNvbnN0IFtzdGFjaywgcGFyYW1ldGVyXSA9IGtleS5zcGxpdCgnOicsIDIpO1xuICAgICAgICBpZiAoIXBhcmFtZXRlcikge1xuICAgICAgICAgIHBhcmFtZXRlck1hcFsnKiddW3N0YWNrXSA9IG9wdGlvbnMucGFyYW1ldGVyc1trZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICghcGFyYW1ldGVyTWFwW3N0YWNrXSkge1xuICAgICAgICAgICAgcGFyYW1ldGVyTWFwW3N0YWNrXSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJhbWV0ZXJNYXBbc3RhY2tdW3BhcmFtZXRlcl0gPSBvcHRpb25zLnBhcmFtZXRlcnNba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHN0YWNrT3V0cHV0czogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRzRmlsZSA9IG9wdGlvbnMub3V0cHV0c0ZpbGU7XG5cbiAgICBmb3IgKGNvbnN0IHN0YWNrIG9mIHN0YWNrcy5zdGFja0FydGlmYWN0cykge1xuICAgICAgaWYgKHN0YWNrcy5zdGFja0NvdW50ICE9PSAxKSB7IGhpZ2hsaWdodChzdGFjay5kaXNwbGF5TmFtZSk7IH1cbiAgICAgIGlmICghc3RhY2suZW52aXJvbm1lbnQpIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdGFjayAke3N0YWNrLmRpc3BsYXlOYW1lfSBkb2VzIG5vdCBkZWZpbmUgYW4gZW52aXJvbm1lbnQsIGFuZCBBV1MgY3JlZGVudGlhbHMgY291bGQgbm90IGJlIG9idGFpbmVkIGZyb20gc3RhbmRhcmQgbG9jYXRpb25zIG9yIG5vIHJlZ2lvbiB3YXMgY29uZmlndXJlZC5gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKE9iamVjdC5rZXlzKHN0YWNrLnRlbXBsYXRlLlJlc291cmNlcyB8fCB7fSkubGVuZ3RoID09PSAwKSB7IC8vIFRoZSBnZW5lcmF0ZWQgc3RhY2sgaGFzIG5vIHJlc291cmNlc1xuICAgICAgICBpZiAoIWF3YWl0IHRoaXMucHJvcHMuY2xvdWRGb3JtYXRpb24uc3RhY2tFeGlzdHMoeyBzdGFjayB9KSkge1xuICAgICAgICAgIHdhcm5pbmcoJyVzOiBzdGFjayBoYXMgbm8gcmVzb3VyY2VzLCBza2lwcGluZyBkZXBsb3ltZW50LicsIGNvbG9ycy5ib2xkKHN0YWNrLmRpc3BsYXlOYW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2FybmluZygnJXM6IHN0YWNrIGhhcyBubyByZXNvdXJjZXMsIGRlbGV0aW5nIGV4aXN0aW5nIHN0YWNrLicsIGNvbG9ycy5ib2xkKHN0YWNrLmRpc3BsYXlOYW1lKSk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5kZXN0cm95KHtcbiAgICAgICAgICAgIHN0YWNrTmFtZXM6IFtzdGFjay5zdGFja05hbWVdLFxuICAgICAgICAgICAgZXhjbHVzaXZlbHk6IHRydWUsXG4gICAgICAgICAgICBmb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHJvbGVBcm46IG9wdGlvbnMucm9sZUFybixcbiAgICAgICAgICAgIGZyb21EZXBsb3k6IHRydWUsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1aXJlQXBwcm92YWwgIT09IFJlcXVpcmVBcHByb3ZhbC5OZXZlcikge1xuICAgICAgICBjb25zdCBjdXJyZW50VGVtcGxhdGUgPSBhd2FpdCB0aGlzLnByb3BzLmNsb3VkRm9ybWF0aW9uLnJlYWRDdXJyZW50VGVtcGxhdGUoc3RhY2spO1xuICAgICAgICBpZiAocHJpbnRTZWN1cml0eURpZmYoY3VycmVudFRlbXBsYXRlLCBzdGFjaywgcmVxdWlyZUFwcHJvdmFsKSkge1xuXG4gICAgICAgICAgLy8gb25seSB0YWxrIHRvIHVzZXIgaWYgU1RESU4gaXMgYSB0ZXJtaW5hbCAob3RoZXJ3aXNlLCBmYWlsKVxuICAgICAgICAgIGlmICghcHJvY2Vzcy5zdGRpbi5pc1RUWSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAnXCItLXJlcXVpcmUtYXBwcm92YWxcIiBpcyBlbmFibGVkIGFuZCBzdGFjayBpbmNsdWRlcyBzZWN1cml0eS1zZW5zaXRpdmUgdXBkYXRlcywgJyArXG4gICAgICAgICAgICAgICdidXQgdGVybWluYWwgKFRUWSkgaXMgbm90IGF0dGFjaGVkIHNvIHdlIGFyZSB1bmFibGUgdG8gZ2V0IGEgY29uZmlybWF0aW9uIGZyb20gdGhlIHVzZXInKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb25maXJtZWQgPSBhd2FpdCBwcm9tcHRseS5jb25maXJtKCdEbyB5b3Ugd2lzaCB0byBkZXBsb3kgdGhlc2UgY2hhbmdlcyAoeS9uKT8nKTtcbiAgICAgICAgICBpZiAoIWNvbmZpcm1lZCkgeyB0aHJvdyBuZXcgRXJyb3IoJ0Fib3J0ZWQgYnkgdXNlcicpOyB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJpbnQoJyVzOiBkZXBsb3lpbmcuLi4nLCBjb2xvcnMuYm9sZChzdGFjay5kaXNwbGF5TmFtZSkpO1xuXG4gICAgICBsZXQgdGFncyA9IG9wdGlvbnMudGFncztcbiAgICAgIGlmICghdGFncyB8fCB0YWdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0YWdzID0gdGFnc0ZvclN0YWNrKHN0YWNrKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wcm9wcy5jbG91ZEZvcm1hdGlvbi5kZXBsb3lTdGFjayh7XG4gICAgICAgICAgc3RhY2ssXG4gICAgICAgICAgZGVwbG95TmFtZTogc3RhY2suc3RhY2tOYW1lLFxuICAgICAgICAgIHJvbGVBcm46IG9wdGlvbnMucm9sZUFybixcbiAgICAgICAgICBib290c3RyYXBRdWFsaWZpZXI6IG9wdGlvbnMuYm9vdHN0cmFwUXVhbGlmaWVyLFxuICAgICAgICAgIHJldXNlQXNzZXRzOiBvcHRpb25zLnJldXNlQXNzZXRzLFxuICAgICAgICAgIG5vdGlmaWNhdGlvbkFybnM6IG9wdGlvbnMubm90aWZpY2F0aW9uQXJucyxcbiAgICAgICAgICB0YWdzLFxuICAgICAgICAgIGV4ZWN1dGU6IG9wdGlvbnMuZXhlY3V0ZSxcbiAgICAgICAgICBmb3JjZTogb3B0aW9ucy5mb3JjZSxcbiAgICAgICAgICBwYXJhbWV0ZXJzOiBPYmplY3QuYXNzaWduKHt9LCBwYXJhbWV0ZXJNYXBbJyonXSwgcGFyYW1ldGVyTWFwW3N0YWNrLnN0YWNrTmFtZV0pLFxuICAgICAgICAgIHVzZVByZXZpb3VzUGFyYW1ldGVyczogb3B0aW9ucy51c2VQcmV2aW91c1BhcmFtZXRlcnMsXG4gICAgICAgICAgcHJvZ3Jlc3M6IG9wdGlvbnMucHJvZ3Jlc3MsXG4gICAgICAgICAgY2k6IG9wdGlvbnMuY2ksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSByZXN1bHQubm9PcFxuICAgICAgICAgID8gJyDinIUgICVzIChubyBjaGFuZ2VzKSdcbiAgICAgICAgICA6ICcg4pyFICAlcyc7XG5cbiAgICAgICAgc3VjY2VzcygnXFxuJyArIG1lc3NhZ2UsIHN0YWNrLmRpc3BsYXlOYW1lKTtcblxuICAgICAgICBpZiAoT2JqZWN0LmtleXMocmVzdWx0Lm91dHB1dHMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBwcmludCgnXFxuT3V0cHV0czonKTtcblxuICAgICAgICAgIHN0YWNrT3V0cHV0c1tzdGFjay5zdGFja05hbWVdID0gcmVzdWx0Lm91dHB1dHM7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXMocmVzdWx0Lm91dHB1dHMpLnNvcnQoKSkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gcmVzdWx0Lm91dHB1dHNbbmFtZV07XG4gICAgICAgICAgcHJpbnQoJyVzLiVzID0gJXMnLCBjb2xvcnMuY3lhbihzdGFjay5pZCksIGNvbG9ycy5jeWFuKG5hbWUpLCBjb2xvcnMudW5kZXJsaW5lKGNvbG9ycy5jeWFuKHZhbHVlKSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpbnQoJ1xcblN0YWNrIEFSTjonKTtcblxuICAgICAgICBkYXRhKHJlc3VsdC5zdGFja0Fybik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGVycm9yKCdcXG4g4p2MICAlcyBmYWlsZWQ6ICVzJywgY29sb3JzLmJvbGQoc3RhY2suZGlzcGxheU5hbWUpLCBlKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIC8vIElmIGFuIG91dHB1dHMgZmlsZSBoYXMgYmVlbiBzcGVjaWZpZWQsIGNyZWF0ZSB0aGUgZmlsZSBwYXRoIGFuZCB3cml0ZSBzdGFjayBvdXRwdXRzIHRvIGl0IG9uY2UuXG4gICAgICAgIC8vIE91dHB1dHMgYXJlIHdyaXR0ZW4gYWZ0ZXIgYWxsIHN0YWNrcyBoYXZlIGJlZW4gZGVwbG95ZWQuIElmIGEgc3RhY2sgZGVwbG95bWVudCBmYWlscyxcbiAgICAgICAgLy8gYWxsIG9mIHRoZSBvdXRwdXRzIGZyb20gc3VjY2Vzc2Z1bGx5IGRlcGxveWVkIHN0YWNrcyBiZWZvcmUgdGhlIGZhaWx1cmUgd2lsbCBzdGlsbCBiZSB3cml0dGVuLlxuICAgICAgICBpZiAob3V0cHV0c0ZpbGUpIHtcbiAgICAgICAgICBmcy5lbnN1cmVGaWxlU3luYyhvdXRwdXRzRmlsZSk7XG4gICAgICAgICAgYXdhaXQgZnMud3JpdGVKc29uKG91dHB1dHNGaWxlLCBzdGFja091dHB1dHMsIHtcbiAgICAgICAgICAgIHNwYWNlczogMixcbiAgICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveShvcHRpb25zOiBEZXN0cm95T3B0aW9ucykge1xuICAgIGxldCBzdGFja3MgPSBhd2FpdCB0aGlzLnNlbGVjdFN0YWNrc0ZvckRlc3Ryb3kob3B0aW9ucy5zdGFja05hbWVzLCBvcHRpb25zLmV4Y2x1c2l2ZWx5KTtcblxuICAgIC8vIFRoZSBzdGFja3Mgd2lsbCBoYXZlIGJlZW4gb3JkZXJlZCBmb3IgZGVwbG95bWVudCwgc28gcmV2ZXJzZSB0aGVtIGZvciBkZWxldGlvbi5cbiAgICBzdGFja3MgPSBzdGFja3MucmV2ZXJzZWQoKTtcblxuICAgIGlmICghb3B0aW9ucy5mb3JjZSkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICAgIGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHByb21wdGx5LmNvbmZpcm0oYEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGU6ICR7Y29sb3JzLmJsdWUoc3RhY2tzLnN0YWNrQXJ0aWZhY3RzLm1hcChzID0+IHMuaWQpLmpvaW4oJywgJykpfSAoeS9uKT9gKTtcbiAgICAgIGlmICghY29uZmlybWVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhY3Rpb24gPSBvcHRpb25zLmZyb21EZXBsb3kgPyAnZGVwbG95JyA6ICdkZXN0cm95JztcbiAgICBmb3IgKGNvbnN0IHN0YWNrIG9mIHN0YWNrcy5zdGFja0FydGlmYWN0cykge1xuICAgICAgc3VjY2VzcygnJXM6IGRlc3Ryb3lpbmcuLi4nLCBjb2xvcnMuYmx1ZShzdGFjay5kaXNwbGF5TmFtZSkpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgdGhpcy5wcm9wcy5jbG91ZEZvcm1hdGlvbi5kZXN0cm95U3RhY2soe1xuICAgICAgICAgIHN0YWNrLFxuICAgICAgICAgIGRlcGxveU5hbWU6IHN0YWNrLnN0YWNrTmFtZSxcbiAgICAgICAgICByb2xlQXJuOiBvcHRpb25zLnJvbGVBcm4sXG4gICAgICAgIH0pO1xuICAgICAgICBzdWNjZXNzKGBcXG4g4pyFICAlczogJHthY3Rpb259ZWRgLCBjb2xvcnMuYmx1ZShzdGFjay5kaXNwbGF5TmFtZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBlcnJvcihgXFxuIOKdjCAgJXM6ICR7YWN0aW9ufSBmYWlsZWRgLCBjb2xvcnMuYmx1ZShzdGFjay5kaXNwbGF5TmFtZSksIGUpO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsaXN0KHNlbGVjdG9yczogc3RyaW5nW10sIG9wdGlvbnM6IHsgbG9uZz86IGJvb2xlYW4gfSA9IHsgfSkge1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IHRoaXMuc2VsZWN0U3RhY2tzRm9yTGlzdChzZWxlY3RvcnMpO1xuXG4gICAgLy8gaWYgd2UgYXJlIGluIFwibG9uZ1wiIG1vZGUsIGVtaXQgdGhlIGFycmF5IGFzLWlzIChKU09OL1lBTUwpXG4gICAgaWYgKG9wdGlvbnMubG9uZykge1xuICAgICAgY29uc3QgbG9uZyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBzdGFjayBvZiBzdGFja3Muc3RhY2tBcnRpZmFjdHMpIHtcbiAgICAgICAgbG9uZy5wdXNoKHtcbiAgICAgICAgICBpZDogc3RhY2suaWQsXG4gICAgICAgICAgbmFtZTogc3RhY2suc3RhY2tOYW1lLFxuICAgICAgICAgIGVudmlyb25tZW50OiBzdGFjay5lbnZpcm9ubWVudCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbG9uZzsgLy8gd2lsbCBiZSBZQU1MIGZvcm1hdHRlZCBvdXRwdXRcbiAgICB9XG5cbiAgICAvLyBqdXN0IHByaW50IHN0YWNrIElEc1xuICAgIGZvciAoY29uc3Qgc3RhY2sgb2Ygc3RhY2tzLnN0YWNrQXJ0aWZhY3RzKSB7XG4gICAgICBkYXRhKHN0YWNrLmlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gMDsgLy8gZXhpdC1jb2RlXG4gIH1cblxuICAvKipcbiAgICogU3ludGhlc2l6ZSB0aGUgZ2l2ZW4gc2V0IG9mIHN0YWNrcyAoY2FsbGVkIHdoZW4gdGhlIHVzZXIgcnVucyAnY2RrIHN5bnRoJylcbiAgICpcbiAgICogSU5QVVQ6IFN0YWNrIG5hbWVzIGNhbiBiZSBzdXBwbGllZCB1c2luZyBhIGdsb2IgZmlsdGVyLiBJZiBubyBzdGFja3MgYXJlXG4gICAqIGdpdmVuLCBhbGwgc3RhY2tzIGZyb20gdGhlIGFwcGxpY2F0aW9uIGFyZSBpbXBsaWN0bHkgc2VsZWN0ZWQuXG4gICAqXG4gICAqIE9VVFBVVDogSWYgbW9yZSB0aGFuIG9uZSBzdGFjayBlbmRzIHVwIGJlaW5nIHNlbGVjdGVkLCBhbiBvdXRwdXQgZGlyZWN0b3J5XG4gICAqIHNob3VsZCBiZSBzdXBwbGllZCwgd2hlcmUgdGhlIHRlbXBsYXRlcyB3aWxsIGJlIHdyaXR0ZW4uXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc3ludGgoc3RhY2tOYW1lczogc3RyaW5nW10sIGV4Y2x1c2l2ZWx5OiBib29sZWFuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzdGFja3MgPSBhd2FpdCB0aGlzLnNlbGVjdFN0YWNrc0ZvckRpZmYoc3RhY2tOYW1lcywgZXhjbHVzaXZlbHkpO1xuXG4gICAgLy8gaWYgd2UgaGF2ZSBhIHNpbmdsZSBzdGFjaywgcHJpbnQgaXQgdG8gU1RET1VUXG4gICAgaWYgKHN0YWNrcy5zdGFja0NvdW50ID09PSAxKSB7XG4gICAgICByZXR1cm4gc3RhY2tzLmZpcnN0U3RhY2sudGVtcGxhdGU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyBhIHNsaWdodCBoYWNrOyBpbiBpbnRlZyBtb2RlIHdlIGFsbG93IG11bHRpcGxlIHN0YWNrcyB0byBiZSBzeW50aGVzaXplZCB0byBzdGRvdXQgc2VxdWVudGlhbGx5LlxuICAgIC8vIFRoaXMgaXMgdG8gbWFrZSBpdCBzbyB0aGF0IHdlIGNhbiBzdXBwb3J0IG11bHRpLXN0YWNrIGludGVnIHRlc3QgZXhwZWN0YXRpb25zLCB3aXRob3V0IHNvIGRyYXN0aWNhbGx5XG4gICAgLy8gaGF2aW5nIHRvIGNoYW5nZSB0aGUgc3ludGhlc2lzIGZvcm1hdCB0aGF0IHdlIGhhdmUgdG8gcmVydW4gYWxsIGludGVnIHRlc3RzLlxuICAgIC8vXG4gICAgLy8gQmVjYXVzZSB0aGlzIGZlYXR1cmUgaXMgbm90IHVzZWZ1bCB0byBjb25zdW1lcnMgKHRoZSBvdXRwdXQgaXMgbWlzc2luZ1xuICAgIC8vIHRoZSBzdGFjayBuYW1lcyksIGl0J3Mgbm90IGV4cG9zZWQgYXMgYSBDTEkgZmxhZy4gSW5zdGVhZCwgaXQncyBoaWRkZW5cbiAgICAvLyBiZWhpbmQgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUuXG4gICAgY29uc3QgaXNJbnRlZ01vZGUgPSBwcm9jZXNzLmVudi5DREtfSU5URUdfTU9ERSA9PT0gJzEnO1xuICAgIGlmIChpc0ludGVnTW9kZSkge1xuICAgICAgcmV0dXJuIHN0YWNrcy5zdGFja0FydGlmYWN0cy5tYXAocyA9PiBzLnRlbXBsYXRlKTtcbiAgICB9XG5cbiAgICAvLyBub3Qgb3V0cHV0dGluZyB0ZW1wbGF0ZSB0byBzdGRvdXQsIGxldCdzIGV4cGxhaW4gdGhpbmdzIHRvIHRoZSB1c2VyIGEgbGl0dGxlIGJpdC4uLlxuICAgIHN1Y2Nlc3MoYFN1Y2Nlc3NmdWxseSBzeW50aGVzaXplZCB0byAke2NvbG9ycy5ibHVlKHBhdGgucmVzb2x2ZShzdGFja3MuYXNzZW1ibHkuZGlyZWN0b3J5KSl9YCk7XG4gICAgcHJpbnQoYFN1cHBseSBhIHN0YWNrIGlkICgke3N0YWNrcy5zdGFja0FydGlmYWN0cy5tYXAocyA9PiBjb2xvcnMuZ3JlZW4ocy5pZCkpLmpvaW4oJywgJyl9KSB0byBkaXNwbGF5IGl0cyB0ZW1wbGF0ZS5gKTtcblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogQm9vdHN0cmFwIHRoZSBDREsgVG9vbGtpdCBzdGFjayBpbiB0aGUgYWNjb3VudHMgdXNlZCBieSB0aGUgc3BlY2lmaWVkIHN0YWNrKHMpLlxuICAgKlxuICAgKiBAcGFyYW0gZW52aXJvbm1lbnRTcGVjcyBlbnZpcm9ubWVudCBuYW1lcyB0aGF0IG5lZWQgdG8gaGF2ZSB0b29sa2l0IHN1cHBvcnRcbiAgICogICAgICAgICAgICAgcHJvdmlzaW9uZWQsIGFzIGEgZ2xvYiBmaWx0ZXIuIElmIG5vbmUgaXMgcHJvdmlkZWQsXG4gICAqICAgICAgICAgICAgIGFsbCBzdGFja3MgYXJlIGltcGxpY2l0bHkgc2VsZWN0ZWQuXG4gICAqIEBwYXJhbSB0b29sa2l0U3RhY2tOYW1lIHRoZSBuYW1lIHRvIGJlIHVzZWQgZm9yIHRoZSBDREsgVG9vbGtpdCBzdGFjay5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBib290c3RyYXAoZW52aXJvbm1lbnRTcGVjczogc3RyaW5nW10sIGJvb3RzdHJhcHBlcjogQm9vdHN0cmFwcGVyLCBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBJZiB0aGVyZSBpcyBhbiAnLS1hcHAnIGFyZ3VtZW50IGFuZCBhbiBlbnZpcm9ubWVudCBsb29rcyBsaWtlIGEgZ2xvYiwgd2VcbiAgICAvLyBzZWxlY3QgdGhlIGVudmlyb25tZW50cyBmcm9tIHRoZSBhcHAuIE90aGVyd2lzZSB1c2Ugd2hhdCB0aGUgdXNlciBzYWlkLlxuXG4gICAgLy8gQnkgZGVmYXVsdCBnbG9iIGZvciBldmVyeXRoaW5nXG4gICAgZW52aXJvbm1lbnRTcGVjcyA9IGVudmlyb25tZW50U3BlY3MubGVuZ3RoID4gMCA/IGVudmlyb25tZW50U3BlY3MgOiBbJyoqJ107XG5cbiAgICAvLyBQYXJ0aXRpb24gaW50byBnbG9icyBhbmQgbm9uLWdsb2JzICh0aGlzIHdpbGwgbXV0YXRlIGVudmlyb25tZW50U3BlY3MpLlxuICAgIGNvbnN0IGdsb2JTcGVjcyA9IHBhcnRpdGlvbihlbnZpcm9ubWVudFNwZWNzLCBsb29rc0xpa2VHbG9iKTtcbiAgICBpZiAoZ2xvYlNwZWNzLmxlbmd0aCA+IDAgJiYgIXRoaXMucHJvcHMuY2xvdWRFeGVjdXRhYmxlLmhhc0FwcCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtnbG9iU3BlY3N9JyBpcyBub3QgYW4gZW52aXJvbm1lbnQgbmFtZS4gUnVuIGluIGFwcCBkaXJlY3RvcnkgdG8gZ2xvYiBvciBzcGVjaWZ5IGFuIGVudmlyb25tZW50IG5hbWUgbGlrZSBcXCdhd3M6Ly8xMjM0NTY3ODkwMTIvdXMtZWFzdC0xXFwnLmApO1xuICAgIH1cblxuICAgIGNvbnN0IGVudmlyb25tZW50czogY3hhcGkuRW52aXJvbm1lbnRbXSA9IFtcbiAgICAgIC4uLmVudmlyb25tZW50c0Zyb21EZXNjcmlwdG9ycyhlbnZpcm9ubWVudFNwZWNzKSxcbiAgICBdO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gJy0tYXBwJyBhcmd1bWVudCwgc2VsZWN0IHRoZSBlbnZpcm9ubWVudHMgZnJvbSB0aGUgYXBwLlxuICAgIGlmICh0aGlzLnByb3BzLmNsb3VkRXhlY3V0YWJsZS5oYXNBcHApIHtcbiAgICAgIGVudmlyb25tZW50cy5wdXNoKC4uLmF3YWl0IGdsb2JFbnZpcm9ubWVudHNGcm9tU3RhY2tzKGF3YWl0IHRoaXMuc2VsZWN0U3RhY2tzRm9yTGlzdChbXSksIGdsb2JTcGVjcywgdGhpcy5wcm9wcy5zZGtQcm92aWRlcikpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKGVudmlyb25tZW50cy5tYXAoYXN5bmMgKGVudmlyb25tZW50KSA9PiB7XG4gICAgICBzdWNjZXNzKCcg4o+zICBCb290c3RyYXBwaW5nIGVudmlyb25tZW50ICVzLi4uJywgY29sb3JzLmJsdWUoZW52aXJvbm1lbnQubmFtZSkpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudmlyb25tZW50LCB0aGlzLnByb3BzLnNka1Byb3ZpZGVyLCBvcHRpb25zKTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IHJlc3VsdC5ub09wXG4gICAgICAgICAgPyAnIOKchSAgRW52aXJvbm1lbnQgJXMgYm9vdHN0cmFwcGVkIChubyBjaGFuZ2VzKS4nXG4gICAgICAgICAgOiAnIOKchSAgRW52aXJvbm1lbnQgJXMgYm9vdHN0cmFwcGVkLic7XG4gICAgICAgIHN1Y2Nlc3MobWVzc2FnZSwgY29sb3JzLmJsdWUoZW52aXJvbm1lbnQubmFtZSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBlcnJvcignIOKdjCAgRW52aXJvbm1lbnQgJXMgZmFpbGVkIGJvb3RzdHJhcHBpbmc6ICVzJywgY29sb3JzLmJsdWUoZW52aXJvbm1lbnQubmFtZSksIGUpO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgc2VsZWN0U3RhY2tzRm9yTGlzdChzZWxlY3RvcnM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgYXNzZW1ibHkgPSBhd2FpdCB0aGlzLmFzc2VtYmx5KCk7XG4gICAgY29uc3Qgc3RhY2tzID0gYXdhaXQgYXNzZW1ibHkuc2VsZWN0U3RhY2tzKHNlbGVjdG9ycywgeyBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uQWxsU3RhY2tzIH0pO1xuXG4gICAgLy8gTm8gdmFsaWRhdGlvblxuXG4gICAgcmV0dXJuIHN0YWNrcztcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgc2VsZWN0U3RhY2tzRm9yRGVwbG95KHN0YWNrTmFtZXM6IHN0cmluZ1tdLCBleGNsdXNpdmVseT86IGJvb2xlYW4pIHtcbiAgICBjb25zdCBhc3NlbWJseSA9IGF3YWl0IHRoaXMuYXNzZW1ibHkoKTtcbiAgICBjb25zdCBzdGFja3MgPSBhd2FpdCBhc3NlbWJseS5zZWxlY3RTdGFja3Moc3RhY2tOYW1lcywge1xuICAgICAgZXh0ZW5kOiBleGNsdXNpdmVseSA/IEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24uTm9uZSA6IEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24uVXBzdHJlYW0sXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uT25seVNpbmdsZSxcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMudmFsaWRhdGVTdGFja3Moc3RhY2tzKTtcblxuICAgIHJldHVybiBzdGFja3M7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHNlbGVjdFN0YWNrc0ZvckRpZmYoc3RhY2tOYW1lczogc3RyaW5nW10sIGV4Y2x1c2l2ZWx5PzogYm9vbGVhbikge1xuICAgIGNvbnN0IGFzc2VtYmx5ID0gYXdhaXQgdGhpcy5hc3NlbWJseSgpO1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IGFzc2VtYmx5LnNlbGVjdFN0YWNrcyhzdGFja05hbWVzLCB7XG4gICAgICBleHRlbmQ6IGV4Y2x1c2l2ZWx5ID8gRXh0ZW5kZWRTdGFja1NlbGVjdGlvbi5Ob25lIDogRXh0ZW5kZWRTdGFja1NlbGVjdGlvbi5VcHN0cmVhbSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjogRGVmYXVsdFNlbGVjdGlvbi5BbGxTdGFja3MsXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLnZhbGlkYXRlU3RhY2tzKHN0YWNrcyk7XG5cbiAgICByZXR1cm4gc3RhY2tzO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzZWxlY3RTdGFja3NGb3JEZXN0cm95KHN0YWNrTmFtZXM6IHN0cmluZ1tdLCBleGNsdXNpdmVseT86IGJvb2xlYW4pIHtcbiAgICBjb25zdCBhc3NlbWJseSA9IGF3YWl0IHRoaXMuYXNzZW1ibHkoKTtcbiAgICBjb25zdCBzdGFja3MgPSBhd2FpdCBhc3NlbWJseS5zZWxlY3RTdGFja3Moc3RhY2tOYW1lcywge1xuICAgICAgZXh0ZW5kOiBleGNsdXNpdmVseSA/IEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24uTm9uZSA6IEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24uRG93bnN0cmVhbSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjogRGVmYXVsdFNlbGVjdGlvbi5Pbmx5U2luZ2xlLFxuICAgIH0pO1xuXG4gICAgLy8gTm8gdmFsaWRhdGlvblxuXG4gICAgcmV0dXJuIHN0YWNrcztcbiAgfVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgc3RhY2tzIGZvciBlcnJvcnMgYW5kIHdhcm5pbmdzIGFjY29yZGluZyB0byB0aGUgQ0xJJ3MgY3VycmVudCBzZXR0aW5nc1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVN0YWNrcyhzdGFja3M6IFN0YWNrQ29sbGVjdGlvbikge1xuICAgIHN0YWNrcy5wcm9jZXNzTWV0YWRhdGFNZXNzYWdlcyh7XG4gICAgICBpZ25vcmVFcnJvcnM6IHRoaXMucHJvcHMuaWdub3JlRXJyb3JzLFxuICAgICAgc3RyaWN0OiB0aGlzLnByb3BzLnN0cmljdCxcbiAgICAgIHZlcmJvc2U6IHRoaXMucHJvcHMudmVyYm9zZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWxlY3QgYSBzaW5nbGUgc3RhY2sgYnkgaXRzIG5hbWVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgc2VsZWN0U2luZ2xlU3RhY2tCeU5hbWUoc3RhY2tOYW1lOiBzdHJpbmcpIHtcbiAgICBjb25zdCBhc3NlbWJseSA9IGF3YWl0IHRoaXMuYXNzZW1ibHkoKTtcblxuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IGFzc2VtYmx5LnNlbGVjdFN0YWNrcyhbc3RhY2tOYW1lXSwge1xuICAgICAgZXh0ZW5kOiBFeHRlbmRlZFN0YWNrU2VsZWN0aW9uLk5vbmUsXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uTm9uZSxcbiAgICB9KTtcblxuICAgIC8vIENvdWxkIGhhdmUgYmVlbiBhIGdsb2Igc28gY2hlY2sgdGhhdCB3ZSBldmFsdWF0ZWQgdG8gZXhhY3RseSBvbmVcbiAgICBpZiAoc3RhY2tzLnN0YWNrQ291bnQgPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgY29tbWFuZCByZXF1aXJlcyBleGFjdGx5IG9uZSBzdGFjayBhbmQgd2UgbWF0Y2hlZCBtb3JlIHRoYW4gb25lOiAke3N0YWNrcy5zdGFja0lkc31gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXNzZW1ibHkuc3RhY2tCeUlkKHN0YWNrcy5maXJzdFN0YWNrLmlkKTtcbiAgfVxuXG4gIHByaXZhdGUgYXNzZW1ibHkoKTogUHJvbWlzZTxDbG91ZEFzc2VtYmx5PiB7XG4gICAgcmV0dXJuIHRoaXMucHJvcHMuY2xvdWRFeGVjdXRhYmxlLnN5bnRoZXNpemUoKTtcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlmZk9wdGlvbnMge1xuICAvKipcbiAgICogU3RhY2sgbmFtZXMgdG8gZGlmZlxuICAgKi9cbiAgc3RhY2tOYW1lczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE9ubHkgc2VsZWN0IHRoZSBnaXZlbiBzdGFja1xuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZXhjbHVzaXZlbHk/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBVc2VkIGEgdGVtcGxhdGUgZnJvbSBkaXNrIGluc3RlYWQgb2YgZnJvbSB0aGUgc2VydmVyXG4gICAqXG4gICAqIEBkZWZhdWx0IFVzZSBmcm9tIHRoZSBzZXJ2ZXJcbiAgICovXG4gIHRlbXBsYXRlUGF0aD86IHN0cmluZztcblxuICAvKipcbiAgICogU3RyaWN0IGRpZmYgbW9kZVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgc3RyaWN0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogSG93IG1hbnkgbGluZXMgb2YgY29udGV4dCB0byBzaG93IGluIHRoZSBkaWZmXG4gICAqXG4gICAqIEBkZWZhdWx0IDNcbiAgICovXG4gIGNvbnRleHRMaW5lcz86IG51bWJlcjtcblxuICAvKipcbiAgICogV2hlcmUgdG8gd3JpdGUgdGhlIGRlZmF1bHRcbiAgICpcbiAgICogQGRlZmF1bHQgc3RkZXJyXG4gICAqL1xuICBzdHJlYW0/OiBOb2RlSlMuV3JpdGFibGVTdHJlYW07XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZmFpbCB3aXRoIGV4aXQgY29kZSAxIGluIGNhc2Ugb2YgZGlmZlxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZmFpbD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVwbG95T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBTdGFjayBuYW1lcyB0byBkZXBsb3lcbiAgICovXG4gIHN0YWNrTmFtZXM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBPbmx5IHNlbGVjdCB0aGUgZ2l2ZW4gc3RhY2tcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGV4Y2x1c2l2ZWx5PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogTmFtZSBvZiB0aGUgdG9vbGtpdCBzdGFjayB0byB1c2UvZGVwbG95XG4gICAqXG4gICAqIEBkZWZhdWx0IENES1Rvb2xraXRcbiAgICovXG4gIC8vdG9vbGtpdFN0YWNrTmFtZT86IHN0cmluZztcblxuICAvKipcbiAgICogQm9vdHN0cmFwIHN0YWNrIHF1YWxpZmllciB0byB1c2VcbiAgICpcbiAgICogQGRlZmF1bHQgJ2huYjY1OWZkcydcbiAgICovXG4gIGJvb3RzdHJhcFF1YWxpZmllcj86IHN0cmluZztcblxuICAvKipcbiAgICogUm9sZSB0byBwYXNzIHRvIENsb3VkRm9ybWF0aW9uIGZvciBkZXBsb3ltZW50XG4gICAqL1xuICByb2xlQXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBUk5zIG9mIFNOUyB0b3BpY3MgdGhhdCBDbG91ZEZvcm1hdGlvbiB3aWxsIG5vdGlmeSB3aXRoIHN0YWNrIHJlbGF0ZWQgZXZlbnRzXG4gICAqL1xuICBub3RpZmljYXRpb25Bcm5zPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFdoYXQga2luZCBvZiBzZWN1cml0eSBjaGFuZ2VzIHJlcXVpcmUgYXBwcm92YWxcbiAgICpcbiAgICogQGRlZmF1bHQgUmVxdWlyZUFwcHJvdmFsLkJyb2FkZW5pbmdcbiAgICovXG4gIHJlcXVpcmVBcHByb3ZhbD86IFJlcXVpcmVBcHByb3ZhbDtcblxuICAvKipcbiAgICogUmV1c2UgdGhlIGFzc2V0cyB3aXRoIHRoZSBnaXZlbiBhc3NldCBJRHNcbiAgICovXG4gIHJldXNlQXNzZXRzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFRhZ3MgdG8gcGFzcyB0byBDbG91ZEZvcm1hdGlvbiBmb3IgZGVwbG95bWVudFxuICAgKi9cbiAgdGFncz86IFRhZ1tdO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGV4ZWN1dGUgdGhlIENoYW5nZVNldFxuICAgKiBOb3QgcHJvdmlkaW5nIGBleGVjdXRlYCBwYXJhbWV0ZXIgd2lsbCByZXN1bHQgaW4gZXhlY3V0aW9uIG9mIENoYW5nZVNldFxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBleGVjdXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQWx3YXlzIGRlcGxveSwgZXZlbiBpZiB0ZW1wbGF0ZXMgYXJlIGlkZW50aWNhbC5cbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGZvcmNlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQWRkaXRpb25hbCBwYXJhbWV0ZXJzIGZvciBDbG91ZEZvcm1hdGlvbiBhdCBkZXBsb3kgdGltZVxuICAgKiBAZGVmYXVsdCB7fVxuICAgKi9cbiAgcGFyYW1ldGVycz86IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXG4gIC8qKlxuICAgKiBVc2UgcHJldmlvdXMgdmFsdWVzIGZvciB1bnNwZWNpZmllZCBwYXJhbWV0ZXJzXG4gICAqXG4gICAqIElmIG5vdCBzZXQsIGFsbCBwYXJhbWV0ZXJzIG11c3QgYmUgc3BlY2lmaWVkIGZvciBldmVyeSBkZXBsb3ltZW50LlxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICB1c2VQcmV2aW91c1BhcmFtZXRlcnM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBEaXNwbGF5IG1vZGUgZm9yIHN0YWNrIGRlcGxveW1lbnQgcHJvZ3Jlc3MuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gU3RhY2tBY3Rpdml0eVByb2dyZXNzLkJhciAtIHN0YWNrIGV2ZW50cyB3aWxsIGJlIGRpc3BsYXllZCBmb3JcbiAgICogICB0aGUgcmVzb3VyY2UgY3VycmVudGx5IGJlaW5nIGRlcGxveWVkLlxuICAgKi9cbiAgcHJvZ3Jlc3M/OiBTdGFja0FjdGl2aXR5UHJvZ3Jlc3M7XG5cbiAgLyoqXG4gICAqIFBhdGggdG8gZmlsZSB3aGVyZSBzdGFjayBvdXRwdXRzIHdpbGwgYmUgd3JpdHRlbiBhZnRlciBhIHN1Y2Nlc3NmdWwgZGVwbG95IGFzIEpTT05cbiAgICogQGRlZmF1bHQgLSBPdXRwdXRzIGFyZSBub3Qgd3JpdHRlbiB0byBhbnkgZmlsZVxuICAgKi9cbiAgb3V0cHV0c0ZpbGU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgd2UgYXJlIG9uIGEgQ0kgc3lzdGVtXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBjaT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVzdHJveU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIG5hbWVzIG9mIHRoZSBzdGFja3MgdG8gZGVsZXRlXG4gICAqL1xuICBzdGFja05hbWVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBleGNsdWRlIHN0YWNrcyB0aGF0IGRlcGVuZCBvbiB0aGUgc3RhY2tzIHRvIGJlIGRlbGV0ZWRcbiAgICovXG4gIGV4Y2x1c2l2ZWx5OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHNraXAgcHJvbXB0aW5nIGZvciBjb25maXJtYXRpb25cbiAgICovXG4gIGZvcmNlOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBUaGUgYXJuIG9mIHRoZSBJQU0gcm9sZSB0byB1c2VcbiAgICovXG4gIHJvbGVBcm4/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGRlc3Ryb3kgcmVxdWVzdCBjYW1lIGZyb20gYSBkZXBsb3kuXG4gICAqL1xuICBmcm9tRGVwbG95PzogYm9vbGVhblxufVxuXG4vKipcbiAqIEByZXR1cm5zIGFuIGFycmF5IHdpdGggdGhlIHRhZ3MgYXZhaWxhYmxlIGluIHRoZSBzdGFjayBtZXRhZGF0YS5cbiAqL1xuZnVuY3Rpb24gdGFnc0ZvclN0YWNrKHN0YWNrOiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3QpOiBUYWdbXSB7XG4gIHJldHVybiBPYmplY3QuZW50cmllcyhzdGFjay50YWdzKS5tYXAoKFtLZXksIFZhbHVlXSkgPT4gKHsgS2V5LCBWYWx1ZSB9KSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFnIHtcbiAgcmVhZG9ubHkgS2V5OiBzdHJpbmc7XG4gIHJlYWRvbmx5IFZhbHVlOiBzdHJpbmc7XG59Il19