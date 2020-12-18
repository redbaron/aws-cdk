import * as cxapi from '@aws-cdk/cx-api';
import { Tag } from '../cdk-toolkit';
import { SdkProvider } from './aws-auth';
import { DeployStackResult } from './deploy-stack';
import { Template } from './util/cloudformation';
import { StackActivityProgress } from './util/cloudformation/stack-activity-monitor';
export interface DeployStackOptions {
    /**
     * Stack to deploy
     */
    stack: cxapi.CloudFormationStackArtifact;
    /**
     * Execution role for the deployment (pass through to CloudFormation)
     *
     * @default - Current role
     */
    roleArn?: string;
    /**
     * Topic ARNs to send a message when deployment finishes (pass through to CloudFormation)
     *
     * @default - No notifications
     */
    notificationArns?: string[];
    /**
     * Override name under which stack will be deployed
     *
     * @default - Use artifact default
     */
    deployName?: string;
    /**
     * Don't show stack deployment events, just wait
     *
     * @default false
     */
    quiet?: boolean;
    /**
     * Name of the toolkit stack, if not the default name
     *
     * @default 'CDKToolkit'
     */
    /**
     * Name of the toolkit stack qualifier, if not the default
     *
     * @default 'hnb659fds'
     */
    bootstrapQualifier?: string;
    /**
     * List of asset IDs which should NOT be built or uploaded
     *
     * @default - Build all assets
     */
    reuseAssets?: string[];
    /**
     * Stack tags (pass through to CloudFormation)
     */
    tags?: Tag[];
    /**
     * Stage the change set but don't execute it
     *
     * @default - false
     */
    execute?: boolean;
    /**
     * Force deployment, even if the deployed template is identical to the one we are about to deploy.
     * @default false deployment will be skipped if the template is identical
     */
    force?: boolean;
    /**
     * Extra parameters for CloudFormation
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
     * @default true
     */
    usePreviousParameters?: boolean;
    /**
     * Display mode for stack deployment progress.
     *
     * @default - StackActivityProgress.Bar - stack events will be displayed for
     *   the resource currently being deployed.
     */
    progress?: StackActivityProgress;
    /**
     * Whether we are on a CI system
     *
     * @default false
     */
    readonly ci?: boolean;
}
export interface DestroyStackOptions {
    stack: cxapi.CloudFormationStackArtifact;
    deployName?: string;
    roleArn?: string;
    quiet?: boolean;
    force?: boolean;
}
export interface StackExistsOptions {
    stack: cxapi.CloudFormationStackArtifact;
    deployName?: string;
}
export interface ProvisionerProps {
    sdkProvider: SdkProvider;
}
/**
 * Helper class for CloudFormation deployments
 *
 * Looks us the right SDK and Bootstrap stack to deploy a given
 * stack artifact.
 */
export declare class CloudFormationDeployments {
    private readonly sdkProvider;
    constructor(props: ProvisionerProps);
    readCurrentTemplate(stackArtifact: cxapi.CloudFormationStackArtifact): Promise<Template>;
    deployStack(options: DeployStackOptions): Promise<DeployStackResult>;
    destroyStack(options: DestroyStackOptions): Promise<void>;
    stackExists(options: StackExistsOptions): Promise<boolean>;
    /**
     * Get the environment necessary for touching the given stack
     *
     * Returns the following:
     *
     * - The resolved environment for the stack (no more 'unknown-account/unknown-region')
     * - SDK loaded with the right credentials for calling `CreateChangeSet`.
     * - The Execution Role that should be passed to CloudFormation.
     */
    private prepareSdkFor;
    /**
     * Replace the {ACCOUNT} and {REGION} placeholders in all strings found in a complex object.
     */
    private replaceEnvPlaceholders;
    /**
     * Publish all asset manifests that are referenced by the given stack
     */
    private publishStackAssets;
    /**
     * Validate that the bootstrap stack has the right version for this stack
     */
    private validateBootstrapStackVersion;
}