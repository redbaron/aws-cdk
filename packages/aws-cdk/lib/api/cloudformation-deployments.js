"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFormationDeployments = void 0;
const cxapi = require("@aws-cdk/cx-api");
const cdk_assets_1 = require("cdk-assets");
const logging_1 = require("../logging");
const asset_publishing_1 = require("../util/asset-publishing");
const aws_auth_1 = require("./aws-auth");
const deploy_stack_1 = require("./deploy-stack");
const toolkit_info_1 = require("./toolkit-info");
const cloudformation_1 = require("./util/cloudformation");
/**
 * Helper class for CloudFormation deployments
 *
 * Looks us the right SDK and Bootstrap stack to deploy a given
 * stack artifact.
 */
class CloudFormationDeployments {
    constructor(props) {
        this.sdkProvider = props.sdkProvider;
    }
    async readCurrentTemplate(stackArtifact) {
        logging_1.debug(`Reading existing template for stack ${stackArtifact.displayName}.`);
        const { stackSdk } = await this.prepareSdkFor(stackArtifact, undefined, aws_auth_1.Mode.ForReading);
        const cfn = stackSdk.cloudFormation();
        const stack = await cloudformation_1.CloudFormationStack.lookup(cfn, stackArtifact.stackName);
        return stack.template();
    }
    async deployStack(options) {
        const { stackSdk, resolvedEnvironment, cloudFormationRoleArn } = await this.prepareSdkFor(options.stack, options.roleArn);
        const toolkitInfo = await toolkit_info_1.ToolkitResourcesInfo.lookup(resolvedEnvironment, stackSdk, options.bootstrapQualifier);
        // Publish any assets before doing the actual deploy
        await this.publishStackAssets(options.stack, toolkitInfo);
        // Do a verification of the bootstrap stack version
        this.validateBootstrapStackVersion(options.stack.stackName, options.stack.requiresBootstrapStackVersion, toolkitInfo);
        return deploy_stack_1.deployStack({
            stack: options.stack,
            resolvedEnvironment,
            deployName: options.deployName,
            notificationArns: options.notificationArns,
            quiet: options.quiet,
            sdk: stackSdk,
            sdkProvider: this.sdkProvider,
            roleArn: cloudFormationRoleArn,
            reuseAssets: options.reuseAssets,
            toolkitInfo,
            tags: options.tags,
            execute: options.execute,
            force: options.force,
            parameters: options.parameters,
            usePreviousParameters: options.usePreviousParameters,
            progress: options.progress,
            ci: options.ci,
        });
    }
    async destroyStack(options) {
        const { stackSdk, cloudFormationRoleArn: roleArn } = await this.prepareSdkFor(options.stack, options.roleArn);
        return deploy_stack_1.destroyStack({
            sdk: stackSdk,
            roleArn,
            stack: options.stack,
            deployName: options.deployName,
            quiet: options.quiet,
        });
    }
    async stackExists(options) {
        var _a;
        const { stackSdk } = await this.prepareSdkFor(options.stack, undefined, aws_auth_1.Mode.ForReading);
        const stack = await cloudformation_1.CloudFormationStack.lookup(stackSdk.cloudFormation(), (_a = options.deployName) !== null && _a !== void 0 ? _a : options.stack.stackName);
        return stack.exists;
    }
    /**
     * Get the environment necessary for touching the given stack
     *
     * Returns the following:
     *
     * - The resolved environment for the stack (no more 'unknown-account/unknown-region')
     * - SDK loaded with the right credentials for calling `CreateChangeSet`.
     * - The Execution Role that should be passed to CloudFormation.
     */
    async prepareSdkFor(stack, roleArn, mode = aws_auth_1.Mode.ForWriting) {
        if (!stack.environment) {
            throw new Error(`The stack ${stack.displayName} does not have an environment`);
        }
        const resolvedEnvironment = await this.sdkProvider.resolveEnvironment(stack.environment);
        // Substitute any placeholders with information about the current environment
        const arns = await this.replaceEnvPlaceholders({
            assumeRoleArn: stack.assumeRoleArn,
            // Use the override if given, otherwise use the field from the stack
            cloudFormationRoleArn: roleArn !== null && roleArn !== void 0 ? roleArn : stack.cloudFormationExecutionRoleArn,
        }, resolvedEnvironment);
        const stackSdk = await this.sdkProvider.forEnvironment(resolvedEnvironment, mode, {
            assumeRoleArn: arns.assumeRoleArn,
        });
        return {
            stackSdk,
            resolvedEnvironment,
            cloudFormationRoleArn: arns.cloudFormationRoleArn,
        };
    }
    /**
     * Replace the {ACCOUNT} and {REGION} placeholders in all strings found in a complex object.
     */
    async replaceEnvPlaceholders(object, env) {
        return cxapi.EnvironmentPlaceholders.replaceAsync(object, {
            accountId: () => Promise.resolve(env.account),
            region: () => Promise.resolve(env.region),
            partition: async () => {
                var _a;
                // There's no good way to get the partition!
                // We should have had it already, except we don't.
                //
                // Best we can do is ask the "base credentials" for this environment for their partition. Cross-partition
                // AssumeRole'ing will never work anyway, so this answer won't be wrong (it will just be slow!)
                return (_a = (await this.sdkProvider.baseCredentialsPartition(env, aws_auth_1.Mode.ForReading))) !== null && _a !== void 0 ? _a : 'aws';
            },
        });
    }
    /**
     * Publish all asset manifests that are referenced by the given stack
     */
    async publishStackAssets(stack, bootstrapStack) {
        const stackEnv = await this.sdkProvider.resolveEnvironment(stack.environment);
        const assetArtifacts = stack.dependencies.filter(isAssetManifestArtifact);
        for (const assetArtifact of assetArtifacts) {
            this.validateBootstrapStackVersion(stack.stackName, assetArtifact.requiresBootstrapStackVersion, bootstrapStack);
            const manifest = cdk_assets_1.AssetManifest.fromFile(assetArtifact.file);
            await asset_publishing_1.publishAssets(manifest, this.sdkProvider, stackEnv);
        }
    }
    /**
     * Validate that the bootstrap stack has the right version for this stack
     */
    validateBootstrapStackVersion(stackName, requiresBootstrapStackVersion, bootstrapStack) {
        if (requiresBootstrapStackVersion === undefined) {
            return;
        }
        if (!bootstrapStack) {
            throw new Error(`${stackName}: publishing assets requires bootstrap stack version '${requiresBootstrapStackVersion}', no bootstrap stack found. Please run 'cdk bootstrap'.`);
        }
        if (requiresBootstrapStackVersion > bootstrapStack.version) {
            throw new Error(`${stackName}: publishing assets requires bootstrap stack version '${requiresBootstrapStackVersion}', found '${bootstrapStack.version}'. Please run 'cdk bootstrap' with a newer CLI version.`);
        }
    }
}
exports.CloudFormationDeployments = CloudFormationDeployments;
function isAssetManifestArtifact(art) {
    return art instanceof cxapi.AssetManifestArtifact;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmb3JtYXRpb24tZGVwbG95bWVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjbG91ZGZvcm1hdGlvbi1kZXBsb3ltZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5Q0FBeUM7QUFDekMsMkNBQTJDO0FBRTNDLHdDQUFtQztBQUNuQywrREFBeUQ7QUFDekQseUNBQStDO0FBQy9DLGlEQUE4RTtBQUM5RSxpREFBc0Q7QUFDdEQsMERBQXNFO0FBNEh0RTs7Ozs7R0FLRztBQUNILE1BQWEseUJBQXlCO0lBR3BDLFlBQVksS0FBdUI7UUFDakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO0lBQ3ZDLENBQUM7SUFFTSxLQUFLLENBQUMsbUJBQW1CLENBQUMsYUFBZ0Q7UUFDL0UsZUFBSyxDQUFDLHVDQUF1QyxhQUFhLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztRQUMzRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsZUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pGLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0QyxNQUFNLEtBQUssR0FBRyxNQUFNLG9DQUFtQixDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFTSxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQTJCO1FBQ2xELE1BQU0sRUFBRSxRQUFRLEVBQUUsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFMUgsTUFBTSxXQUFXLEdBQUcsTUFBTSxtQ0FBb0Is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b3J0IHsgQXNzZXRNYW5pZmVzdCB9IGZyb20gJ2Nkay1hc3NldHMnO1xuaW1wb3J0IHsgVGFnIH0gZnJvbSAnLi4vY2RrLXRvb2xraXQnO1xuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuLi9sb2dnaW5nJztcbmltcG9ydCB7IHB1Ymxpc2hBc3NldHMgfSBmcm9tICcuLi91dGlsL2Fzc2V0LXB1Ymxpc2hpbmcnO1xuaW1wb3J0IHsgTW9kZSwgU2RrUHJvdmlkZXIgfSBmcm9tICcuL2F3cy1hdXRoJztcbmltcG9ydCB7IGRlcGxveVN0YWNrLCBEZXBsb3lTdGFja1Jlc3VsdCwgZGVzdHJveVN0YWNrIH0gZnJvbSAnLi9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHsgVG9vbGtpdFJlc291cmNlc0luZm8gfSBmcm9tICcuL3Rvb2xraXQtaW5mbyc7XG5pbXBvcnQgeyBDbG91ZEZvcm1hdGlvblN0YWNrLCBUZW1wbGF0ZSB9IGZyb20gJy4vdXRpbC9jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBTdGFja0FjdGl2aXR5UHJvZ3Jlc3MgfSBmcm9tICcuL3V0aWwvY2xvdWRmb3JtYXRpb24vc3RhY2stYWN0aXZpdHktbW9uaXRvcic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVwbG95U3RhY2tPcHRpb25zIHtcbiAgLyoqXG4gICAqIFN0YWNrIHRvIGRlcGxveVxuICAgKi9cbiAgc3RhY2s6IGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdDtcblxuICAvKipcbiAgICogRXhlY3V0aW9uIHJvbGUgZm9yIHRoZSBkZXBsb3ltZW50IChwYXNzIHRocm91Z2ggdG8gQ2xvdWRGb3JtYXRpb24pXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gQ3VycmVudCByb2xlXG4gICAqL1xuICByb2xlQXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUb3BpYyBBUk5zIHRvIHNlbmQgYSBtZXNzYWdlIHdoZW4gZGVwbG95bWVudCBmaW5pc2hlcyAocGFzcyB0aHJvdWdoIHRvIENsb3VkRm9ybWF0aW9uKVxuICAgKlxuICAgKiBAZGVmYXVsdCAtIE5vIG5vdGlmaWNhdGlvbnNcbiAgICovXG4gIG5vdGlmaWNhdGlvbkFybnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogT3ZlcnJpZGUgbmFtZSB1bmRlciB3aGljaCBzdGFjayB3aWxsIGJlIGRlcGxveWVkXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gVXNlIGFydGlmYWN0IGRlZmF1bHRcbiAgICovXG4gIGRlcGxveU5hbWU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIERvbid0IHNob3cgc3RhY2sgZGVwbG95bWVudCBldmVudHMsIGp1c3Qgd2FpdFxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcXVpZXQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSB0b29sa2l0IHN0YWNrLCBpZiBub3QgdGhlIGRlZmF1bHQgbmFtZVxuICAgKlxuICAgKiBAZGVmYXVsdCAnQ0RLVG9vbGtpdCdcbiAgICovXG4gIC8vdG9vbGtpdFN0YWNrTmFtZT86IHN0cmluZztcblxuICAvKipcbiAgICogTmFtZSBvZiB0aGUgdG9vbGtpdCBzdGFjayBxdWFsaWZpZXIsIGlmIG5vdCB0aGUgZGVmYXVsdFxuICAgKlxuICAgKiBAZGVmYXVsdCAnaG5iNjU5ZmRzJ1xuICAgKi9cbiAgYm9vdHN0cmFwUXVhbGlmaWVyPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGFzc2V0IElEcyB3aGljaCBzaG91bGQgTk9UIGJlIGJ1aWx0IG9yIHVwbG9hZGVkXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gQnVpbGQgYWxsIGFzc2V0c1xuICAgKi9cbiAgcmV1c2VBc3NldHM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogU3RhY2sgdGFncyAocGFzcyB0aHJvdWdoIHRvIENsb3VkRm9ybWF0aW9uKVxuICAgKi9cbiAgdGFncz86IFRhZ1tdO1xuXG4gIC8qKlxuICAgKiBTdGFnZSB0aGUgY2hhbmdlIHNldCBidXQgZG9uJ3QgZXhlY3V0ZSBpdFxuICAgKlxuICAgKiBAZGVmYXVsdCAtIGZhbHNlXG4gICAqL1xuICBleGVjdXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRm9yY2UgZGVwbG95bWVudCwgZXZlbiBpZiB0aGUgZGVwbG95ZWQgdGVtcGxhdGUgaXMgaWRlbnRpY2FsIHRvIHRoZSBvbmUgd2UgYXJlIGFib3V0IHRvIGRlcGxveS5cbiAgICogQGRlZmF1bHQgZmFsc2UgZGVwbG95bWVudCB3aWxsIGJlIHNraXBwZWQgaWYgdGhlIHRlbXBsYXRlIGlzIGlkZW50aWNhbFxuICAgKi9cbiAgZm9yY2U/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBFeHRyYSBwYXJhbWV0ZXJzIGZvciBDbG91ZEZvcm1hdGlvblxuICAgKiBAZGVmYXVsdCAtIG5vIGFkZGl0aW9uYWwgcGFyYW1ldGVycyB3aWxsIGJlIHBhc3NlZCB0byB0aGUgdGVtcGxhdGVcbiAgICovXG4gIHBhcmFtZXRlcnM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblxuICAvKipcbiAgICogVXNlIHByZXZpb3VzIHZhbHVlcyBmb3IgdW5zcGVjaWZpZWQgcGFyYW1ldGVyc1xuICAgKlxuICAgKiBJZiBub3Qgc2V0LCBhbGwgcGFyYW1ldGVycyBtdXN0IGJlIHNwZWNpZmllZCBmb3IgZXZlcnkgZGVwbG95bWVudC5cbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgdXNlUHJldmlvdXNQYXJhbWV0ZXJzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRGlzcGxheSBtb2RlIGZvciBzdGFjayBkZXBsb3ltZW50IHByb2dyZXNzLlxuICAgKlxuICAgKiBAZGVmYXVsdCAtIFN0YWNrQWN0aXZpdHlQcm9ncmVzcy5CYXIgLSBzdGFjayBldmVudHMgd2lsbCBiZSBkaXNwbGF5ZWQgZm9yXG4gICAqICAgdGhlIHJlc291cmNlIGN1cnJlbnRseSBiZWluZyBkZXBsb3llZC5cbiAgICovXG4gIHByb2dyZXNzPzogU3RhY2tBY3Rpdml0eVByb2dyZXNzO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHdlIGFyZSBvbiBhIENJIHN5c3RlbVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgY2k/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlc3Ryb3lTdGFja09wdGlvbnMge1xuICBzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0O1xuICBkZXBsb3lOYW1lPzogc3RyaW5nO1xuICByb2xlQXJuPzogc3RyaW5nO1xuICBxdWlldD86IGJvb2xlYW47XG4gIGZvcmNlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdGFja0V4aXN0c09wdGlvbnMge1xuICBzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0O1xuICBkZXBsb3lOYW1lPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb3Zpc2lvbmVyUHJvcHMge1xuICBzZGtQcm92aWRlcjogU2RrUHJvdmlkZXI7XG59XG5cbi8qKlxuICogSGVscGVyIGNsYXNzIGZvciBDbG91ZEZvcm1hdGlvbiBkZXBsb3ltZW50c1xuICpcbiAqIExvb2tzIHVzIHRoZSByaWdodCBTREsgYW5kIEJvb3RzdHJhcCBzdGFjayB0byBkZXBsb3kgYSBnaXZlblxuICogc3RhY2sgYXJ0aWZhY3QuXG4gKi9cbmV4cG9ydCBjbGFzcyBDbG91ZEZvcm1hdGlvbkRlcGxveW1lbnRzIHtcbiAgcHJpdmF0ZSByZWFkb25seSBzZGtQcm92aWRlcjogU2RrUHJvdmlkZXI7XG5cbiAgY29uc3RydWN0b3IocHJvcHM6IFByb3Zpc2lvbmVyUHJvcHMpIHtcbiAgICB0aGlzLnNka1Byb3ZpZGVyID0gcHJvcHMuc2RrUHJvdmlkZXI7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVhZEN1cnJlbnRUZW1wbGF0ZShzdGFja0FydGlmYWN0OiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3QpOiBQcm9taXNlPFRlbXBsYXRlPiB7XG4gICAgZGVidWcoYFJlYWRpbmcgZXhpc3RpbmcgdGVtcGxhdGUgZm9yIHN0YWNrICR7c3RhY2tBcnRpZmFjdC5kaXNwbGF5TmFtZX0uYCk7XG4gICAgY29uc3QgeyBzdGFja1NkayB9ID0gYXdhaXQgdGhpcy5wcmVwYXJlU2RrRm9yKHN0YWNrQXJ0aWZhY3QsIHVuZGVmaW5lZCwgTW9kZS5Gb3JSZWFkaW5nKTtcbiAgICBjb25zdCBjZm4gPSBzdGFja1Nkay5jbG91ZEZvcm1hdGlvbigpO1xuXG4gICAgY29uc3Qgc3RhY2sgPSBhd2FpdCBDbG91ZEZvcm1hdGlvblN0YWNrLmxvb2t1cChjZm4sIHN0YWNrQXJ0aWZhY3Quc3RhY2tOYW1lKTtcbiAgICByZXR1cm4gc3RhY2sudGVtcGxhdGUoKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXBsb3lTdGFjayhvcHRpb25zOiBEZXBsb3lTdGFja09wdGlvbnMpOiBQcm9taXNlPERlcGxveVN0YWNrUmVzdWx0PiB7XG4gICAgY29uc3QgeyBzdGFja1NkaywgcmVzb2x2ZWRFbnZpcm9ubWVudCwgY2xvdWRGb3JtYXRpb25Sb2xlQXJuIH0gPSBhd2FpdCB0aGlzLnByZXBhcmVTZGtGb3Iob3B0aW9ucy5zdGFjaywgb3B0aW9ucy5yb2xlQXJuKTtcblxuICAgIGNvbnN0IHRvb2xraXRJbmZvID0gYXdhaXQgVG9vbGtpdFJlc291cmNlc0luZm8ubG9va3VwKHJlc29sdmVkRW52aXJvbm1lbnQsIHN0YWNrU2RrLCBvcHRpb25zLmJvb3RzdHJhcFF1YWxpZmllcik7XG5cbiAgICAvLyBQdWJsaXNoIGFueSBhc3NldHMgYmVmb3JlIGRvaW5nIHRoZSBhY3R1YWwgZGVwbG95XG4gICAgYXdhaXQgdGhpcy5wdWJsaXNoU3RhY2tBc3NldHMob3B0aW9ucy5zdGFjaywgdG9vbGtpdEluZm8pO1xuXG4gICAgLy8gRG8gYSB2ZXJpZmljYXRpb24gb2YgdGhlIGJvb3RzdHJhcCBzdGFjayB2ZXJzaW9uXG4gICAgdGhpcy52YWxpZGF0ZUJvb3RzdHJhcFN0YWNrVmVyc2lvbihvcHRpb25zLnN0YWNrLnN0YWNrTmFtZSwgb3B0aW9ucy5zdGFjay5yZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbiwgdG9vbGtpdEluZm8pO1xuXG4gICAgcmV0dXJuIGRlcGxveVN0YWNrKHtcbiAgICAgIHN0YWNrOiBvcHRpb25zLnN0YWNrLFxuICAgICAgcmVzb2x2ZWRFbnZpcm9ubWVudCxcbiAgICAgIGRlcGxveU5hbWU6IG9wdGlvbnMuZGVwbG95TmFtZSxcbiAgICAgIG5vdGlmaWNhdGlvbkFybnM6IG9wdGlvbnMubm90aWZpY2F0aW9uQXJucyxcbiAgICAgIHF1aWV0OiBvcHRpb25zLnF1aWV0LFxuICAgICAgc2RrOiBzdGFja1NkayxcbiAgICAgIHNka1Byb3ZpZGVyOiB0aGlzLnNka1Byb3ZpZGVyLFxuICAgICAgcm9sZUFybjogY2xvdWRGb3JtYXRpb25Sb2xlQXJuLFxuICAgICAgcmV1c2VBc3NldHM6IG9wdGlvbnMucmV1c2VBc3NldHMsXG4gICAgICB0b29sa2l0SW5mbyxcbiAgICAgIHRhZ3M6IG9wdGlvbnMudGFncyxcbiAgICAgIGV4ZWN1dGU6IG9wdGlvbnMuZXhlY3V0ZSxcbiAgICAgIGZvcmNlOiBvcHRpb25zLmZvcmNlLFxuICAgICAgcGFyYW1ldGVyczogb3B0aW9ucy5wYXJhbWV0ZXJzLFxuICAgICAgdXNlUHJldmlvdXNQYXJhbWV0ZXJzOiBvcHRpb25zLnVzZVByZXZpb3VzUGFyYW1ldGVycyxcbiAgICAgIHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzLFxuICAgICAgY2k6IG9wdGlvbnMuY2ksXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveVN0YWNrKG9wdGlvbnM6IERlc3Ryb3lTdGFja09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHN0YWNrU2RrLCBjbG91ZEZvcm1hdGlvblJvbGVBcm46IHJvbGVBcm4gfSA9IGF3YWl0IHRoaXMucHJlcGFyZVNka0ZvcihvcHRpb25zLnN0YWNrLCBvcHRpb25zLnJvbGVBcm4pO1xuXG4gICAgcmV0dXJuIGRlc3Ryb3lTdGFjayh7XG4gICAgICBzZGs6IHN0YWNrU2RrLFxuICAgICAgcm9sZUFybixcbiAgICAgIHN0YWNrOiBvcHRpb25zLnN0YWNrLFxuICAgICAgZGVwbG95TmFtZTogb3B0aW9ucy5kZXBsb3lOYW1lLFxuICAgICAgcXVpZXQ6IG9wdGlvbnMucXVpZXQsXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc3RhY2tFeGlzdHMob3B0aW9uczogU3RhY2tFeGlzdHNPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgeyBzdGFja1NkayB9ID0gYXdhaXQgdGhpcy5wcmVwYXJlU2RrRm9yKG9wdGlvbnMuc3RhY2ssIHVuZGVmaW5lZCwgTW9kZS5Gb3JSZWFkaW5nKTtcbiAgICBjb25zdCBzdGFjayA9IGF3YWl0IENsb3VkRm9ybWF0aW9uU3RhY2subG9va3VwKHN0YWNrU2RrLmNsb3VkRm9ybWF0aW9uKCksIG9wdGlvbnMuZGVwbG95TmFtZSA/PyBvcHRpb25zLnN0YWNrLnN0YWNrTmFtZSk7XG4gICAgcmV0dXJuIHN0YWNrLmV4aXN0cztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGVudmlyb25tZW50IG5lY2Vzc2FyeSBmb3IgdG91Y2hpbmcgdGhlIGdpdmVuIHN0YWNrXG4gICAqXG4gICAqIFJldHVybnMgdGhlIGZvbGxvd2luZzpcbiAgICpcbiAgICogLSBUaGUgcmVzb2x2ZWQgZW52aXJvbm1lbnQgZm9yIHRoZSBzdGFjayAobm8gbW9yZSAndW5rbm93bi1hY2NvdW50L3Vua25vd24tcmVnaW9uJylcbiAgICogLSBTREsgbG9hZGVkIHdpdGggdGhlIHJpZ2h0IGNyZWRlbnRpYWxzIGZvciBjYWxsaW5nIGBDcmVhdGVDaGFuZ2VTZXRgLlxuICAgKiAtIFRoZSBFeGVjdXRpb24gUm9sZSB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gQ2xvdWRGb3JtYXRpb24uXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHByZXBhcmVTZGtGb3Ioc3RhY2s6IGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdCwgcm9sZUFybj86IHN0cmluZywgbW9kZSA9IE1vZGUuRm9yV3JpdGluZykge1xuICAgIGlmICghc3RhY2suZW52aXJvbm1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHN0YWNrICR7c3RhY2suZGlzcGxheU5hbWV9IGRvZXMgbm90IGhhdmUgYW4gZW52aXJvbm1lbnRgKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZEVudmlyb25tZW50ID0gYXdhaXQgdGhpcy5zZGtQcm92aWRlci5yZXNvbHZlRW52aXJvbm1lbnQoc3RhY2suZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gU3Vic3RpdHV0ZSBhbnkgcGxhY2Vob2xkZXJzIHdpdGggaW5mb3JtYXRpb24gYWJvdXQgdGhlIGN1cnJlbnQgZW52aXJvbm1lbnRcbiAgICBjb25zdCBhcm5zID0gYXdhaXQgdGhpcy5yZXBsYWNlRW52UGxhY2Vob2xkZXJzKHtcbiAgICAgIGFzc3VtZVJvbGVBcm46IHN0YWNrLmFzc3VtZVJvbGVBcm4sXG5cbiAgICAgIC8vIFVzZSB0aGUgb3ZlcnJpZGUgaWYgZ2l2ZW4sIG90aGVyd2lzZSB1c2UgdGhlIGZpZWxkIGZyb20gdGhlIHN0YWNrXG4gICAgICBjbG91ZEZvcm1hdGlvblJvbGVBcm46IHJvbGVBcm4gPz8gc3RhY2suY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Sb2xlQXJuLFxuICAgIH0sIHJlc29sdmVkRW52aXJvbm1lbnQpO1xuXG4gICAgY29uc3Qgc3RhY2tTZGsgPSBhd2FpdCB0aGlzLnNka1Byb3ZpZGVyLmZvckVudmlyb25tZW50KHJlc29sdmVkRW52aXJvbm1lbnQsIG1vZGUsIHtcbiAgICAgIGFzc3VtZVJvbGVBcm46IGFybnMuYXNzdW1lUm9sZUFybixcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGFja1NkayxcbiAgICAgIHJlc29sdmVkRW52aXJvbm1lbnQsXG4gICAgICBjbG91ZEZvcm1hdGlvblJvbGVBcm46IGFybnMuY2xvdWRGb3JtYXRpb25Sb2xlQXJuLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZSB0aGUge0FDQ09VTlR9IGFuZCB7UkVHSU9OfSBwbGFjZWhvbGRlcnMgaW4gYWxsIHN0cmluZ3MgZm91bmQgaW4gYSBjb21wbGV4IG9iamVjdC5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcmVwbGFjZUVudlBsYWNlaG9sZGVyczxBIGV4dGVuZHMgeyB9PihvYmplY3Q6IEEsIGVudjogY3hhcGkuRW52aXJvbm1lbnQpOiBQcm9taXNlPEE+IHtcbiAgICByZXR1cm4gY3hhcGkuRW52aXJvbm1lbnRQbGFjZWhvbGRlcnMucmVwbGFjZUFzeW5jKG9iamVjdCwge1xuICAgICAgYWNjb3VudElkOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoZW52LmFjY291bnQpLFxuICAgICAgcmVnaW9uOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoZW52LnJlZ2lvbiksXG4gICAgICBwYXJ0aXRpb246IGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gVGhlcmUncyBubyBnb29kIHdheSB0byBnZXQgdGhlIHBhcnRpdGlvbiFcbiAgICAgICAgLy8gV2Ugc2hvdWxkIGhhdmUgaGFkIGl0IGFscmVhZHksIGV4Y2VwdCB3ZSBkb24ndC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQmVzdCB3ZSBjYW4gZG8gaXMgYXNrIHRoZSBcImJhc2UgY3JlZGVudGlhbHNcIiBmb3IgdGhpcyBlbnZpcm9ubWVudCBmb3IgdGhlaXIgcGFydGl0aW9uLiBDcm9zcy1wYXJ0aXRpb25cbiAgICAgICAgLy8gQXNzdW1lUm9sZSdpbmcgd2lsbCBuZXZlciB3b3JrIGFueXdheSwgc28gdGhpcyBhbnN3ZXIgd29uJ3QgYmUgd3JvbmcgKGl0IHdpbGwganVzdCBiZSBzbG93ISlcbiAgICAgICAgcmV0dXJuIChhd2FpdCB0aGlzLnNka1Byb3ZpZGVyLmJhc2VDcmVkZW50aWFsc1BhcnRpdGlvbihlbnYsIE1vZGUuRm9yUmVhZGluZykpID8/ICdhd3MnO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQdWJsaXNoIGFsbCBhc3NldCBtYW5pZmVzdHMgdGhhdCBhcmUgcmVmZXJlbmNlZCBieSB0aGUgZ2l2ZW4gc3RhY2tcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcHVibGlzaFN0YWNrQXNzZXRzKHN0YWNrOiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3QsIGJvb3RzdHJhcFN0YWNrOiBUb29sa2l0UmVzb3VyY2VzSW5mbyB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IHN0YWNrRW52ID0gYXdhaXQgdGhpcy5zZGtQcm92aWRlci5yZXNvbHZlRW52aXJvbm1lbnQoc3RhY2suZW52aXJvbm1lbnQpO1xuICAgIGNvbnN0IGFzc2V0QXJ0aWZhY3RzID0gc3RhY2suZGVwZW5kZW5jaWVzLmZpbHRlcihpc0Fzc2V0TWFuaWZlc3RBcnRpZmFjdCk7XG5cbiAgICBmb3IgKGNvbnN0IGFzc2V0QXJ0aWZhY3Qgb2YgYXNzZXRBcnRpZmFjdHMpIHtcbiAgICAgIHRoaXMudmFsaWRhdGVCb290c3RyYXBTdGFja1ZlcnNpb24oc3RhY2suc3RhY2tOYW1lLCBhc3NldEFydGlmYWN0LnJlcXVpcmVzQm9vdHN0cmFwU3RhY2tWZXJzaW9uLCBib290c3RyYXBTdGFjayk7XG5cbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gQXNzZXRNYW5pZmVzdC5mcm9tRmlsZShhc3NldEFydGlmYWN0LmZpbGUpO1xuICAgICAgYXdhaXQgcHVibGlzaEFzc2V0cyhtYW5pZmVzdCwgdGhpcy5zZGtQcm92aWRlciwgc3RhY2tFbnYpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGF0IHRoZSBib290c3RyYXAgc3RhY2sgaGFzIHRoZSByaWdodCB2ZXJzaW9uIGZvciB0aGlzIHN0YWNrXG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlQm9vdHN0cmFwU3RhY2tWZXJzaW9uKFxuICAgIHN0YWNrTmFtZTogc3RyaW5nLFxuICAgIHJlcXVpcmVzQm9vdHN0cmFwU3RhY2tWZXJzaW9uOiBudW1iZXIgfCB1bmRlZmluZWQsXG4gICAgYm9vdHN0cmFwU3RhY2s6IFRvb2xraXRSZXNvdXJjZXNJbmZvIHwgdW5kZWZpbmVkKSB7XG5cbiAgICBpZiAocmVxdWlyZXNCb290c3RyYXBTdGFja1ZlcnNpb24gPT09IHVuZGVmaW5lZCkgeyByZXR1cm47IH1cblxuICAgIGlmICghYm9vdHN0cmFwU3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgJHtzdGFja05hbWV9OiBwdWJsaXNoaW5nIGFzc2V0cyByZXF1aXJlcyBib290c3RyYXAgc3RhY2sgdmVyc2lvbiAnJHtyZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbn0nLCBubyBib290c3RyYXAgc3RhY2sgZm91bmQuIFBsZWFzZSBydW4gJ2NkayBib290c3RyYXAnLmApO1xuICAgIH1cblxuICAgIGlmIChyZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbiA+IGJvb3RzdHJhcFN0YWNrLnZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgJHtzdGFja05hbWV9OiBwdWJsaXNoaW5nIGFzc2V0cyByZXF1aXJlcyBib290c3RyYXAgc3RhY2sgdmVyc2lvbiAnJHtyZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbn0nLCBmb3VuZCAnJHtib290c3RyYXBTdGFjay52ZXJzaW9ufScuIFBsZWFzZSBydW4gJ2NkayBib290c3RyYXAnIHdpdGggYSBuZXdlciBDTEkgdmVyc2lvbi5gKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBc3NldE1hbmlmZXN0QXJ0aWZhY3QoYXJ0OiBjeGFwaS5DbG91ZEFydGlmYWN0KTogYXJ0IGlzIGN4YXBpLkFzc2V0TWFuaWZlc3RBcnRpZmFjdCB7XG4gIHJldHVybiBhcnQgaW5zdGFuY2VvZiBjeGFwaS5Bc3NldE1hbmlmZXN0QXJ0aWZhY3Q7XG59XG4iXX0=