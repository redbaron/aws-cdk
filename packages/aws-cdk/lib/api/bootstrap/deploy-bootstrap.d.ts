import * as cxapi from '@aws-cdk/cx-api';
import { SdkProvider, ISDK } from '../aws-auth';
import { DeployStackResult } from '../deploy-stack';
import { ToolkitStackInfo } from '../toolkit-info';
import { BootstrapEnvironmentOptions } from './bootstrap-props';
/**
 * A class to hold state around stack bootstrapping
 *
 * This class exists so we can break bootstrapping into 2 phases:
 *
 * ```ts
 * const current = BootstrapStack.lookup(...);
 * // ...
 * current.update(newTemplate, ...);
 * ```
 *
 * And do something in between the two phases (such as look at the
 * current bootstrap stack and doing something intelligent).
 *
 * This class is different from `ToolkitInfo` in that `ToolkitInfo`
 * is purely read-only, and `ToolkitInfo.lookup()` returns `undefined`
 * if the stack does not exist. But honestly, these classes could and
 * should probably be merged at some point.
 */
export declare class BootstrapStack {
    private readonly sdkProvider;
    private readonly sdk;
    private readonly resolvedEnvironment;
    private readonly toolkitStackName;
    private readonly currentToolkitInfo?;
    static lookup(sdkProvider: SdkProvider, environment: cxapi.Environment, toolkitStackName?: string): Promise<BootstrapStack>;
    protected constructor(sdkProvider: SdkProvider, sdk: ISDK, resolvedEnvironment: cxapi.Environment, toolkitStackName: string, currentToolkitInfo?: ToolkitStackInfo | undefined);
    get parameters(): Record<string, string>;
    get terminationProtection(): boolean | undefined;
    partition(): Promise<string>;
    /**
     * Perform the actual deployment of a bootstrap stack, given a template and some parameters
     */
    update(template: any, parameters: Record<string, string | undefined>, options: Omit<BootstrapEnvironmentOptions, 'parameters'>): Promise<DeployStackResult>;
}
export declare function bootstrapVersionFromTemplate(template: any): number;
