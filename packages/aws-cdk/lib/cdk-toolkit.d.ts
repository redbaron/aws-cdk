/// <reference types="node" />
import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider } from './api/aws-auth';
import { Bootstrapper, BootstrapEnvironmentOptions } from './api/bootstrap';
import { CloudFormationDeployments } from './api/cloudformation-deployments';
import { CloudExecutable } from './api/cxapp/cloud-executable';
import { StackActivityProgress } from './api/util/cloudformation/stack-activity-monitor';
import { RequireApproval } from './diff';
import { Configuration } from './settings';
export interface CdkToolkitProps {
    /**
     * The Cloud Executable
     */
    cloudExecutable: CloudExecutable;
    /**
     * The provisioning engine used to apply changes to the cloud
     */
    cloudFormation: CloudFormationDeployments;
    /**
     * Whether to be verbose
     *
     * @default false
     */
    verbose?: boolean;
    /**
     * Don't stop on error metadata
     *
     * @default false
     */
    ignoreErrors?: boolean;
    /**
     * Treat warnings in metadata as errors
     *
     * @default false
     */
    strict?: boolean;
    /**
     * Application configuration (settings and context)
     */
    configuration: Configuration;
    /**
     * AWS object (used by synthesizer and contextprovider)
     */
    sdkProvider: SdkProvider;
}
/**
 * Toolkit logic
 *
 * The toolkit runs the `cloudExecutable` to obtain a cloud assembly and
 * deploys applies them to `cloudFormation`.
 */
export declare class CdkToolkit {
    private readonly props;
    constructor(props: CdkToolkitProps);
    metadata(stackName: string): Promise<{
        [path: string]: import("@aws-cdk/cloud-assembly-schema").MetadataEntry[];
    }>;
    diff(options: DiffOptions): Promise<number>;
    deploy(options: DeployOptions): Promise<void>;
    destroy(options: DestroyOptions): Promise<void>;
    list(selectors: string[], options?: {
        long?: boolean;
    }): Promise<0 | {
        id: string;
        name: string;
        environment: cxapi.Environment;
    }[]>;
    /**
     * Synthesize the given set of stacks (called when the user runs 'cdk synth')
     *
     * INPUT: Stack names can be supplied using a glob filter. If no stacks are
     * given, all stacks from the application are implictly selected.
     *
     * OUTPUT: If more than one stack ends up being selected, an output directory
     * should be supplied, where the templates will be written.
     */
    synth(stackNames: string[], exclusively: boolean): Promise<any>;
    /**
     * Bootstrap the CDK Toolkit stack in the accounts used by the specified stack(s).
     *
     * @param environmentSpecs environment names that need to have toolkit support
     *             provisioned, as a glob filter. If none is provided,
     *             all stacks are implicitly selected.
     * @param toolkitStackName the name to be used for the CDK Toolkit stack.
     */
    bootstrap(environmentSpecs: string[], bootstrapper: Bootstrapper, options: BootstrapEnvironmentOptions): Promise<void>;
    private selectStacksForList;
    private selectStacksForDeploy;
    private selectStacksForDiff;
    private selectStacksForDestroy;
    /**
     * Validate the stacks for errors and warnings according to the CLI's current settings
     */
    private validateStacks;
    /**
     * Select a single stack by its name
     */
    private selectSingleStackByName;
    private assembly;
}
export interface DiffOptions {
    /**
     * Stack names to diff
     */
    stackNames: string[];
    /**
     * Only select the given stack
     *
     * @default false
     */
    exclusively?: boolean;
    /**
     * Used a template from disk instead of from the server
     *
     * @default Use from the server
     */
    templatePath?: string;
    /**
     * Strict diff mode
     *
     * @default false
     */
    strict?: boolean;
    /**
     * How many lines of context to show in the diff
     *
     * @default 3
     */
    contextLines?: number;
    /**
     * Where to write the default
     *
     * @default stderr
     */
    stream?: NodeJS.WritableStream;
    /**
     * Whether to fail with exit code 1 in case of diff
     *
     * @default false
     */
    fail?: boolean;
}
export interface DeployOptions {
    /**
     * Stack names to deploy
     */
    stackNames: string[];
    /**
     * Only select the given stack
     *
     * @default false
     */
    exclusively?: boolean;
    /**
     * Name of the toolkit stack to use/deploy
     *
     * @default CDKToolkit
     */
    /**
     * Bootstrap stack qualifier to use
     *
     * @default 'hnb659fds'
     */
    bootstrapQualifier?: string;
    /**
     * Role to pass to CloudFormation for deployment
     */
    roleArn?: string;
    /**
     * ARNs of SNS topics that CloudFormation will notify with stack related events
     */
    notificationArns?: string[];
    /**
     * What kind of security changes require approval
     *
     * @default RequireApproval.Broadening
     */
    requireApproval?: RequireApproval;
    /**
     * Reuse the assets with the given asset IDs
     */
    reuseAssets?: string[];
    /**
     * Tags to pass to CloudFormation for deployment
     */
    tags?: Tag[];
    /**
     * Whether to execute the ChangeSet
     * Not providing `execute` parameter will result in execution of ChangeSet
     * @default true
     */
    execute?: boolean;
    /**
     * Always deploy, even if templates are identical.
     * @default false
     */
    force?: boolean;
    /**
     * Additional parameters for CloudFormation at deploy time
     * @default {}
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
     * Path to file where stack outputs will be written after a successful deploy as JSON
     * @default - Outputs are not written to any file
     */
    outputsFile?: string;
    /**
     * Whether we are on a CI system
     *
     * @default false
     */
    readonly ci?: boolean;
}
export interface DestroyOptions {
    /**
     * The names of the stacks to delete
     */
    stackNames: string[];
    /**
     * Whether to exclude stacks that depend on the stacks to be deleted
     */
    exclusively: boolean;
    /**
     * Whether to skip prompting for confirmation
     */
    force: boolean;
    /**
     * The arn of the IAM role to use
     */
    roleArn?: string;
    /**
     * Whether the destroy request came from a deploy.
     */
    fromDeploy?: boolean;
}
export interface Tag {
    readonly Key: string;
    readonly Value: string;
}
