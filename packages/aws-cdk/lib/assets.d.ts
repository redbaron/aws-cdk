import * as cxapi from '@aws-cdk/cx-api';
import { ToolkitResourcesInfo } from './api/toolkit-info';
import { AssetManifestBuilder } from './util/asset-manifest-builder';
/**
 * Take the metadata assets from the given stack and add them to the given asset manifest
 *
 * Returns the CloudFormation parameters that need to be sent to the template to
 * pass Asset coordinates.
 */
export declare function addMetadataAssetsToManifest(stack: cxapi.CloudFormationStackArtifact, assetManifest: AssetManifestBuilder, toolkitInfo?: ToolkitResourcesInfo, reuse?: string[]): Promise<Record<string, string>>;