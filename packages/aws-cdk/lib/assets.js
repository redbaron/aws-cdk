"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMetadataAssetsToManifest = void 0;
// eslint-disable-next-line max-len
const path = require("path");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const colors = require("colors");
const logging_1 = require("./logging");
/**
 * Take the metadata assets from the given stack and add them to the given asset manifest
 *
 * Returns the CloudFormation parameters that need to be sent to the template to
 * pass Asset coordinates.
 */
// eslint-disable-next-line max-len
async function addMetadataAssetsToManifest(stack, assetManifest, toolkitInfo, reuse) {
    reuse = reuse || [];
    const assets = stack.assets;
    if (assets.length === 0) {
        return {};
    }
    if (!toolkitInfo) {
        // eslint-disable-next-line max-len
        throw new Error(`This stack uses assets, so the toolkit stack must be deployed to the environment (Run "${colors.blue('cdk bootstrap ' + stack.environment.name)}")`);
    }
    const params = {};
    for (const asset of assets) {
        // FIXME: Should have excluded by construct path here instead of by unique ID, preferably using
        // minimatch so we can support globs. Maybe take up during artifact refactoring.
        const reuseAsset = reuse.indexOf(asset.id) > -1;
        if (reuseAsset) {
            logging_1.debug(`Reusing asset ${asset.id}: ${JSON.stringify(asset)}`);
            continue;
        }
        logging_1.debug(`Preparing asset ${asset.id}: ${JSON.stringify(asset)}`);
        if (!stack.assembly) {
            throw new Error('Unexpected: stack assembly is required in order to find assets in assemly directory');
        }
        Object.assign(params, await prepareAsset(asset, assetManifest, toolkitInfo));
    }
    return params;
}
exports.addMetadataAssetsToManifest = addMetadataAssetsToManifest;
// eslint-disable-next-line max-len
async function prepareAsset(asset, assetManifest, toolkitInfo) {
    switch (asset.packaging) {
        case 'zip':
        case 'file':
            return prepareFileAsset(asset, assetManifest, toolkitInfo, asset.packaging === 'zip' ? cxschema.FileAssetPackaging.ZIP_DIRECTORY : cxschema.FileAssetPackaging.FILE);
        case 'container-image':
            return prepareDockerImageAsset(asset, assetManifest, toolkitInfo);
        default:
            // eslint-disable-next-line max-len
            throw new Error(`Unsupported packaging type: ${asset.packaging}. You might need to upgrade your aws-cdk toolkit to support this asset type.`);
    }
}
function prepareFileAsset(asset, assetManifest, toolkitInfo, packaging) {
    const extension = packaging === cxschema.FileAssetPackaging.ZIP_DIRECTORY ? '.zip' : path.extname(asset.path);
    const baseName = `${asset.sourceHash}${extension}`;
    // Simplify key: assets/abcdef/abcdef.zip is kinda silly and unnecessary, so if they're the same just pick one component.
    const s3Prefix = asset.id === asset.sourceHash ? 'assets/' : `assets/${asset.id}/`;
    const key = `${s3Prefix}${baseName}`;
    const s3url = `s3://${toolkitInfo.bucketName}/${key}`;
    logging_1.debug(`Storing asset ${asset.path} at ${s3url}`);
    assetManifest.addFileAsset(asset.sourceHash, {
        path: asset.path,
        packaging,
    }, {
        bucketName: toolkitInfo.bucketName,
        objectKey: key,
    });
    return {
        [asset.s3BucketParameter]: toolkitInfo.bucketName,
        [asset.s3KeyParameter]: `${s3Prefix}${cxapi.ASSET_PREFIX_SEPARATOR}${baseName}`,
        [asset.artifactHashParameter]: asset.sourceHash,
    };
}
async function prepareDockerImageAsset(asset, assetManifest, toolkitInfo) {
    var _a, _b;
    // Pre-1.21.0, repositoryName can be specified by the user or can be left out, in which case we make
    // a per-asset repository which will get adopted and cleaned up along with the stack.
    // Post-1.21.0, repositoryName will always be specified and it will be a shared repository between
    // all assets, and asset will have imageTag specified as well. Validate the combination.
    if (!asset.imageNameParameter && (!asset.repositoryName || !asset.imageTag)) {
        throw new Error('Invalid Docker image asset configuration: "repositoryName" and "imageTag" are required when "imageNameParameter" is left out');
    }
    const repositoryName = (_a = asset.repositoryName) !== null && _a !== void 0 ? _a : 'cdk/' + asset.id.replace(/[:/]/g, '-').toLowerCase();
    // Make sure the repository exists, since the 'cdk-assets' tool will not create it for us.
    const { repositoryUri } = await toolkitInfo.prepareEcrRepository(repositoryName);
    const imageTag = (_b = asset.imageTag) !== null && _b !== void 0 ? _b : asset.sourceHash;
    assetManifest.addDockerImageAsset(asset.sourceHash, {
        directory: asset.path,
        dockerBuildArgs: asset.buildArgs,
        dockerBuildTarget: asset.target,
        dockerFile: asset.file,
    }, {
        repositoryName,
        imageTag,
    });
    if (!asset.imageNameParameter) {
        return {};
    }
    return { [asset.imageNameParameter]: `${repositoryUri}:${imageTag}` };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXNzZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyw2QkFBNkI7QUFDN0IsMkRBQTJEO0FBQzNELHlDQUF5QztBQUN6QyxpQ0FBaUM7QUFFakMsdUNBQWtDO0FBR2xDOzs7OztHQUtHO0FBQ0gsbUNBQW1DO0FBQzVCLEtBQUssVUFBVSwyQkFBMkIsQ0FBQyxLQUF3QyxFQUFFLGFBQW1DLEVBQUUsV0FBa0MsRUFBRSxLQUFnQjtJQUNuTCxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQztJQUNwQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBRTVCLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDdkIsT0FBTyxFQUFFLENBQUM7S0FDWDtJQUVELElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsbUNBQW1DO1FBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMsMEZBQTBGLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLFdBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDeEs7SUFFRCxNQUFNLE1BQU0sR0FBMkIsRUFBRSxDQUFDO0lBRTFDLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1FBQzFCLCtGQUErRjtRQUMvRixnRkFBZ0Y7UUFDaEYsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFaEQsSUFBSSxVQUFVLEVBQUU7WUFDZCxlQUFLLENBQUMsaUJBQWlCLEtBQUssQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0QsU0FBUztTQUNWO1FBRUQsZUFBSyxDQUFDLG1CQUFtQixLQUFLLENBQUMsRUFB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Q3JGLGtHQUFrRztJQUNsRyx3RkFBd0Y7SUFDeEYsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUMzRSxNQUFNLElBQUksS0FBSyxDQUFDLDhIQUE4SCxDQUFDLENBQUM7S0FDako7SUFFRCxNQUFNLGNBQWMsU0FBRyxLQUFLLENBQUMsY0FBYyxtQ0FBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRXJHLDBGQUEwRjtJQUMxRixNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsTUFBTSxXQUFXLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDakYsTUFBTSxRQUFRLFNBQUcsS0FBSyxDQUFDLFFBQVEsbUNBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUVwRCxhQUFhLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRTtRQUNsRCxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUk7UUFDckIsZUFBZSxFQUFFLEtBQUssQ0FBQyxTQUFTO1FBQ2hDLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxNQUFNO1FBQy9CLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSTtLQUN2QixFQUFFO1FBQ0QsY0FBYztRQUNkLFFBQVE7S0FDVCxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixFQUFFO1FBQUUsT0FBTyxFQUFFLENBQUM7S0FBRTtJQUM3QyxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsRUFBRSxHQUFHLGFBQWEsSUFBSSxRQUFRLEVBQUUsRUFBRSxDQUFDO0FBQ3hFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGN4c2NoZW1hIGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9ycyc7XG5pbXBvcnQgeyBUb29sa2l0UmVzb3VyY2VzSW5mbyB9IGZyb20gJy4vYXBpL3Rvb2xraXQtaW5mbyc7XG5pbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4vbG9nZ2luZyc7XG5pbXBvcnQgeyBBc3NldE1hbmlmZXN0QnVpbGRlciB9IGZyb20gJy4vdXRpbC9hc3NldC1tYW5pZmVzdC1idWlsZGVyJztcblxuLyoqXG4gKiBUYWtlIHRoZSBtZXRhZGF0YSBhc3NldHMgZnJvbSB0aGUgZ2l2ZW4gc3RhY2sgYW5kIGFkZCB0aGVtIHRvIHRoZSBnaXZlbiBhc3NldCBtYW5pZmVzdFxuICpcbiAqIFJldHVybnMgdGhlIENsb3VkRm9ybWF0aW9uIHBhcmFtZXRlcnMgdGhhdCBuZWVkIHRvIGJlIHNlbnQgdG8gdGhlIHRlbXBsYXRlIHRvXG4gKiBwYXNzIEFzc2V0IGNvb3JkaW5hdGVzLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZE1ldGFkYXRhQXNzZXRzVG9NYW5pZmVzdChzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0LCBhc3NldE1hbmlmZXN0OiBBc3NldE1hbmlmZXN0QnVpbGRlciwgdG9vbGtpdEluZm8/OiBUb29sa2l0UmVzb3VyY2VzSW5mbywgcmV1c2U/OiBzdHJpbmdbXSk6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICByZXVzZSA9IHJldXNlIHx8IFtdO1xuICBjb25zdCBhc3NldHMgPSBzdGFjay5hc3NldHM7XG5cbiAgaWYgKGFzc2V0cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4ge307XG4gIH1cblxuICBpZiAoIXRvb2xraXRJbmZvKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1sZW5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgc3RhY2sgdXNlcyBhc3NldHMsIHNvIHRoZSB0b29sa2l0IHN0YWNrIG11c3QgYmUgZGVwbG95ZWQgdG8gdGhlIGVudmlyb25tZW50IChSdW4gXCIke2NvbG9ycy5ibHVlKCdjZGsgYm9vdHN0cmFwICcgKyBzdGFjay5lbnZpcm9ubWVudCEubmFtZSl9XCIpYCk7XG4gIH1cblxuICBjb25zdCBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cykge1xuICAgIC8vIEZJWE1FOiBTaG91bGQgaGF2ZSBleGNsdWRlZCBieSBjb25zdHJ1Y3QgcGF0aCBoZXJlIGluc3RlYWQgb2YgYnkgdW5pcXVlIElELCBwcmVmZXJhYmx5IHVzaW5nXG4gICAgLy8gbWluaW1hdGNoIHNvIHdlIGNhbiBzdXBwb3J0IGdsb2JzLiBNYXliZSB0YWtlIHVwIGR1cmluZyBhcnRpZmFjdCByZWZhY3RvcmluZy5cbiAgICBjb25zdCByZXVzZUFzc2V0ID0gcmV1c2UuaW5kZXhPZihhc3NldC5pZCkgPiAtMTtcblxuICAgIGlmIChyZXVzZUFzc2V0KSB7XG4gICAgICBkZWJ1ZyhgUmV1c2luZyBhc3NldCAke2Fzc2V0LmlkfTogJHtKU09OLnN0cmluZ2lmeShhc3NldCl9YCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBkZWJ1ZyhgUHJlcGFyaW5nIGFzc2V0ICR7YXNzZXQuaWR9OiAke0pTT04uc3RyaW5naWZ5KGFzc2V0KX1gKTtcbiAgICBpZiAoIXN0YWNrLmFzc2VtYmx5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQ6IHN0YWNrIGFzc2VtYmx5IGlzIHJlcXVpcmVkIGluIG9yZGVyIHRvIGZpbmQgYXNzZXRzIGluIGFzc2VtbHkgZGlyZWN0b3J5Jyk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmFzc2lnbihwYXJhbXMsIGF3YWl0IHByZXBhcmVBc3NldChhc3NldCwgYXNzZXRNYW5pZmVzdCwgdG9vbGtpdEluZm8pKTtcbiAgfVxuXG4gIHJldHVybiBwYXJhbXM7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGVuXG5hc3luYyBmdW5jdGlvbiBwcmVwYXJlQXNzZXQoYXNzZXQ6IGN4c2NoZW1hLkFzc2V0TWV0YWRhdGFFbnRyeSwgYXNzZXRNYW5pZmVzdDogQXNzZXRNYW5pZmVzdEJ1aWxkZXIsIHRvb2xraXRJbmZvOiBUb29sa2l0UmVzb3VyY2VzSW5mbyk6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICBzd2l0Y2ggKGFzc2V0LnBhY2thZ2luZykge1xuICAgIGNhc2UgJ3ppcCc6XG4gICAgY2FzZSAnZmlsZSc6XG4gICAgICByZXR1cm4gcHJlcGFyZUZpbGVBc3NldChcbiAgICAgICAgYXNzZXQsXG4gICAgICAgIGFzc2V0TWFuaWZlc3QsXG4gICAgICAgIHRvb2xraXRJbmZvLFxuICAgICAgICBhc3NldC5wYWNrYWdpbmcgPT09ICd6aXAnID8gY3hzY2hlbWEuRmlsZUFzc2V0UGFja2FnaW5nLlpJUF9ESVJFQ1RPUlkgOiBjeHNjaGVtYS5GaWxlQXNzZXRQYWNrYWdpbmcuRklMRSk7XG4gICAgY2FzZSAnY29udGFpbmVyLWltYWdlJzpcbiAgICAgIHJldHVybiBwcmVwYXJlRG9ja2VySW1hZ2VBc3NldChhc3NldCwgYXNzZXRNYW5pZmVzdCwgdG9vbGtpdEluZm8pO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwYWNrYWdpbmcgdHlwZTogJHsoYXNzZXQgYXMgYW55KS5wYWNrYWdpbmd9LiBZb3UgbWlnaHQgbmVlZCB0byB1cGdyYWRlIHlvdXIgYXdzLWNkayB0b29sa2l0IHRvIHN1cHBvcnQgdGhpcyBhc3NldCB0eXBlLmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVGaWxlQXNzZXQoXG4gIGFzc2V0OiBjeHNjaGVtYS5GaWxlQXNzZXRNZXRhZGF0YUVudHJ5LFxuICBhc3NldE1hbmlmZXN0OiBBc3NldE1hbmlmZXN0QnVpbGRlcixcbiAgdG9vbGtpdEluZm86IFRvb2xraXRSZXNvdXJjZXNJbmZvLFxuICBwYWNrYWdpbmc6IGN4c2NoZW1hLkZpbGVBc3NldFBhY2thZ2luZyk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuXG4gIGNvbnN0IGV4dGVuc2lvbiA9IHBhY2thZ2luZyA9PT0gY3hzY2hlbWEuRmlsZUFzc2V0UGFja2FnaW5nLlpJUF9ESVJFQ1RPUlkgPyAnLnppcCcgOiBwYXRoLmV4dG5hbWUoYXNzZXQucGF0aCk7XG4gIGNvbnN0IGJhc2VOYW1lID0gYCR7YXNzZXQuc291cmNlSGFzaH0ke2V4dGVuc2lvbn1gO1xuICAvLyBTaW1wbGlmeSBrZXk6IGFzc2V0cy9hYmNkZWYvYWJjZGVmLnppcCBpcyBraW5kYSBzaWxseSBhbmQgdW5uZWNlc3NhcnksIHNvIGlmIHRoZXkncmUgdGhlIHNhbWUganVzdCBwaWNrIG9uZSBjb21wb25lbnQuXG4gIGNvbnN0IHMzUHJlZml4ID0gYXNzZXQuaWQgPT09IGFzc2V0LnNvdXJjZUhhc2ggPyAnYXNzZXRzLycgOiBgYXNzZXRzLyR7YXNzZXQuaWR9L2A7XG4gIGNvbnN0IGtleSA9IGAke3MzUHJlZml4fSR7YmFzZU5hbWV9YDtcbiAgY29uc3QgczN1cmwgPSBgczM6Ly8ke3Rvb2xraXRJbmZvLmJ1Y2tldE5hbWV9LyR7a2V5fWA7XG5cbiAgZGVidWcoYFN0b3JpbmcgYXNzZXQgJHthc3NldC5wYXRofSBhdCAke3MzdXJsfWApO1xuXG4gIGFzc2V0TWFuaWZlc3QuYWRkRmlsZUFzc2V0KGFzc2V0LnNvdXJjZUhhc2gsIHtcbiAgICBwYXRoOiBhc3NldC5wYXRoLFxuICAgIHBhY2thZ2luZyxcbiAgfSwge1xuICAgIGJ1Y2tldE5hbWU6IHRvb2xraXRJbmZvLmJ1Y2tldE5hbWUsXG4gICAgb2JqZWN0S2V5OiBrZXksXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgW2Fzc2V0LnMzQnVja2V0UGFyYW1ldGVyXTogdG9vbGtpdEluZm8uYnVja2V0TmFtZSxcbiAgICBbYXNzZXQuczNLZXlQYXJhbWV0ZXJdOiBgJHtzM1ByZWZpeH0ke2N4YXBpLkFTU0VUX1BSRUZJWF9TRVBBUkFUT1J9JHtiYXNlTmFtZX1gLFxuICAgIFthc3NldC5hcnRpZmFjdEhhc2hQYXJhbWV0ZXJdOiBhc3NldC5zb3VyY2VIYXNoLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBwcmVwYXJlRG9ja2VySW1hZ2VBc3NldChcbiAgYXNzZXQ6IGN4c2NoZW1hLkNvbnRhaW5lckltYWdlQXNzZXRNZXRhZGF0YUVudHJ5LFxuICBhc3NldE1hbmlmZXN0OiBBc3NldE1hbmlmZXN0QnVpbGRlcixcbiAgdG9vbGtpdEluZm86IFRvb2xraXRSZXNvdXJjZXNJbmZvKTogUHJvbWlzZTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiB7XG5cbiAgLy8gUHJlLTEuMjEuMCwgcmVwb3NpdG9yeU5hbWUgY2FuIGJlIHNwZWNpZmllZCBieSB0aGUgdXNlciBvciBjYW4gYmUgbGVmdCBvdXQsIGluIHdoaWNoIGNhc2Ugd2UgbWFrZVxuICAvLyBhIHBlci1hc3NldCByZXBvc2l0b3J5IHdoaWNoIHdpbGwgZ2V0IGFkb3B0ZWQgYW5kIGNsZWFuZWQgdXAgYWxvbmcgd2l0aCB0aGUgc3RhY2suXG4gIC8vIFBvc3QtMS4yMS4wLCByZXBvc2l0b3J5TmFtZSB3aWxsIGFsd2F5cyBiZSBzcGVjaWZpZWQgYW5kIGl0IHdpbGwgYmUgYSBzaGFyZWQgcmVwb3NpdG9yeSBiZXR3ZWVuXG4gIC8vIGFsbCBhc3NldHMsIGFuZCBhc3NldCB3aWxsIGhhdmUgaW1hZ2VUYWcgc3BlY2lmaWVkIGFzIHdlbGwuIFZhbGlkYXRlIHRoZSBjb21iaW5hdGlvbi5cbiAgaWYgKCFhc3NldC5pbWFnZU5hbWVQYXJhbWV0ZXIgJiYgKCFhc3NldC5yZXBvc2l0b3J5TmFtZSB8fCAhYXNzZXQuaW1hZ2VUYWcpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIERvY2tlciBpbWFnZSBhc3NldCBjb25maWd1cmF0aW9uOiBcInJlcG9zaXRvcnlOYW1lXCIgYW5kIFwiaW1hZ2VUYWdcIiBhcmUgcmVxdWlyZWQgd2hlbiBcImltYWdlTmFtZVBhcmFtZXRlclwiIGlzIGxlZnQgb3V0Jyk7XG4gIH1cblxuICBjb25zdCByZXBvc2l0b3J5TmFtZSA9IGFzc2V0LnJlcG9zaXRvcnlOYW1lID8/ICdjZGsvJyArIGFzc2V0LmlkLnJlcGxhY2UoL1s6L10vZywgJy0nKS50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGUgcmVwb3NpdG9yeSBleGlzdHMsIHNpbmNlIHRoZSAnY2RrLWFzc2V0cycgdG9vbCB3aWxsIG5vdCBjcmVhdGUgaXQgZm9yIHVzLlxuICBjb25zdCB7IHJlcG9zaXRvcnlVcmkgfSA9IGF3YWl0IHRvb2xraXRJbmZvLnByZXBhcmVFY3JSZXBvc2l0b3J5KHJlcG9zaXRvcnlOYW1lKTtcbiAgY29uc3QgaW1hZ2VUYWcgPSBhc3NldC5pbWFnZVRhZyA/PyBhc3NldC5zb3VyY2VIYXNoO1xuXG4gIGFzc2V0TWFuaWZlc3QuYWRkRG9ja2VySW1hZ2VBc3NldChhc3NldC5zb3VyY2VIYXNoLCB7XG4gICAgZGlyZWN0b3J5OiBhc3NldC5wYXRoLFxuICAgIGRvY2tlckJ1aWxkQXJnczogYXNzZXQuYnVpbGRBcmdzLFxuICAgIGRvY2tlckJ1aWxkVGFyZ2V0OiBhc3NldC50YXJnZXQsXG4gICAgZG9ja2VyRmlsZTogYXNzZXQuZmlsZSxcbiAgfSwge1xuICAgIHJlcG9zaXRvcnlOYW1lLFxuICAgIGltYWdlVGFnLFxuICB9KTtcblxuICBpZiAoIWFzc2V0LmltYWdlTmFtZVBhcmFtZXRlcikgeyByZXR1cm4ge307IH1cbiAgcmV0dXJuIHsgW2Fzc2V0LmltYWdlTmFtZVBhcmFtZXRlcl06IGAke3JlcG9zaXRvcnlVcml9OiR7aW1hZ2VUYWd9YCB9O1xufSJdfQ==