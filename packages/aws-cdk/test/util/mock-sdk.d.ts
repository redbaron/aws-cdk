/// <reference types="jest" />
import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import { Account, ISDK, SdkProvider, ToolkitStackInfo } from '../../lib';
import { CloudFormationStack } from '../../lib/api/util/cloudformation';
export interface MockSdkProviderOptions {
    /**
     * Whether the mock provider should produce a real SDK
     *
     * Some tests require a real SDK because they use `AWS-mock` to replace
     * the underlying calls. Other tests do their work completely using jest-mocks.
     *
     * @default true
     */
    readonly realSdk?: boolean;
}
/**
 * An SDK that allows replacing (some of) the clients
 *
 * Its the responsibility of the consumer to replace all calls that
 * actually will be called.
 */
export declare class MockSdkProvider extends SdkProvider {
    private readonly sdk;
    constructor(options?: MockSdkProviderOptions);
    defaultAccount(): Promise<Account | undefined>;
    forEnvironment(): Promise<ISDK>;
    /**
     * Replace the CloudFormation client with the given object
     */
    stubCloudFormation(stubs: SyncHandlerSubsetOf<AWS.CloudFormation>): void;
    /**
     * Replace the ECR client with the given object
     */
    stubEcr(stubs: SyncHandlerSubsetOf<AWS.ECR>): void;
    /**
     * Replace the S3 client with the given object
     */
    stubS3(stubs: SyncHandlerSubsetOf<AWS.S3>): void;
    /**
     * Replace the STS client with the given object
     */
    stubSTS(stubs: SyncHandlerSubsetOf<AWS.STS>): void;
    /**
     * Replace the ELBv2 client with the given object
     */
    stubELBv2(stubs: SyncHandlerSubsetOf<AWS.ELBv2>): void;
}
export declare class MockSdk implements ISDK {
    readonly currentRegion: string;
    readonly cloudFormation: jest.Mock<any, any>;
    readonly ec2: jest.Mock<any, any>;
    readonly ssm: jest.Mock<any, any>;
    readonly s3: jest.Mock<any, any>;
    readonly route53: jest.Mock<any, any>;
    readonly ecr: jest.Mock<any, any>;
    readonly elbv2: jest.Mock<any, any>;
    currentAccount(): Promise<Account>;
    /**
     * Replace the CloudFormation client with the given object
     */
    stubCloudFormation(stubs: SyncHandlerSubsetOf<AWS.CloudFormation>): void;
    /**
     * Replace the ECR client with the given object
     */
    stubEcr(stubs: SyncHandlerSubsetOf<AWS.ECR>): void;
}
declare type AwsCallInputOutput<T> = T extends {
    (args: infer INPUT, callback?: ((err: AWS.AWSError, data: any) => void) | undefined): AWS.Request<infer OUTPUT, AWS.AWSError>;
    (callback?: ((err: AWS.AWSError, data: {}) => void) | undefined): AWS.Request<any, any>;
} ? [INPUT, OUTPUT] : T;
declare type MockHandlerType<AI> = AI extends [any, any] ? (input: AI[0]) => AI[1] : AI;
export declare type SyncHandlerSubsetOf<S> = {
    [K in keyof S]?: MockHandlerType<AwsCallInputOutput<S[K]>>;
};
export declare function mockBootstrapStack(sdk: ISDK | undefined, stack?: Partial<AWS.CloudFormation.Stack>): CloudFormationStack;
export declare function mockToolkitStackInfo(stack?: Partial<AWS.CloudFormation.Stack>): ToolkitStackInfo;
export declare function mockResolvedEnvironment(): cxapi.Environment;
export declare type MockedObject<S extends object> = {
    [K in keyof S]: MockedFunction<Required<S>[K]>;
};
declare type MockedFunction<T> = T extends (...args: any[]) => any ? jest.MockInstance<ReturnType<T>, jest.ArgsType<T>> : T;
export declare function errorWithCode(code: string, message: string): Error;
export {};
