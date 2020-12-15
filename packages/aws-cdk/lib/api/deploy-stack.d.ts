import * as cxapi from '@aws-cdk/cx-api';
import { Tag } from '../cdk-toolkit';
import { ISDK, SdkProvider } from './aws-auth';
import { ToolkitResourcesInfo } from './toolkit-info';
import { StackActivityProgress } from './util/cloudformation/stack-activity-monitor';
/** @experimental */
export interface DeployStackResult {
    readonly noOp: boolean;
    readonly outputs: {
        [name: string]: string;
    };
    readonly stackArn: string;
    readonly stackArtifact: cxapi.CloudFormationStackArtifact;
}
/** @experimental */
export interface DeployStackOptions {
    /**
     * The stack to be deployed
     */
    stack: cxapi.CloudFormationStackArtifact;
    /**
     * The environment to deploy this stack in
     *
     * The environment on the stack artifact may be unresolved, this one
     * must be resolved.
     */
    resolvedEnvironment: cxapi.Environment;
    /**
     * The SDK to use for deploying the stack
     *
     * Should have been initialized with the correct role with which
     * stack operations should be performed.
     */
    sdk: ISDK;
    /**
     * SDK provider (seeded with default credentials)
     *
     * Will exclusively be used to assume publishing credentials (which must
     * start out from current credentials regardless of whether we've assumed an
     * action role to touch the stack or not).
     *
     * Used for the following purposes:
     *
     * - Publish legacy assets.
     * - Upload large CloudFormation templates to the staging bucket.
     */
    sdkProvider: SdkProvider;
    /**
     * Information about the bootstrap stack found in the target environment
     *
     * @default - Assume there is no bootstrap stack
     */
    toolkitInfo?: ToolkitResourcesInfo;
    /**
     * Role to pass to CloudFormation to execute the change set
     *
     * @default - Role specified on stack, otherwise current
     */
    roleArn?: string;
    /**
     * Notification ARNs to pass to CloudFormation to notify when the change set has completed
     *
     * @default - No notifications
     */
    notificationArns?: string[];
    /**
     * Name to deploy the stack under
     *
     * @default - Name from assembly
     */
    deployName?: string;
    /**
     * Quiet or verbose deployment
     *
     * @default false
     */
    quiet?: boolean;
    /**
     * List of asset IDs which shouldn't be built
     *
     * @default - Build all assets
     */
    reuseAssets?: string[];
    /**
     * Tags to pass to CloudFormation to add to stack
     *
     * @default - No tags
     */
    tags?: Tag[];
    /**
     * Whether to execute the changeset or leave it in review.
     *
     * @default true
     */
    execute?: boolean;
    /**
     * The collection of extra parameters
     * (in addition to those used for assets)
     * to pass to the deployed template.
     * Note that parameters with `undefined` or empty values will be ignored,
     * and not passed to the template.
     *
     * @default - no additional parameters will be passed to the template
     */
    parameters?: {
        [name: string]: string | undefined;
    };
    /**
     * Use previous values for unspecified parameters
     *
     * If not set, all parameters must be specified for every deployment.
     *
     * @default false
     */
    usePreviousParameters?: boolean;
    /**
     * Display mode for stack deployment progress.
     *
     * @default StackActivityProgress.Bar stack events will be displayed for
     *   the resource currently being deployed.
     */
    progress?: StackActivityProgress;
    /**
     * Deploy even if the deployed template is identical to the one we are about to deploy.
     * @default false
     */
    force?: boolean;
    /**
     * Whether we are on a CI system
     *
     * @default false
     */
    readonly ci?: boolean;
}
/** @experimental */
export declare function deployStack(options: DeployStackOptions): Promise<DeployStackResult>;
/** @experimental */
export interface DestroyStackOptions {
    /**
     * The stack to be destroyed
     */
    stack: cxapi.CloudFormationStackArtifact;
    sdk: ISDK;
    roleArn?: string;
    deployName?: string;
    quiet?: boolean;
}
/** @experimental */
export declare function destroyStack(options: DestroyStackOptions): Promise<void>;
