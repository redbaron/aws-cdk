"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destroyStack = exports.deployStack = void 0;
const cxapi = require("@aws-cdk/cx-api");
const colors = require("colors/safe");
const uuid = require("uuid");
const assets_1 = require("../assets");
const logging_1 = require("../logging");
const serialize_1 = require("../serialize");
const asset_manifest_builder_1 = require("../util/asset-manifest-builder");
const asset_publishing_1 = require("../util/asset-publishing");
const content_hash_1 = require("../util/content-hash");
const cloudformation_1 = require("./util/cloudformation");
const stack_activity_monitor_1 = require("./util/cloudformation/stack-activity-monitor");
// We need to map regions to domain suffixes, and the SDK already has a function to do this.
// It's not part of the public API, but it's also unlikely to go away.
//
// Reuse that function, and add a safety check so we don't accidentally break if they ever
// refactor that away.
/* eslint-disable @typescript-eslint/no-require-imports */
const regionUtil = require('aws-sdk/lib/region_config');
/* eslint-enable @typescript-eslint/no-require-imports */
if (!regionUtil.getEndpointSuffix) {
    throw new Error('This version of AWS SDK for JS does not have the \'getEndpointSuffix\' function!');
}
const LARGE_TEMPLATE_SIZE_KB = 50;
/** @experimental */
async function deployStack(options) {
    var _a, _b;
    const stackArtifact = options.stack;
    const stackEnv = options.resolvedEnvironment;
    const cfn = options.sdk.cloudFormation();
    const deployName = options.deployName || stackArtifact.stackName;
    let cloudFormationStack = await cloudformation_1.CloudFormationStack.lookup(cfn, deployName);
    if (cloudFormationStack.stackStatus.isCreationFailure) {
        logging_1.debug(`Found existing stack ${deployName} that had previously failed creation. Deleting it before attempting to re-create it.`);
        await cfn.deleteStack({ StackName: deployName }).promise();
        const deletedStack = await cloudformation_1.waitForStackDelete(cfn, deployName);
        if (deletedStack && deletedStack.stackStatus.name !== 'DELETE_COMPLETE') {
            throw new Error(`Failed deleting stack ${deployName} that had previously failed creation (current state: ${deletedStack.stackStatus})`);
        }
        // Update variable to mark that the stack does not exist anymore, but avoid
        // doing an actual lookup in CloudFormation (which would be silly to do if
        // we just deleted it).
        cloudFormationStack = cloudformation_1.CloudFormationStack.doesNotExist(cfn, deployName);
    }
    // Detect "legacy" assets (which remain in the metadata) and publish them via
    // an ad-hoc asset manifest, while passing their locations via template
    // parameters.
    const legacyAssets = new asset_manifest_builder_1.AssetManifestBuilder();
    const assetParams = await assets_1.addMetadataAssetsToManifest(stackArtifact, legacyAssets, options.toolkitInfo, options.reuseAssets);
    const finalParameterValues = { ...options.parameters, ...assetParams };
    const templateParams = cloudformation_1.TemplateParameters.fromTemplate(stackArtifact.template);
    const stackParams = options.usePreviousParameters
        ? templateParams.updateExisting(finalParameterValues, cloudFormationStack.parameters)
        : templateParams.supplyAll(finalParameterValues);
    if (await canSkipDeploy(options, cloudFormationStack, stackParams.hasChanges(cloudFormationStack.parameters))) {
        logging_1.debug(`${deployName}: skipping deployment (use --force to override)`);
        return {
            noOp: true,
            outputs: cloudFormationStack.outputs,
            stackArn: cloudFormationStack.stackId,
            stackArtifact,
        };
    }
    else {
        logging_1.debug(`${deployName}: deploying...`);
    }
    const executionId = uuid.v4();
    const bodyParameter = await makeBodyParameter(stackArtifact, options.resolvedEnvironment, legacyAssets, options.toolkitInfo);
    await asset_publishing_1.publishAssets(legacyAssets.toManifest(stackArtifact.assembly.directory), options.sdkProvider, stackEnv);
    const changeSetName = `CDK-${executionId}`;
    const update = cloudFormationStack.exists && cloudFormationStack.stackStatus.name !== 'REVIEW_IN_PROGRESS';
    logging_1.debug(`Attempting to create ChangeSet ${changeSetName} to ${update ? 'update' : 'create'} stack ${deployName}`);
    logging_1.print('%s: creating CloudFormation changeset...', colors.bold(deployName));
    const changeSet = await cfn.createChangeSet({
        StackName: deployName,
        ChangeSetName: changeSetName,
        ChangeSetType: update ? 'UPDATE' : 'CREATE',
        Description: `CDK Changeset for execution ${executionId}`,
        TemplateBody: bodyParameter.TemplateBody,
        TemplateURL: bodyParameter.TemplateURL,
        Parameters: stackParams.apiParameters,
        RoleARN: options.roleArn,
        NotificationARNs: options.notificationArns,
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
        Tags: options.tags,
    }).promise();
    logging_1.debug('Initiated creation of changeset: %s; waiting for it to finish creating...', changeSet.Id);
    const changeSetDescription = await cloudformation_1.waitForChangeSet(cfn, deployName, changeSetName);
    // Update termination protection only if it has changed.
    const terminationProtection = (_a = stackArtifact.terminationProtection) !== null && _a !== void 0 ? _a : false;
    if (!!cloudFormationStack.terminationProtection !== terminationProtection) {
        logging_1.debug('Updating termination protection from %s to %s for stack %s', cloudFormationStack.terminationProtection, terminationProtection, deployName);
        await cfn.updateTerminationProtection({
            StackName: deployName,
            EnableTerminationProtection: terminationProtection,
        }).promise();
        logging_1.debug('Termination protection updated to %s for stack %s', terminationProtection, deployName);
    }
    if (cloudformation_1.changeSetHasNoChanges(changeSetDescription)) {
        logging_1.debug('No changes are to be performed on %s.', deployName);
        await cfn.deleteChangeSet({ StackName: deployName, ChangeSetName: changeSetName }).promise();
        return { noOp: true, outputs: cloudFormationStack.outputs, stackArn: changeSet.StackId, stackArtifact };
    }
    const execute = options.execute === undefined ? true : options.execute;
    if (execute) {
        logging_1.debug('Initiating execution of changeset %s on stack %s', changeSetName, deployName);
        await cfn.executeChangeSet({ StackName: deployName, ChangeSetName: changeSetName }).promise();
        // eslint-disable-next-line max-len
        const monitor = options.quiet ? undefined : stack_activity_monitor_1.StackActivityMonitor.withDefaultPrinter(cfn, deployName, stackArtifact, {
            resourcesTotal: ((_b = changeSetDescription.Changes) !== null && _b !== void 0 ? _b : []).length,
            progress: options.progress,
            changeSetCreationTime: changeSetDescription.CreationTime,
        }).start();
        logging_1.debug('Execution of changeset %s on stack %s has started; waiting for the update to complete...', changeSetName, deployName);
        try {
            const finalStack = await cloudformation_1.waitForStackDeploy(cfn, deployName);
            // This shouldn't really happen, but catch it anyway. You never know.
            if (!finalStack) {
                throw new Error('Stack deploy failed (the stack disappeared while we were deploying it)');
            }
            cloudFormationStack = finalStack;
        }
        finally {
            await (monitor === null || monitor === void 0 ? void 0 : monitor.stop());
        }
        logging_1.debug('Stack %s has completed updating', deployName);
    }
    else {
        logging_1.print('Changeset %s created and waiting in review for manual execution (--no-execute)', changeSetName);
    }
    return { noOp: false, outputs: cloudFormationStack.outputs, stackArn: changeSet.StackId, stackArtifact };
}
exports.deployStack = deployStack;
/**
 * Prepares the body parameter for +CreateChangeSet+.
 *
 * If the template is small enough to be inlined into the API call, just return
 * it immediately.
 *
 * Otherwise, add it to the asset manifest to get uploaded to the staging
 * bucket and return its coordinates. If there is no staging bucket, an error
 * is thrown.
 *
 * @param stack     the synthesized stack that provides the CloudFormation template
 * @param toolkitInfo information about the toolkit stack
 */
