import * as cxapi from '@aws-cdk/cx-api';
import { ISDK } from './aws-auth';
import { CloudFormationStack } from './util/cloudformation';
export declare const DEFAULT_TOOLKIT_STACK_NAME = "CDKToolkit";
export declare class ToolkitStackInfo {
    readonly stack: CloudFormationStack;
    static determineName(overrideName?: string): string;
    static lookup(environment: cxapi.Environment, sdk: ISDK, stackName: string | undefined): Promise<ToolkitStackInfo | undefined>;
    constructor(stack: CloudFormationStack);
    get version(): number;
    get parameters(): Record<string, string>;
}
interface ToolkitResorcesInfoProps {
    bucketName: string;
    bucketDomainName: string;
    version: number;
}
/**
 * Information on the Bootstrap stack
 *
 * Called "ToolkitInfo" for historical reasons.
 *
 * @experimental
 */
export declare class ToolkitResourcesInfo {
    private readonly sdk;
    /** @experimental */
    static lookup(environment: cxapi.Environment, sdk: ISDK, qualifier?: string): Promise<ToolkitResourcesInfo | undefined>;
    readonly bucketName: string;
    readonly bucketUrl: string;
    readonly version: number;
    constructor(sdk: ISDK, { bucketName, bucketDomainName, version }: ToolkitResorcesInfoProps);
    /**
     * Prepare an ECR repository for uploading to using Docker
     *
     * @experimental
     */
    prepareEcrRepository(repositoryName: string): Promise<EcrRepositoryInfo>;
}
/** @experimental */
export interface EcrRepositoryInfo {
    repositoryUri: string;
}
/** @experimental */
export interface EcrCredentials {
    username: string;
    password: string;
    endpoint: string;
}
export {};