async function makeBodyParameter(stack, resolvedEnvironment, assetManifest, toolkitInfo) {
    // If the template has already been uploaded to S3, just use it from there.
    if (stack.stackTemplateAssetObjectUrl) {
        return { TemplateURL: restUrlFromManifest(stack.stackTemplateAssetObjectUrl, resolvedEnvironment) };
    }
    // Otherwise, pass via API call (if small) or upload here (if large)
    const templateJson = serialize_1.toYAML(stack.template);
    if (templateJson.length <= LARGE_TEMPLATE_SIZE_KB * 1024) {
        return { TemplateBody: templateJson };
    }
    if (!toolkitInfo) {
        logging_1.error(`The template for stack "${stack.displayName}" is ${Math.round(templateJson.length / 1024)}KiB. ` +
            `Templates larger than ${LARGE_TEMPLATE_SIZE_KB}KiB must be uploaded to S3.\n` +
            'Run the following command in order to setup an S3 bucket in this environment, and then re-deploy:\n\n', colors.blue(`\t$ cdk bootstrap ${resolvedEnvironment.name}\n`));
        throw new Error('Template too large to deploy ("cdk bootstrap" is required)');
    }
    const templateHash = content_hash_1.contentHash(templateJson);
    const key = `cdk/${stack.id}/${templateHash}.yml`;
    assetManifest.addFileAsset(templateHash, {
        path: stack.templateFile,
    }, {
        bucketName: toolkitInfo.bucketName,
        objectKey: key,
    });
    const templateURL = `${toolkitInfo.bucketUrl}/${key}`;
    logging_1.debug('Storing template in S3 at:', templateURL);
    return { TemplateURL: templateURL };
}
/** @experimental */
async function destroyStack(options) {
    const deployName = options.deployName || options.stack.stackName;
    const cfn = options.sdk.cloudFormation();
    const currentStack = await cloudformation_1.CloudFormationStack.lookup(cfn, deployName);
    if (!currentStack.exists) {
        return;
    }
    const monitor = options.quiet ? undefined : stack_activity_monitor_1.StackActivityMonitor.withDefaultPrinter(cfn, deployName, options.stack).start();
    try {
        await cfn.deleteStack({ StackName: deployName, RoleARN: options.roleArn }).promise();
        const destroyedStack = await cloudformation_1.waitForStackDelete(cfn, deployName);
        if (destroyedStack && destroyedStack.stackStatus.name !== 'DELETE_COMPLETE') {
            throw new Error(`Failed to destroy ${deployName}: ${destroyedStack.stackStatus}`);
        }
    }
    finally {
        if (monitor) {
            await monitor.stop();
        }
    }
}
exports.destroyStack = destroyStack;
/**
 * Checks whether we can skip deployment
 *
 * We do this in a complicated way by preprocessing (instead of just
 * looking at the changeset), because if there are nested stacks involved
 * the changeset will always show the nested stacks as needing to be
 * updated, and the deployment will take a long time to in effect not
 * do anything.
 */
async function canSkipDeploy(deployStackOptions, cloudFormationStack, parameterChanges) {
    var _a;
    const deployName = deployStackOptions.deployName || deployStackOptions.stack.stackName;
    logging_1.debug(`${deployName}: checking if we can skip deploy`);
    // Forced deploy
    if (deployStackOptions.force) {
        logging_1.debug(`${deployName}: forced deployment`);
        return false;
    }
    // No existing stack
    if (!cloudFormationStack.exists) {
        logging_1.debug(`${deployName}: no existing stack`);
        return false;
    }
    // Template has changed (assets taken into account here)
    if (JSON.stringify(deployStackOptions.stack.template) !== JSON.stringify(await cloudFormationStack.template())) {
        logging_1.debug(`${deployName}: template has changed`);
        return false;
    }
    // Tags have changed
    if (!compareTags(cloudFormationStack.tags, (_a = deployStackOptions.tags) !== null && _a !== void 0 ? _a : [])) {
        logging_1.debug(`${deployName}: tags have changed`);
        return false;
    }
    // Termination protection has been updated
    if (!!deployStackOptions.stack.terminationProtection !== !!cloudFormationStack.terminationProtection) {
        logging_1.debug(`${deployName}: termination protection has been updated`);
        return false;
    }
    // Parameters have changed
    if (parameterChanges) {
        logging_1.debug(`${deployName}: parameters have changed`);
        return false;
    }
    // Existing stack is in a failed state
    if (cloudFormationStack.stackStatus.isFailure) {
        logging_1.debug(`${deployName}: stack is in a failure state`);
        return false;
    }
    // We can skip deploy
    return true;
}
/**
 * Compares two list of tags, returns true if identical.
 */
function compareTags(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (const aTag of a) {
        const bTag = b.find(tag => tag.Key === aTag.Key);
        if (!bTag || bTag.Value !== aTag.Value) {
            return false;
        }
    }
    return true;
}
/**
 * Format an S3 URL in the manifest for use with CloudFormation
 *
 * Replaces environment placeholders (which this field may contain),
 * and reformats s3://.../... urls into S3 REST URLs (which CloudFormation
 * expects)
 */
function restUrlFromManifest(url, environment) {
    const doNotUseMarker = '**DONOTUSE**';
    // This URL may contain placeholders, so still substitute those.
    url = cxapi.EnvironmentPlaceholders.replace(url, {
        accountId: environment.account,
        region: environment.region,
        partition: doNotUseMarker,
    });
    // Yes, this is extremely crude, but we don't actually need this so I'm not inclined to spend
    // a lot of effort trying to thread the right value to this location.
    if (url.indexOf(doNotUseMarker) > -1) {
        throw new Error('Cannot use \'${AWS::Partition}\' in the \'stackTemplateAssetObjectUrl\' field');
    }
    const s3Url = url.match(/s3:\/\/([^/]+)\/(.*)$/);
    if (!s3Url) {
        return url;
    }
    // We need to pass an 'https://s3.REGION.amazonaws.com[.cn]/bucket/object' URL to CloudFormation, but we
    // got an 's3://bucket/object' URL instead. Construct the rest API URL here.
    const bucketName = s3Url[1];
    const objectKey = s3Url[2];
    const urlSuffix = regionUtil.getEndpointSuffix(environment.region);
    return `https://s3.${environment.region}.${urlSuffix}/${bucketName}/${objectKey}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlDQUF5QztBQUN6QyxzQ0FBc0M7QUFDdEMsNkJBQTZCO0FBQzdCLHNDQUF3RDtBQUV4RCx3Q0FBaUQ7QUFDakQsNENBQXNDO0FBQ3RDLDJFQUFzRTtBQUN0RSwrREFBeUQ7QUFDekQsdURBQW1EO0FBR25ELDBEQUFpSztBQUNqSyx5RkFBMkc7QUFFM0csNEZBQTRGO0FBQzVGLHNFQUFzRTtBQUN0RSxFQUFFO0FBQ0YsMEZBQTBGO0FBQzFGLHNCQUFzQjtBQUV0QiwwREFBMEQ7QUFDMUQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDeEQseURBQXlEO0FBRXpELElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLEVBQUU7SUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxrRkFBa0YsQ0FBQyxDQUFDO0NBQ3JHO0FBc0pELE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0FBRWxDLG9CQUFvQjtBQUNiLEtBQUssVUFBVSxXQUFXLENBQUMsT0FBMkI7O0lBQzNELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFFcEMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO0lBRTdDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDekMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsSUFBSSxhQUFhLENBQUMsU0FBUyxDQUFDO0lBQ2pFLElBQUksbUJBQW1CLEdBQUcsTUFBTSxvQ0FBbUIsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBRTVFLElBQUksbUJBQW1CLENBQUMsV0FBVyxDQUFDLGlCQUFpQixFQUFFO1FBQ3JELGVBQUssQ0FBQyx3QkFBd0IsVUFB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QUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLCtFQUErRSxDQUFDLENBQUM7S0FDbEc7SUFFRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDakQsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUFFLE9BQU8sR0FBRyxDQUFDO0tBQUU7SUFFM0Isd0dBQXdHO0lBQ3hHLDRFQUE0RTtJQUM1RSxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTNCLE1BQU0sU0FBUyxHQUFXLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0UsT0FBTyxjQUFjLFdBQVcsQ0FBQyxNQUFNLElBQUksU0FBUyxJQUFJLFVBQVUsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUNwRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcnMvc2FmZSc7XG5pbXBvcnQgKiBhcyB1dWlkIGZyb20gJ3V1aWQnO1xuaW1wb3J0IHsgYWRkTWV0YWRhdGFBc3NldHNUb01hbmlmZXN0IH0gZnJvbSAnLi4vYXNzZXRzJztcbmltcG9ydCB7IFRhZyB9IGZyb20gJy4uL2Nkay10b29sa2l0JztcbmltcG9ydCB7IGRlYnVnLCBlcnJvciwgcHJpbnQgfSBmcm9tICcuLi9sb2dnaW5nJztcbmltcG9ydCB7IHRvWUFNTCB9IGZyb20gJy4uL3NlcmlhbGl6ZSc7XG5pbXBvcnQgeyBBc3NldE1hbmlmZXN0QnVpbGRlciB9IGZyb20gJy4uL3V0aWwvYXNzZXQtbWFuaWZlc3QtYnVpbGRlcic7XG5pbXBvcnQgeyBwdWJsaXNoQXNzZXRzIH0gZnJvbSAnLi4vdXRpbC9hc3NldC1wdWJsaXNoaW5nJztcbmltcG9ydCB7IGNvbnRlbnRIYXNoIH0gZnJvbSAnLi4vdXRpbC9jb250ZW50LWhhc2gnO1xuaW1wb3J0IHsgSVNESywgU2RrUHJvdmlkZXIgfSBmcm9tICcuL2F3cy1hdXRoJztcbmltcG9ydCB7IFRvb2xraXRSZXNvdXJjZXNJbmZvIH0gZnJvbSAnLi90b29sa2l0LWluZm8nO1xuaW1wb3J0IHsgY2hhbmdlU2V0SGFzTm9DaGFuZ2VzLCBDbG91ZEZvcm1hdGlvblN0YWNrLCBUZW1wbGF0ZVBhcmFtZXRlcnMsIHdhaXRGb3JDaGFuZ2VTZXQsIHdhaXRGb3JTdGFja0RlcGxveSwgd2FpdEZvclN0YWNrRGVsZXRlIH0gZnJvbSAnLi91dGlsL2Nsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IFN0YWNrQWN0aXZpdHlNb25pdG9yLCBTdGFja0FjdGl2aXR5UHJvZ3Jlc3MgfSBmcm9tICcuL3V0aWwvY2xvdWRmb3JtYXRpb24vc3RhY2stYWN0aXZpdHktbW9uaXRvcic7XG5cbi8vIFdlIG5lZWQgdG8gbWFwIHJlZ2lvbnMgdG8gZG9tYWluIHN1ZmZpeGVzLCBhbmQgdGhlIFNESyBhbHJlYWR5IGhhcyBhIGZ1bmN0aW9uIHRvIGRvIHRoaXMuXG4vLyBJdCdzIG5vdCBwYXJ0IG9mIHRoZSBwdWJsaWMgQVBJLCBidXQgaXQncyBhbHNvIHVubGlrZWx5IHRvIGdvIGF3YXkuXG4vL1xuLy8gUmV1c2UgdGhhdCBmdW5jdGlvbiwgYW5kIGFkZCBhIHNhZmV0eSBjaGVjayBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgYnJlYWsgaWYgdGhleSBldmVyXG4vLyByZWZhY3RvciB0aGF0IGF3YXkuXG5cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IHJlZ2lvblV0aWwgPSByZXF1aXJlKCdhd3Mtc2RrL2xpYi9yZWdpb25fY29uZmlnJyk7XG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cblxuaWYgKCFyZWdpb25VdGlsLmdldEVuZHBvaW50U3VmZml4KSB7XG4gIHRocm93IG5ldyBFcnJvcignVGhpcyB2ZXJzaW9uIG9mIEFXUyBTREsgZm9yIEpTIGRvZXMgbm90IGhhdmUgdGhlIFxcJ2dldEVuZHBvaW50U3VmZml4XFwnIGZ1bmN0aW9uIScpO1xufVxuXG50eXBlIFRlbXBsYXRlQm9keVBhcmFtZXRlciA9IHtcbiAgVGVtcGxhdGVCb2R5Pzogc3RyaW5nXG4gIFRlbXBsYXRlVVJMPzogc3RyaW5nXG59O1xuXG4vKiogQGV4cGVyaW1lbnRhbCAqL1xuZXhwb3J0IGludGVyZmFjZSBEZXBsb3lTdGFja1Jlc3VsdCB7XG4gIHJlYWRvbmx5IG5vT3A6IGJvb2xlYW47XG4gIHJlYWRvbmx5IG91dHB1dHM6IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB9O1xuICByZWFkb25seSBzdGFja0Fybjogc3RyaW5nO1xuICByZWFkb25seSBzdGFja0FydGlmYWN0OiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3Q7XG59XG5cbi8qKiBAZXhwZXJpbWVudGFsICovXG5leHBvcnQgaW50ZXJmYWNlIERlcGxveVN0YWNrT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgc3RhY2sgdG8gYmUgZGVwbG95ZWRcbiAgICovXG4gIHN0YWNrOiBjeGFwaS5DbG91ZEZvcm1hdGlvblN0YWNrQXJ0aWZhY3Q7XG5cbiAgLyoqXG4gICAqIFRoZSBlbnZpcm9ubWVudCB0byBkZXBsb3kgdGhpcyBzdGFjayBpblxuICAgKlxuICAgKiBUaGUgZW52aXJvbm1lbnQgb24gdGhlIHN0YWNrIGFydGlmYWN0IG1heSBiZSB1bnJlc29sdmVkLCB0aGlzIG9uZVxuICAgKiBtdXN0IGJlIHJlc29sdmVkLlxuICAgKi9cbiAgcmVzb2x2ZWRFbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQ7XG5cbiAgLyoqXG4gICAqIFRoZSBTREsgdG8gdXNlIGZvciBkZXBsb3lpbmcgdGhlIHN0YWNrXG4gICAqXG4gICAqIFNob3VsZCBoYXZlIGJlZW4gaW5pdGlhbGl6ZWQgd2l0aCB0aGUgY29ycmVjdCByb2xlIHdpdGggd2hpY2hcbiAgICogc3RhY2sgb3BlcmF0aW9ucyBzaG91bGQgYmUgcGVyZm9ybWVkLlxuICAgKi9cbiAgc2RrOiBJU0RLO1xuXG4gIC8qKlxuICAgKiBTREsgcHJvdmlkZXIgKHNlZWRlZCB3aXRoIGRlZmF1bHQgY3JlZGVudGlhbHMpXG4gICAqXG4gICAqIFdpbGwgZXhjbHVzaXZlbHkgYmUgdXNlZCB0byBhc3N1bWUgcHVibGlzaGluZyBjcmVkZW50aWFscyAod2hpY2ggbXVzdFxuICAgKiBzdGFydCBvdXQgZnJvbSBjdXJyZW50IGNyZWRlbnRpYWxzIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB3ZSd2ZSBhc3N1bWVkIGFuXG4gICAqIGFjdGlvbiByb2xlIHRvIHRvdWNoIHRoZSBzdGFjayBvciBub3QpLlxuICAgKlxuICAgKiBVc2VkIGZvciB0aGUgZm9sbG93aW5nIHB1cnBvc2VzOlxuICAgKlxuICAgKiAtIFB1Ymxpc2ggbGVnYWN5IGFzc2V0cy5cbiAgICogLSBVcGxvYWQgbGFyZ2UgQ2xvdWRGb3JtYXRpb24gdGVtcGxhdGVzIHRvIHRoZSBzdGFnaW5nIGJ1Y2tldC5cbiAgICovXG4gIHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcjtcblxuICAvKipcbiAgICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIGJvb3RzdHJhcCBzdGFjayBmb3VuZCBpbiB0aGUgdGFyZ2V0IGVudmlyb25tZW50XG4gICAqXG4gICAqIEBkZWZhdWx0IC0gQXNzdW1lIHRoZXJlIGlzIG5vIGJvb3RzdHJhcCBzdGFja1xuICAgKi9cbiAgdG9vbGtpdEluZm8/OiBUb29sa2l0UmVzb3VyY2VzSW5mbztcblxuICAvKipcbiAgICogUm9sZSB0byBwYXNzIHRvIENsb3VkRm9ybWF0aW9uIHRvIGV4ZWN1dGUgdGhlIGNoYW5nZSBzZXRcbiAgICpcbiAgICogQGRlZmF1bHQgLSBSb2xlIHNwZWNpZmllZCBvbiBzdGFjaywgb3RoZXJ3aXNlIGN1cnJlbnRcbiAgICovXG4gIHJvbGVBcm4/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIE5vdGlmaWNhdGlvbiBBUk5zIHRvIHBhc3MgdG8gQ2xvdWRGb3JtYXRpb24gdG8gbm90aWZ5IHdoZW4gdGhlIGNoYW5nZSBzZXQgaGFzIGNvbXBsZXRlZFxuICAgKlxuICAgKiBAZGVmYXVsdCAtIE5vIG5vdGlmaWNhdGlvbnNcbiAgICovXG4gIG5vdGlmaWNhdGlvbkFybnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogTmFtZSB0byBkZXBsb3kgdGhlIHN0YWNrIHVuZGVyXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gTmFtZSBmcm9tIGFzc2VtYmx5XG4gICAqL1xuICBkZXBsb3lOYW1lPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBRdWlldCBvciB2ZXJib3NlIGRlcGxveW1lbnRcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHF1aWV0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogTGlzdCBvZiBhc3NldCBJRHMgd2hpY2ggc2hvdWxkbid0IGJlIGJ1aWx0XG4gICAqXG4gICAqIEBkZWZhdWx0IC0gQnVpbGQgYWxsIGFzc2V0c1xuICAgKi9cbiAgcmV1c2VBc3NldHM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogVGFncyB0byBwYXNzIHRvIENsb3VkRm9ybWF0aW9uIHRvIGFkZCB0byBzdGFja1xuICAgKlxuICAgKiBAZGVmYXVsdCAtIE5vIHRhZ3NcbiAgICovXG4gIHRhZ3M/OiBUYWdbXTtcblxuICAvKipcbiAgICogV2hldGhlciB0byBleGVjdXRlIHRoZSBjaGFuZ2VzZXQgb3IgbGVhdmUgaXQgaW4gcmV2aWV3LlxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBleGVjdXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGNvbGxlY3Rpb24gb2YgZXh0cmEgcGFyYW1ldGVyc1xuICAgKiAoaW4gYWRkaXRpb24gdG8gdGhvc2UgdXNlZCBmb3IgYXNzZXRzKVxuICAgKiB0byBwYXNzIHRvIHRoZSBkZXBsb3llZCB0ZW1wbGF0ZS5cbiAgICogTm90ZSB0aGF0IHBhcmFtZXRlcnMgd2l0aCBgdW5kZWZpbmVkYCBvciBlbXB0eSB2YWx1ZXMgd2lsbCBiZSBpZ25vcmVkLFxuICAgKiBhbmQgbm90IHBhc3NlZCB0byB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gbm8gYWRkaXRpb25hbCBwYXJhbWV0ZXJzIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSB0ZW1wbGF0ZVxuICAgKi9cbiAgcGFyYW1ldGVycz86IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXG4gIC8qKlxuICAgKiBVc2UgcHJldmlvdXMgdmFsdWVzIGZvciB1bnNwZWNpZmllZCBwYXJhbWV0ZXJzXG4gICAqXG4gICAqIElmIG5vdCBzZXQsIGFsbCBwYXJhbWV0ZXJzIG11c3QgYmUgc3BlY2lmaWVkIGZvciBldmVyeSBkZXBsb3ltZW50LlxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgdXNlUHJldmlvdXNQYXJhbWV0ZXJzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRGlzcGxheSBtb2RlIGZvciBzdGFjayBkZXBsb3ltZW50IHByb2dyZXNzLlxuICAgKlxuICAgKiBAZGVmYXVsdCBTdGFja0FjdGl2aXR5UHJvZ3Jlc3MuQmFyIHN0YWNrIGV2ZW50cyB3aWxsIGJlIGRpc3BsYXllZCBmb3JcbiAgICogICB0aGUgcmVzb3VyY2UgY3VycmVudGx5IGJlaW5nIGRlcGxveWVkLlxuICAgKi9cbiAgcHJvZ3Jlc3M/OiBTdGFja0FjdGl2aXR5UHJvZ3Jlc3M7XG5cbiAgLyoqXG4gICAqIERlcGxveSBldmVuIGlmIHRoZSBkZXBsb3llZCB0ZW1wbGF0ZSBpcyBpZGVudGljYWwgdG8gdGhlIG9uZSB3ZSBhcmUgYWJvdXQgdG8gZGVwbG95LlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZm9yY2U/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHdlIGFyZSBvbiBhIENJIHN5c3RlbVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgY2k/OiBib29sZWFuO1xufVxuXG5jb25zdCBMQVJHRV9URU1QTEFURV9TSVpFX0tCID0gNTA7XG5cbi8qKiBAZXhwZXJpbWVudGFsICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVwbG95U3RhY2sob3B0aW9uczogRGVwbG95U3RhY2tPcHRpb25zKTogUHJvbWlzZTxEZXBsb3lTdGFja1Jlc3VsdD4ge1xuICBjb25zdCBzdGFja0FydGlmYWN0ID0gb3B0aW9ucy5zdGFjaztcblxuICBjb25zdCBzdGFja0VudiA9IG9wdGlvbnMucmVzb2x2ZWRFbnZpcm9ubWVudDtcblxuICBjb25zdCBjZm4gPSBvcHRpb25zLnNkay5jbG91ZEZvcm1hdGlvbigpO1xuICBjb25zdCBkZXBsb3lOYW1lID0gb3B0aW9ucy5kZXBsb3lOYW1lIHx8IHN0YWNrQXJ0aWZhY3Quc3RhY2tOYW1lO1xuICBsZXQgY2xvdWRGb3JtYXRpb25TdGFjayA9IGF3YWl0IENsb3VkRm9ybWF0aW9uU3RhY2subG9va3VwKGNmbiwgZGVwbG95TmFtZSk7XG5cbiAgaWYgKGNsb3VkRm9ybWF0aW9uU3RhY2suc3RhY2tTdGF0dXMuaXNDcmVhdGlvbkZhaWx1cmUpIHtcbiAgICBkZWJ1ZyhgRm91bmQgZXhpc3Rpbmcgc3RhY2sgJHtkZXBsb3lOYW1lfSB0aGF0IGhhZCBwcmV2aW91c2x5IGZhaWxlZCBjcmVhdGlvbi4gRGVsZXRpbmcgaXQgYmVmb3JlIGF0dGVtcHRpbmcgdG8gcmUtY3JlYXRlIGl0LmApO1xuICAgIGF3YWl0IGNmbi5kZWxldGVTdGFjayh7IFN0YWNrTmFtZTogZGVwbG95TmFtZSB9KS5wcm9taXNlKCk7XG4gICAgY29uc3QgZGVsZXRlZFN0YWNrID0gYXdhaXQgd2FpdEZvclN0YWNrRGVsZXRlKGNmbiwgZGVwbG95TmFtZSk7XG4gICAgaWYgKGRlbGV0ZWRTdGFjayAmJiBkZWxldGVkU3RhY2suc3RhY2tTdGF0dXMubmFtZSAhPT0gJ0RFTEVURV9DT01QTEVURScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIGRlbGV0aW5nIHN0YWNrICR7ZGVwbG95TmFtZX0gdGhhdCBoYWQgcHJldmlvdXNseSBmYWlsZWQgY3JlYXRpb24gKGN1cnJlbnQgc3RhdGU6ICR7ZGVsZXRlZFN0YWNrLnN0YWNrU3RhdHVzfSlgKTtcbiAgICB9XG4gICAgLy8gVXBkYXRlIHZhcmlhYmxlIHRvIG1hcmsgdGhhdCB0aGUgc3RhY2sgZG9lcyBub3QgZXhpc3QgYW55bW9yZSwgYnV0IGF2b2lkXG4gICAgLy8gZG9pbmcgYW4gYWN0dWFsIGxvb2t1cCBpbiBDbG91ZEZvcm1hdGlvbiAod2hpY2ggd291bGQgYmUgc2lsbHkgdG8gZG8gaWZcbiAgICAvLyB3ZSBqdXN0IGRlbGV0ZWQgaXQpLlxuICAgIGNsb3VkRm9ybWF0aW9uU3RhY2sgPSBDbG91ZEZvcm1hdGlvblN0YWNrLmRvZXNOb3RFeGlzdChjZm4sIGRlcGxveU5hbWUpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IFwibGVnYWN5XCIgYXNzZXRzICh3aGljaCByZW1haW4gaW4gdGhlIG1ldGFkYXRhKSBhbmQgcHVibGlzaCB0aGVtIHZpYVxuICAvLyBhbiBhZC1ob2MgYXNzZXQgbWFuaWZlc3QsIHdoaWxlIHBhc3NpbmcgdGhlaXIgbG9jYXRpb25zIHZpYSB0ZW1wbGF0ZVxuICAvLyBwYXJhbWV0ZXJzLlxuICBjb25zdCBsZWdhY3lBc3NldHMgPSBuZXcgQXNzZXRNYW5pZmVzdEJ1aWxkZXIoKTtcbiAgY29uc3QgYXNzZXRQYXJhbXMgPSBhd2FpdCBhZGRNZXRhZGF0YUFzc2V0c1RvTWFuaWZlc3Qoc3RhY2tBcnRpZmFjdCwgbGVnYWN5QXNzZXRzLCBvcHRpb25zLnRvb2xraXRJbmZvLCBvcHRpb25zLnJldXNlQXNzZXRzKTtcblxuICBjb25zdCBmaW5hbFBhcmFtZXRlclZhbHVlcyA9IHsgLi4ub3B0aW9ucy5wYXJhbWV0ZXJzLCAuLi5hc3NldFBhcmFtcyB9O1xuXG4gIGNvbnN0IHRlbXBsYXRlUGFyYW1zID0gVGVtcGxhdGVQYXJhbWV0ZXJzLmZyb21UZW1wbGF0ZShzdGFja0FydGlmYWN0LnRlbXBsYXRlKTtcbiAgY29uc3Qgc3RhY2tQYXJhbXMgPSBvcHRpb25zLnVzZVByZXZpb3VzUGFyYW1ldGVyc1xuICAgID8gdGVtcGxhdGVQYXJhbXMudXBkYXRlRXhpc3RpbmcoZmluYWxQYXJhbWV0ZXJWYWx1ZXMsIGNsb3VkRm9ybWF0aW9uU3RhY2sucGFyYW1ldGVycylcbiAgICA6IHRlbXBsYXRlUGFyYW1zLnN1cHBseUFsbChmaW5hbFBhcmFtZXRlclZhbHVlcyk7XG5cbiAgaWYgKGF3YWl0IGNhblNraXBEZXBsb3kob3B0aW9ucywgY2xvdWRGb3JtYXRpb25TdGFjaywgc3RhY2tQYXJhbXMuaGFzQ2hhbmdlcyhjbG91ZEZvcm1hdGlvblN0YWNrLnBhcmFtZXRlcnMpKSkge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiBza2lwcGluZyBkZXBsb3ltZW50ICh1c2UgLS1mb3JjZSB0byBvdmVycmlkZSlgKTtcbiAgICByZXR1cm4ge1xuICAgICAgbm9PcDogdHJ1ZSxcbiAgICAgIG91dHB1dHM6IGNsb3VkRm9ybWF0aW9uU3RhY2sub3V0cHV0cyxcbiAgICAgIHN0YWNrQXJuOiBjbG91ZEZvcm1hdGlvblN0YWNrLnN0YWNrSWQsXG4gICAgICBzdGFja0FydGlmYWN0LFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgZGVidWcoYCR7ZGVwbG95TmFtZX06IGRlcGxveWluZy4uLmApO1xuICB9XG5cbiAgY29uc3QgZXhlY3V0aW9uSWQgPSB1dWlkLnY0KCk7XG4gIGNvbnN0IGJvZHlQYXJhbWV0ZXIgPSBhd2FpdCBtYWtlQm9keVBhcmFtZXRlcihzdGFja0FydGlmYWN0LCBvcHRpb25zLnJlc29sdmVkRW52aXJvbm1lbnQsIGxlZ2FjeUFzc2V0cywgb3B0aW9ucy50b29sa2l0SW5mbyk7XG5cbiAgYXdhaXQgcHVibGlzaEFzc2V0cyhsZWdhY3lBc3NldHMudG9NYW5pZmVzdChzdGFja0FydGlmYWN0LmFzc2VtYmx5LmRpcmVjdG9yeSksIG9wdGlvbnMuc2RrUHJvdmlkZXIsIHN0YWNrRW52KTtcblxuICBjb25zdCBjaGFuZ2VTZXROYW1lID0gYENESy0ke2V4ZWN1dGlvbklkfWA7XG4gIGNvbnN0IHVwZGF0ZSA9IGNsb3VkRm9ybWF0aW9uU3RhY2suZXhpc3RzICYmIGNsb3VkRm9ybWF0aW9uU3RhY2suc3RhY2tTdGF0dXMubmFtZSAhPT0gJ1JFVklFV19JTl9QUk9HUkVTUyc7XG5cbiAgZGVidWcoYEF0dGVtcHRpbmcgdG8gY3JlYXRlIENoYW5nZVNldCAke2NoYW5nZVNldE5hbWV9IHRvICR7dXBkYXRlID8gJ3VwZGF0ZScgOiAnY3JlYXRlJ30gc3RhY2sgJHtkZXBsb3lOYW1lfWApO1xuICBwcmludCgnJXM6IGNyZWF0aW5nIENsb3VkRm9ybWF0aW9uIGNoYW5nZXNldC4uLicsIGNvbG9ycy5ib2xkKGRlcGxveU5hbWUpKTtcbiAgY29uc3QgY2hhbmdlU2V0ID0gYXdhaXQgY2ZuLmNyZWF0ZUNoYW5nZVNldCh7XG4gICAgU3RhY2tOYW1lOiBkZXBsb3lOYW1lLFxuICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gICAgQ2hhbmdlU2V0VHlwZTogdXBkYXRlID8gJ1VQREFURScgOiAnQ1JFQVRFJyxcbiAgICBEZXNjcmlwdGlvbjogYENESyBDaGFuZ2VzZXQgZm9yIGV4ZWN1dGlvbiAke2V4ZWN1dGlvbklkfWAsXG4gICAgVGVtcGxhdGVCb2R5OiBib2R5UGFyYW1ldGVyLlRlbXBsYXRlQm9keSxcbiAgICBUZW1wbGF0ZVVSTDogYm9keVBhcmFtZXRlci5UZW1wbGF0ZVVSTCxcbiAgICBQYXJhbWV0ZXJzOiBzdGFja1BhcmFtcy5hcGlQYXJhbWV0ZXJzLFxuICAgIFJvbGVBUk46IG9wdGlvbnMucm9sZUFybixcbiAgICBOb3RpZmljYXRpb25BUk5zOiBvcHRpb25zLm5vdGlmaWNhdGlvbkFybnMsXG4gICAgQ2FwYWJpbGl0aWVzOiBbJ0NBUEFCSUxJVFlfSUFNJywgJ0NBUEFCSUxJVFlfTkFNRURfSUFNJywgJ0NBUEFCSUxJVFlfQVVUT19FWFBBTkQnXSxcbiAgICBUYWdzOiBvcHRpb25zLnRhZ3MsXG4gIH0pLnByb21pc2UoKTtcbiAgZGVidWcoJ0luaXRpYXRlZCBjcmVhdGlvbiBvZiBjaGFuZ2VzZXQ6ICVzOyB3YWl0aW5nIGZvciBpdCB0byBmaW5pc2ggY3JlYXRpbmcuLi4nLCBjaGFuZ2VTZXQuSWQpO1xuICBjb25zdCBjaGFuZ2VTZXREZXNjcmlwdGlvbiA9IGF3YWl0IHdhaXRGb3JDaGFuZ2VTZXQoY2ZuLCBkZXBsb3lOYW1lLCBjaGFuZ2VTZXROYW1lKTtcblxuICAvLyBVcGRhdGUgdGVybWluYXRpb24gcHJvdGVjdGlvbiBvbmx5IGlmIGl0IGhhcyBjaGFuZ2VkLlxuICBjb25zdCB0ZXJtaW5hdGlvblByb3RlY3Rpb24gPSBzdGFja0FydGlmYWN0LnRlcm1pbmF0aW9uUHJvdGVjdGlvbiA/PyBmYWxzZTtcbiAgaWYgKCEhY2xvdWRGb3JtYXRpb25TdGFjay50ZXJtaW5hdGlvblByb3RlY3Rpb24gIT09IHRlcm1pbmF0aW9uUHJvdGVjdGlvbikge1xuICAgIGRlYnVnKCdVcGRhdGluZyB0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGZyb20gJXMgdG8gJXMgZm9yIHN0YWNrICVzJywgY2xvdWRGb3JtYXRpb25TdGFjay50ZXJtaW5hdGlvblByb3RlY3Rpb24sIHRlcm1pbmF0aW9uUHJvdGVjdGlvbiwgZGVwbG95TmFtZSk7XG4gICAgYXdhaXQgY2ZuLnVwZGF0ZVRlcm1pbmF0aW9uUHJvdGVjdGlvbih7XG4gICAgICBTdGFja05hbWU6IGRlcGxveU5hbWUsXG4gICAgICBFbmFibGVUZXJtaW5hdGlvblByb3RlY3Rpb246IHRlcm1pbmF0aW9uUHJvdGVjdGlvbixcbiAgICB9KS5wcm9taXNlKCk7XG4gICAgZGVidWcoJ1Rlcm1pbmF0aW9uIHByb3RlY3Rpb24gdXBkYXRlZCB0byAlcyBmb3Igc3RhY2sgJXMnLCB0ZXJtaW5hdGlvblByb3RlY3Rpb24sIGRlcGxveU5hbWUpO1xuICB9XG5cbiAgaWYgKGNoYW5nZVNldEhhc05vQ2hhbmdlcyhjaGFuZ2VTZXREZXNjcmlwdGlvbikpIHtcbiAgICBkZWJ1ZygnTm8gY2hhbmdlcyBhcmUgdG8gYmUgcGVyZm9ybWVkIG9uICVzLicsIGRlcGxveU5hbWUpO1xuICAgIGF3YWl0IGNmbi5kZWxldGVDaGFuZ2VTZXQoeyBTdGFja05hbWU6IGRlcGxveU5hbWUsIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUgfSkucHJvbWlzZSgpO1xuICAgIHJldHVybiB7IG5vT3A6IHRydWUsIG91dHB1dHM6IGNsb3VkRm9ybWF0aW9uU3RhY2sub3V0cHV0cywgc3RhY2tBcm46IGNoYW5nZVNldC5TdGFja0lkISwgc3RhY2tBcnRpZmFjdCB9O1xuICB9XG5cbiAgY29uc3QgZXhlY3V0ZSA9IG9wdGlvbnMuZXhlY3V0ZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IG9wdGlvbnMuZXhlY3V0ZTtcbiAgaWYgKGV4ZWN1dGUpIHtcbiAgICBkZWJ1ZygnSW5pdGlhdGluZyBleGVjdXRpb24gb2YgY2hhbmdlc2V0ICVzIG9uIHN0YWNrICVzJywgY2hhbmdlU2V0TmFtZSwgZGVwbG95TmFtZSk7XG4gICAgYXdhaXQgY2ZuLmV4ZWN1dGVDaGFuZ2VTZXQoeyBTdGFja05hbWU6IGRlcGxveU5hbWUsIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUgfSkucHJvbWlzZSgpO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGVuXG4gICAgY29uc3QgbW9uaXRvciA9IG9wdGlvbnMucXVpZXQgPyB1bmRlZmluZWQgOiBTdGFja0FjdGl2aXR5TW9uaXRvci53aXRoRGVmYXVsdFByaW50ZXIoY2ZuLCBkZXBsb3lOYW1lLCBzdGFja0FydGlmYWN0LCB7XG4gICAgICByZXNvdXJjZXNUb3RhbDogKGNoYW5nZVNldERlc2NyaXB0aW9uLkNoYW5nZXMgPz8gW10pLmxlbmd0aCxcbiAgICAgIHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzLFxuICAgICAgY2hhbmdlU2V0Q3JlYXRpb25UaW1lOiBjaGFuZ2VTZXREZXNjcmlwdGlvbi5DcmVhdGlvblRpbWUsXG4gICAgfSkuc3RhcnQoKTtcbiAgICBkZWJ1ZygnRXhlY3V0aW9uIG9mIGNoYW5nZXNldCAlcyBvbiBzdGFjayAlcyBoYXMgc3RhcnRlZDsgd2FpdGluZyBmb3IgdGhlIHVwZGF0ZSB0byBjb21wbGV0ZS4uLicsIGNoYW5nZVNldE5hbWUsIGRlcGxveU5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBmaW5hbFN0YWNrID0gYXdhaXQgd2FpdEZvclN0YWNrRGVwbG95KGNmbiwgZGVwbG95TmFtZSk7XG5cbiAgICAgIC8vIFRoaXMgc2hvdWxkbid0IHJlYWxseSBoYXBwZW4sIGJ1dCBjYXRjaCBpdCBhbnl3YXkuIFlvdSBuZXZlciBrbm93LlxuICAgICAgaWYgKCFmaW5hbFN0YWNrKSB7IHRocm93IG5ldyBFcnJvcignU3RhY2sgZGVwbG95IGZhaWxlZCAodGhlIHN0YWNrIGRpc2FwcGVhcmVkIHdoaWxlIHdlIHdlcmUgZGVwbG95aW5nIGl0KScpOyB9XG4gICAgICBjbG91ZEZvcm1hdGlvblN0YWNrID0gZmluYWxTdGFjaztcbiAgICB9IGZpbmFsbHkge1xuICAgICAgYXdhaXQgbW9uaXRvcj8uc3RvcCgpO1xuICAgIH1cbiAgICBkZWJ1ZygnU3RhY2sgJXMgaGFzIGNvbXBsZXRlZCB1cGRhdGluZycsIGRlcGxveU5hbWUpO1xuICB9IGVsc2Uge1xuICAgIHByaW50KCdDaGFuZ2VzZXQgJXMgY3JlYXRlZCBhbmQgd2FpdGluZyBpbiByZXZpZXcgZm9yIG1hbnVhbCBleGVjdXRpb24gKC0tbm8tZXhlY3V0ZSknLCBjaGFuZ2VTZXROYW1lKTtcbiAgfVxuXG4gIHJldHVybiB7IG5vT3A6IGZhbHNlLCBvdXRwdXRzOiBjbG91ZEZvcm1hdGlvblN0YWNrLm91dHB1dHMsIHN0YWNrQXJuOiBjaGFuZ2VTZXQuU3RhY2tJZCEsIHN0YWNrQXJ0aWZhY3QgfTtcbn1cblxuLyoqXG4gKiBQcmVwYXJlcyB0aGUgYm9keSBwYXJhbWV0ZXIgZm9yICtDcmVhdGVDaGFuZ2VTZXQrLlxuICpcbiAqIElmIHRoZSB0ZW1wbGF0ZSBpcyBzbWFsbCBlbm91Z2ggdG8gYmUgaW5saW5lZCBpbnRvIHRoZSBBUEkgY2FsbCwganVzdCByZXR1cm5cbiAqIGl0IGltbWVkaWF0ZWx5LlxuICpcbiAqIE90aGVyd2lzZSwgYWRkIGl0IHRvIHRoZSBhc3NldCBtYW5pZmVzdCB0byBnZXQgdXBsb2FkZWQgdG8gdGhlIHN0YWdpbmdcbiAqIGJ1Y2tldCBhbmQgcmV0dXJuIGl0cyBjb29yZGluYXRlcy4gSWYgdGhlcmUgaXMgbm8gc3RhZ2luZyBidWNrZXQsIGFuIGVycm9yXG4gKiBpcyB0aHJvd24uXG4gKlxuICogQHBhcmFtIHN0YWNrICAgICB0aGUgc3ludGhlc2l6ZWQgc3RhY2sgdGhhdCBwcm92aWRlcyB0aGUgQ2xvdWRGb3JtYXRpb24gdGVtcGxhdGVcbiAqIEBwYXJhbSB0b29sa2l0SW5mbyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgdG9vbGtpdCBzdGFja1xuICovXG5hc3luYyBmdW5jdGlvbiBtYWtlQm9keVBhcmFtZXRlcihcbiAgc3RhY2s6IGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdCxcbiAgcmVzb2x2ZWRFbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsXG4gIGFzc2V0TWFuaWZlc3Q6IEFzc2V0TWFuaWZlc3RCdWlsZGVyLFxuICB0b29sa2l0SW5mbz86IFRvb2xraXRSZXNvdXJjZXNJbmZvKTogUHJvbWlzZTxUZW1wbGF0ZUJvZHlQYXJhbWV0ZXI+IHtcblxuICAvLyBJZiB0aGUgdGVtcGxhdGUgaGFzIGFscmVhZHkgYmVlbiB1cGxvYWRlZCB0byBTMywganVzdCB1c2UgaXQgZnJvbSB0aGVyZS5cbiAgaWYgKHN0YWNrLnN0YWNrVGVtcGxhdGVBc3NldE9iamVjdFVybCkge1xuICAgIHJldHVybiB7IFRlbXBsYXRlVVJMOiByZXN0VXJsRnJvbU1hbmlmZXN0KHN0YWNrLnN0YWNrVGVtcGxhdGVBc3NldE9iamVjdFVybCwgcmVzb2x2ZWRFbnZpcm9ubWVudCkgfTtcbiAgfVxuXG4gIC8vIE90aGVyd2lzZSwgcGFzcyB2aWEgQVBJIGNhbGwgKGlmIHNtYWxsKSBvciB1cGxvYWQgaGVyZSAoaWYgbGFyZ2UpXG4gIGNvbnN0IHRlbXBsYXRlSnNvbiA9IHRvWUFNTChzdGFjay50ZW1wbGF0ZSk7XG5cbiAgaWYgKHRlbXBsYXRlSnNvbi5sZW5ndGggPD0gTEFSR0VfVEVNUExBVEVfU0laRV9LQiAqIDEwMjQpIHtcbiAgICByZXR1cm4geyBUZW1wbGF0ZUJvZHk6IHRlbXBsYXRlSnNvbiB9O1xuICB9XG5cbiAgaWYgKCF0b29sa2l0SW5mbykge1xuICAgIGVycm9yKFxuICAgICAgYFRoZSB0ZW1wbGF0ZSBmb3Igc3RhY2sgXCIke3N0YWNrLmRpc3BsYXlOYW1lfVwiIGlzICR7TWF0aC5yb3VuZCh0ZW1wbGF0ZUpzb24ubGVuZ3RoIC8gMTAyNCl9S2lCLiBgICtcbiAgICAgIGBUZW1wbGF0ZXMgbGFyZ2VyIHRoYW4gJHtMQVJHRV9URU1QTEFURV9TSVpFX0tCfUtpQiBtdXN0IGJlIHVwbG9hZGVkIHRvIFMzLlxcbmAgK1xuICAgICAgJ1J1biB0aGUgZm9sbG93aW5nIGNvbW1hbmQgaW4gb3JkZXIgdG8gc2V0dXAgYW4gUzMgYnVja2V0IGluIHRoaXMgZW52aXJvbm1lbnQsIGFuZCB0aGVuIHJlLWRlcGxveTpcXG5cXG4nLFxuICAgICAgY29sb3JzLmJsdWUoYFxcdCQgY2RrIGJvb3RzdHJhcCAke3Jlc29sdmVkRW52aXJvbm1lbnQubmFtZX1cXG5gKSk7XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RlbXBsYXRlIHRvbyBsYXJnZSB0byBkZXBsb3kgKFwiY2RrIGJvb3RzdHJhcFwiIGlzIHJlcXVpcmVkKScpO1xuICB9XG5cbiAgY29uc3QgdGVtcGxhdGVIYXNoID0gY29udGVudEhhc2godGVtcGxhdGVKc29uKTtcbiAgY29uc3Qga2V5ID0gYGNkay8ke3N0YWNrLmlkfS8ke3RlbXBsYXRlSGFzaH0ueW1sYDtcblxuICBhc3NldE1hbmlmZXN0LmFkZEZpbGVBc3NldCh0ZW1wbGF0ZUhhc2gsIHtcbiAgICBwYXRoOiBzdGFjay50ZW1wbGF0ZUZpbGUsXG4gIH0sIHtcbiAgICBidWNrZXROYW1lOiB0b29sa2l0SW5mby5idWNrZXROYW1lLFxuICAgIG9iamVjdEtleToga2V5LFxuICB9KTtcblxuICBjb25zdCB0ZW1wbGF0ZVVSTCA9IGAke3Rvb2xraXRJbmZvLmJ1Y2tldFVybH0vJHtrZXl9YDtcbiAgZGVidWcoJ1N0b3JpbmcgdGVtcGxhdGUgaW4gUzMgYXQ6JywgdGVtcGxhdGVVUkwpO1xuICByZXR1cm4geyBUZW1wbGF0ZVVSTDogdGVtcGxhdGVVUkwgfTtcbn1cblxuLyoqIEBleHBlcmltZW50YWwgKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVzdHJveVN0YWNrT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgc3RhY2sgdG8gYmUgZGVzdHJveWVkXG4gICAqL1xuICBzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0O1xuXG4gIHNkazogSVNESztcbiAgcm9sZUFybj86IHN0cmluZztcbiAgZGVwbG95TmFtZT86IHN0cmluZztcbiAgcXVpZXQ/OiBib29sZWFuO1xufVxuXG4vKiogQGV4cGVyaW1lbnRhbCAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlc3Ryb3lTdGFjayhvcHRpb25zOiBEZXN0cm95U3RhY2tPcHRpb25zKSB7XG4gIGNvbnN0IGRlcGxveU5hbWUgPSBvcHRpb25zLmRlcGxveU5hbWUgfHwgb3B0aW9ucy5zdGFjay5zdGFja05hbWU7XG4gIGNvbnN0IGNmbiA9IG9wdGlvbnMuc2RrLmNsb3VkRm9ybWF0aW9uKCk7XG5cbiAgY29uc3QgY3VycmVudFN0YWNrID0gYXdhaXQgQ2xvdWRGb3JtYXRpb25TdGFjay5sb29rdXAoY2ZuLCBkZXBsb3lOYW1lKTtcbiAgaWYgKCFjdXJyZW50U3RhY2suZXhpc3RzKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IG1vbml0b3IgPSBvcHRpb25zLnF1aWV0ID8gdW5kZWZpbmVkIDogU3RhY2tBY3Rpdml0eU1vbml0b3Iud2l0aERlZmF1bHRQcmludGVyKGNmbiwgZGVwbG95TmFtZSwgb3B0aW9ucy5zdGFjaykuc3RhcnQoKTtcblxuICB0cnkge1xuICAgIGF3YWl0IGNmbi5kZWxldGVTdGFjayh7IFN0YWNrTmFtZTogZGVwbG95TmFtZSwgUm9sZUFSTjogb3B0aW9ucy5yb2xlQXJuIH0pLnByb21pc2UoKTtcbiAgICBjb25zdCBkZXN0cm95ZWRTdGFjayA9IGF3YWl0IHdhaXRGb3JTdGFja0RlbGV0ZShjZm4sIGRlcGxveU5hbWUpO1xuICAgIGlmIChkZXN0cm95ZWRTdGFjayAmJiBkZXN0cm95ZWRTdGFjay5zdGFja1N0YXR1cy5uYW1lICE9PSAnREVMRVRFX0NPTVBMRVRFJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZGVzdHJveSAke2RlcGxveU5hbWV9OiAke2Rlc3Ryb3llZFN0YWNrLnN0YWNrU3RhdHVzfWApO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAobW9uaXRvcikgeyBhd2FpdCBtb25pdG9yLnN0b3AoKTsgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgd2UgY2FuIHNraXAgZGVwbG95bWVudFxuICpcbiAqIFdlIGRvIHRoaXMgaW4gYSBjb21wbGljYXRlZCB3YXkgYnkgcHJlcHJvY2Vzc2luZyAoaW5zdGVhZCBvZiBqdXN0XG4gKiBsb29raW5nIGF0IHRoZSBjaGFuZ2VzZXQpLCBiZWNhdXNlIGlmIHRoZXJlIGFyZSBuZXN0ZWQgc3RhY2tzIGludm9sdmVkXG4gKiB0aGUgY2hhbmdlc2V0IHdpbGwgYWx3YXlzIHNob3cgdGhlIG5lc3RlZCBzdGFja3MgYXMgbmVlZGluZyB0byBiZVxuICogdXBkYXRlZCwgYW5kIHRoZSBkZXBsb3ltZW50IHdpbGwgdGFrZSBhIGxvbmcgdGltZSB0byBpbiBlZmZlY3Qgbm90XG4gKiBkbyBhbnl0aGluZy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY2FuU2tpcERlcGxveShcbiAgZGVwbG95U3RhY2tPcHRpb25zOiBEZXBsb3lTdGFja09wdGlvbnMsXG4gIGNsb3VkRm9ybWF0aW9uU3RhY2s6IENsb3VkRm9ybWF0aW9uU3RhY2ssXG4gIHBhcmFtZXRlckNoYW5nZXM6IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuICBjb25zdCBkZXBsb3lOYW1lID0gZGVwbG95U3RhY2tPcHRpb25zLmRlcGxveU5hbWUgfHwgZGVwbG95U3RhY2tPcHRpb25zLnN0YWNrLnN0YWNrTmFtZTtcbiAgZGVidWcoYCR7ZGVwbG95TmFtZX06IGNoZWNraW5nIGlmIHdlIGNhbiBza2lwIGRlcGxveWApO1xuXG4gIC8vIEZvcmNlZCBkZXBsb3lcbiAgaWYgKGRlcGxveVN0YWNrT3B0aW9ucy5mb3JjZSkge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiBmb3JjZWQgZGVwbG95bWVudGApO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIE5vIGV4aXN0aW5nIHN0YWNrXG4gIGlmICghY2xvdWRGb3JtYXRpb25TdGFjay5leGlzdHMpIHtcbiAgICBkZWJ1ZyhgJHtkZXBsb3lOYW1lfTogbm8gZXhpc3Rpbmcgc3RhY2tgKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBUZW1wbGF0ZSBoYXMgY2hhbmdlZCAoYXNzZXRzIHRha2VuIGludG8gYWNjb3VudCBoZXJlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoZGVwbG95U3RhY2tPcHRpb25zLnN0YWNrLnRlbXBsYXRlKSAhPT0gSlNPTi5zdHJpbmdpZnkoYXdhaXQgY2xvdWRGb3JtYXRpb25TdGFjay50ZW1wbGF0ZSgpKSkge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiB0ZW1wbGF0ZSBoYXMgY2hhbmdlZGApO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFRhZ3MgaGF2ZSBjaGFuZ2VkXG4gIGlmICghY29tcGFyZVRhZ3MoY2xvdWRGb3JtYXRpb25TdGFjay50YWdzLCBkZXBsb3lTdGFja09wdGlvbnMudGFncyA/PyBbXSkpIHtcbiAgICBkZWJ1ZyhgJHtkZXBsb3lOYW1lfTogdGFncyBoYXZlIGNoYW5nZWRgKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBUZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGhhcyBiZWVuIHVwZGF0ZWRcbiAgaWYgKCEhZGVwbG95U3RhY2tPcHRpb25zLnN0YWNrLnRlcm1pbmF0aW9uUHJvdGVjdGlvbiAhPT0gISFjbG91ZEZvcm1hdGlvblN0YWNrLnRlcm1pbmF0aW9uUHJvdGVjdGlvbikge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiB0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGhhcyBiZWVuIHVwZGF0ZWRgKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBQYXJhbWV0ZXJzIGhhdmUgY2hhbmdlZFxuICBpZiAocGFyYW1ldGVyQ2hhbmdlcykge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiBwYXJhbWV0ZXJzIGhhdmUgY2hhbmdlZGApO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEV4aXN0aW5nIHN0YWNrIGlzIGluIGEgZmFpbGVkIHN0YXRlXG4gIGlmIChjbG91ZEZvcm1hdGlvblN0YWNrLnN0YWNrU3RhdHVzLmlzRmFpbHVyZSkge1xuICAgIGRlYnVnKGAke2RlcGxveU5hbWV9OiBzdGFjayBpcyBpbiBhIGZhaWx1cmUgc3RhdGVgKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBXZSBjYW4gc2tpcCBkZXBsb3lcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogQ29tcGFyZXMgdHdvIGxpc3Qgb2YgdGFncywgcmV0dXJucyB0cnVlIGlmIGlkZW50aWNhbC5cbiAqL1xuZnVuY3Rpb24gY29tcGFyZVRhZ3MoYTogVGFnW10sIGI6IFRhZ1tdKTogYm9vbGVhbiB7XG4gIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmb3IgKGNvbnN0IGFUYWcgb2YgYSkge1xuICAgIGNvbnN0IGJUYWcgPSBiLmZpbmQodGFnID0+IHRhZy5LZXkgPT09IGFUYWcuS2V5KTtcblxuICAgIGlmICghYlRhZyB8fCBiVGFnLlZhbHVlICE9PSBhVGFnLlZhbHVlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogRm9ybWF0IGFuIFMzIFVSTCBpbiB0aGUgbWFuaWZlc3QgZm9yIHVzZSB3aXRoIENsb3VkRm9ybWF0aW9uXG4gKlxuICogUmVwbGFjZXMgZW52aXJvbm1lbnQgcGxhY2Vob2xkZXJzICh3aGljaCB0aGlzIGZpZWxkIG1heSBjb250YWluKSxcbiAqIGFuZCByZWZvcm1hdHMgczM6Ly8uLi4vLi4uIHVybHMgaW50byBTMyBSRVNUIFVSTHMgKHdoaWNoIENsb3VkRm9ybWF0aW9uXG4gKiBleHBlY3RzKVxuICovXG5mdW5jdGlvbiByZXN0VXJsRnJvbU1hbmlmZXN0KHVybDogc3RyaW5nLCBlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBkb05vdFVzZU1hcmtlciA9ICcqKkRPTk9UVVNFKionO1xuICAvLyBUaGlzIFVSTCBtYXkgY29udGFpbiBwbGFjZWhvbGRlcnMsIHNvIHN0aWxsIHN1YnN0aXR1dGUgdGhvc2UuXG4gIHVybCA9IGN4YXBpLkVudmlyb25tZW50UGxhY2Vob2xkZXJzLnJlcGxhY2UodXJsLCB7XG4gICAgYWNjb3VudElkOiBlbnZpcm9ubWVudC5hY2NvdW50LFxuICAgIHJlZ2lvbjogZW52aXJvbm1lbnQucmVnaW9uLFxuICAgIHBhcnRpdGlvbjogZG9Ob3RVc2VNYXJrZXIsXG4gIH0pO1xuXG4gIC8vIFllcywgdGhpcyBpcyBleHRyZW1lbHkgY3J1ZGUsIGJ1dCB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIHRoaXMgc28gSSdtIG5vdCBpbmNsaW5lZCB0byBzcGVuZFxuICAvLyBhIGxvdCBvZiBlZmZvcnQgdHJ5aW5nIHRvIHRocmVhZCB0aGUgcmlnaHQgdmFsdWUgdG8gdGhpcyBsb2NhdGlvbi5cbiAgaWYgKHVybC5pbmRleE9mKGRvTm90VXNlTWFya2VyKSA+IC0xKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdXNlIFxcJyR7QVdTOjpQYXJ0aXRpb259XFwnIGluIHRoZSBcXCdzdGFja1RlbXBsYXRlQXNzZXRPYmplY3RVcmxcXCcgZmllbGQnKTtcbiAgfVxuXG4gIGNvbnN0IHMzVXJsID0gdXJsLm1hdGNoKC9zMzpcXC9cXC8oW14vXSspXFwvKC4qKSQvKTtcbiAgaWYgKCFzM1VybCkgeyByZXR1cm4gdXJsOyB9XG5cbiAgLy8gV2UgbmVlZCB0byBwYXNzIGFuICdodHRwczovL3MzLlJFR0lPTi5hbWF6b25hd3MuY29tWy5jbl0vYnVja2V0L29iamVjdCcgVVJMIHRvIENsb3VkRm9ybWF0aW9uLCBidXQgd2VcbiAgLy8gZ290IGFuICdzMzovL2J1Y2tldC9vYmplY3QnIFVSTCBpbnN0ZWFkLiBDb25zdHJ1Y3QgdGhlIHJlc3QgQVBJIFVSTCBoZXJlLlxuICBjb25zdCBidWNrZXROYW1lID0gczNVcmxbMV07XG4gIGNvbnN0IG9iamVjdEtleSA9IHMzVXJsWzJdO1xuXG4gIGNvbnN0IHVybFN1ZmZpeDogc3RyaW5nID0gcmVnaW9uVXRpbC5nZXRFbmRwb2ludFN1ZmZpeChlbnZpcm9ubWVudC5yZWdpb24pO1xuICByZXR1cm4gYGh0dHBzOi8vczMuJHtlbnZpcm9ubWVudC5yZWdpb259LiR7dXJsU3VmZml4fS8ke2J1Y2tldE5hbWV9LyR7b2JqZWN0S2V5fWA7XG59Il19